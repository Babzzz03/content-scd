/**
 * Automation Hub
 *
 * Single entry point for the posting service.
 * Routes each publish request to the correct platform automation class.
 *
 * ⚠️  IMPORTANT — TERMS OF SERVICE NOTICE ⚠️
 * Automated posting may violate the Terms of Service of X, LinkedIn, and
 * Instagram. Use this only for accounts you own and with the explicit
 * understanding that your account may be restricted if platforms detect
 * automation. The anti-detection measures here reduce — but do not
 * eliminate — this risk. Always monitor account health.
 */

const XAutomation        = require('./platforms/x/XAutomation')
const LinkedInAutomation = require('./platforms/linkedin/LinkedInAutomation')
const InstagramAutomation = require('./platforms/instagram/InstagramAutomation')
const logger = require('../src/utils/logger')

const PLATFORM_MAP = {
  x:         XAutomation,
  linkedin:  LinkedInAutomation,
  instagram: InstagramAutomation,
}

/**
 * Publish a post through the appropriate platform automation.
 *
 * @param {object} payload
 * @param {string} payload.platform       - 'x' | 'linkedin' | 'instagram'
 * @param {object} payload.credentials    - { email, password, username? }
 * @param {string} [payload.sessionFile]  - path to saved session JSON
 * @param {string} payload.content        - post text
 * @param {string[]} [payload.hashtags]   - hashtag strings (no # symbol)
 * @param {string[]} [payload.mediaUrls]  - absolute local file paths
 * @param {string} [payload.postType]     - 'standard' | 'thread' | 'reply'
 * @param {string[]} [payload.threadParts] - additional thread tweets
 * @param {number} [payload.dailyPostCount] - current count for limit check
 * @returns {Promise<{ postId: string|null, sessionFile: string|null }>}
 */
const publish = async (payload) => {
  const { platform } = payload
  const AutomationClass = PLATFORM_MAP[platform]
  if (!AutomationClass) throw new Error(`Unknown platform: ${platform}`)

  logger.info(`AutomationHub: publishing to ${platform}`)
  const automation = new AutomationClass()
  return automation.run(payload)
}

/**
 * Quick check — open a browser context, inject the cookie, and call isLoggedIn().
 * Returns true/false without posting anything.
 */
const verifyCookie = async ({ platform, cookie, sessionFile }) => {
  const AutomationClass = PLATFORM_MAP[platform]
  if (!AutomationClass) throw new Error(`Unknown platform: ${platform}`)

  const BrowserManager = require('./core/BrowserManager')
  const { context, page, human } = await BrowserManager.newContext(sessionFile)

  try {
    const automation = new AutomationClass()
    automation.context = context
    automation.page    = page
    automation.human   = human

    await automation._injectCookie(cookie)
    return await automation.isLoggedIn()
  } finally {
    await BrowserManager.closeContext(context)
  }
}

/**
 * Run a non-publishing task (lead discovery, DM send, reply check) through the
 * same authenticated-session pipeline as publishing.
 *
 * Identical to publish() except the payload carries a `task` field, which the
 * platform class routes to the matching workflow.
 *
 * @param {object} payload
 * @param {string} payload.platform
 * @param {string} payload.task - 'discover-leads' | 'send-dm' | 'check-replies'
 * @param {object} payload.cookie
 * @param {string} payload.username - the SENDING account, not the target
 */
const runTask = async (payload) => {
  const { platform, task } = payload
  const AutomationClass = PLATFORM_MAP[platform]
  if (!AutomationClass) throw new Error(`Unknown platform: ${platform}`)
  if (!task) throw new Error('runTask requires a task name')

  logger.info(`AutomationHub: running ${task} on ${platform}`)
  const automation = new AutomationClass()
  return automation.run(payload)
}

/**
 * Google Maps search. Unlike the social platforms this needs no cookie and no
 * logged-in session, so it borrows the browser stack without BasePlatform's
 * auth pipeline. Nothing here can cost you an account.
 */
const searchGoogleMaps = async (payload) => {
  const BrowserManager = require('./core/BrowserManager')
  const { searchPlaces } = require('./platforms/google/workflows/searchPlaces')

  logger.info('AutomationHub: Google Maps search')
  const { context, page } = await BrowserManager.newContext(null)
  try {
    return await searchPlaces(page, payload)
  } finally {
    await BrowserManager.closeContext(context)
  }
}

module.exports = { publish, runTask, verifyCookie, searchGoogleMaps }
