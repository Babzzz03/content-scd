/**
 * BasePlatform
 *
 * Cookie-based auth — NO login flow.
 *
 * Flow:
 *   1. Open browser (reuse cached storageState if available)
 *   2. Inject the stored session cookie onto the platform domain
 *   3. Navigate to the platform and call isLoggedIn()
 *   4. If still not authenticated → throw (cookie expired, user must refresh it)
 *   5. humanisePrePublish() → publish() → save fresh storageState
 *
 * Subclasses only need to implement:
 *   - isLoggedIn()   → bool
 *   - publish(payload) → { postId }
 */

const BrowserManager = require('./BrowserManager')
const SessionManager = require('./SessionManager')
const { actionDelay, sleep, randInt } = require('../utils/random')
const { AUTOMATION } = require('../../src/config/constants')
const logger = require('../../src/utils/logger')

// Per-platform cookie injection config
// sameSite must match what the platform actually sets — X uses None, others use Lax
const COOKIE_CONFIG = {
  x:         { domain: '.x.com',         path: '/', sameSite: 'None' },
  linkedin:  { domain: '.linkedin.com',   path: '/', sameSite: 'Lax' },
  instagram: { domain: '.instagram.com',  path: '/', sameSite: 'Lax' },
}

class BasePlatform {
  constructor(platformId) {
    this.platformId = platformId
    this.context    = null
    this.page       = null
    this.human      = null
    this._saveSession = null
  }

  /**
   * @param {object} payload
   * @param {object} payload.cookie        - { cookieName, cookieValue }
   * @param {string} payload.username
   * @param {string|null} payload.sessionFile
   * @param {number} payload.dailyPostCount
   */
  async run(payload) {
    const { cookie, username, sessionFile, dailyPostCount = 0 } = payload

    // Enforce daily limit — publishing only. Lead tasks (discovery, DMs) carry
    // their own caps in the outreach job layer, and must not be blocked just
    // because the account already hit its posting quota for the day.
    if (!payload.task) {
      const dailyLimit = AUTOMATION.dailyLimits[this.platformId] || 50
      if (dailyPostCount >= dailyLimit) {
        throw new Error(`Daily posting limit (${dailyLimit}) reached for ${this.platformId}`)
      }
    }

    const { context, page, human, saveSession } = await BrowserManager.newContext(sessionFile)
    this.context      = context
    this.page         = page
    this.human        = human
    this._saveSession = saveSession

    try {
      // Always inject the stored cookie — ensures we have the latest even if a
      // cached storageState was loaded (it may have an older/expired cookie).
      await this._injectCookie(cookie)

      const loggedIn = await this.isLoggedIn()
      if (!loggedIn) {
        throw new Error(
          `${this.platformId}: session cookie is invalid or expired. ` +
          `Please refresh your ${cookie.cookieName} cookie in Settings.`
        )
      }

      logger.debug(`${this.platformId}: cookie valid, session active`)

      await this.humanisePrePublish()

      const result = await this.publish(payload)

      // Cache the fresh storageState for next run
      const filename  = SessionManager.buildFilename(this.platformId, username || 'account')
      const savedPath = await saveSession(filename)
      result.sessionFile = savedPath

      if (payload.task) {
        logger.info(`${this.platformId}: task complete`, { task: payload.task })
      } else {
        logger.info(`${this.platformId}: post published`, { postId: result.postId })
      }
      return result

    } finally {
      await BrowserManager.closeContext(context)
    }
  }

  /** Inject the session cookie directly into the browser context */
  async _injectCookie({ cookieName, cookieValue }) {
    const config = COOKIE_CONFIG[this.platformId]
    if (!config) return

    await this.context.addCookies([{
      name:     cookieName,
      value:    cookieValue,
      domain:   config.domain,
      path:     config.path,
      httpOnly: true,
      secure:   true,
      sameSite: config.sameSite,
    }])
  }

  /** Subclasses must implement: navigate to platform and check auth state */
  async isLoggedIn() { throw new Error('isLoggedIn() not implemented') }

  /** Subclasses must implement: post publishing */
  async publish(_payload) { throw new Error('publish() not implemented') }

  /** Simulate briefly reading the feed before posting — looks natural */
  async humanisePrePublish() {
    try {
      await this.human.scroll('down', randInt(200, 500))
      await sleep(randInt(2000, 5000))
      await this.human.scroll('up', randInt(100, 300))
      await sleep(actionDelay())
    } catch { /* non-critical */ }
  }

  async handleCaptcha() {
    logger.warn(`${this.platformId}: CAPTCHA detected`)
    throw new Error('CAPTCHA encountered. Please open the platform manually to clear it.')
  }
}

module.exports = BasePlatform
