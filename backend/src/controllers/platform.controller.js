const PlatformAccount = require('../models/PlatformAccount')
const { encryptObject, decryptObject } = require('../services/encryption.service')
const { ok, created, notFound, badRequest, forbidden } = require('../utils/apiResponse')
const { PLANS } = require('../config/constants')
const AutomationHub = require('../../automation')
const accountHealth = require('../services/accountHealth.service')
const logger = require('../utils/logger')

// Cookie name per platform
const PLATFORM_COOKIE_NAME = {
  x:         'auth_token',
  linkedin:  'li_at',
  instagram: 'sessionid',
}

// ── List connected accounts ───────────────────────────────────────────────────

const listAccounts = async (req, res) => {
  const accounts = await PlatformAccount.find({ user: req.user._id, isActive: true })
    .select('-encryptedCredentials')
  ok(res, { accounts })
}

// ── Connect / update a platform account (cookie-based) ────────────────────────

const connectAccount = async (req, res) => {
  const { platform, username, displayName, profileImageUrl, cookie } = req.body

  if (!PLATFORM_COOKIE_NAME[platform]) return badRequest(res, 'Invalid platform')
  if (!username || !cookie) return badRequest(res, 'username and cookie are required')

  // Enforce plan platform limit (skipped when DISABLE_PLAN_CHECKS=true)
  if (process.env.DISABLE_PLAN_CHECKS !== 'true') {
    const existingCount = await PlatformAccount.countDocuments({ user: req.user._id, isActive: true })
    const limit = PLANS[req.user.plan]?.platforms || 1
    if (existingCount >= limit) {
      return forbidden(res, `Your plan allows ${limit} connected platform(s). Upgrade to add more.`)
    }
  }

  const cookieName = PLATFORM_COOKIE_NAME[platform]
  const encryptedCredentials = encryptObject({ cookieName, cookieValue: cookie })

  const account = await PlatformAccount.findOneAndUpdate(
    { user: req.user._id, platform, username },
    {
      user: req.user._id,
      platform,
      username,
      displayName:     displayName || username,
      profileImageUrl: profileImageUrl || null,
      encryptedCredentials,
      isActive:  true,
      // Clear cached session so automation re-injects the fresh cookie
      sessionFile: null,
    },
    { upsert: true, new: true }
  )

  const safe = account.toObject()
  delete safe.encryptedCredentials
  created(res, { account: safe }, 'Account connected')
}

// ── Update cookie ─────────────────────────────────────────────────────────────

const updateCredentials = async (req, res) => {
  const account = await PlatformAccount.findOne({ _id: req.params.id, user: req.user._id })
    .select('+encryptedCredentials')
  if (!account) return notFound(res, 'Account not found')

  const { cookie } = req.body
  if (!cookie) return badRequest(res, 'cookie is required')

  const existing = decryptObject(account.encryptedCredentials)
  account.encryptedCredentials = encryptObject({
    cookieName:  existing.cookieName,
    cookieValue: cookie,
  })
  // Invalidate cached session — next automation run will re-inject
  account.sessionFile = null
  account.isVerified = false
  await account.save()
  // Reconnecting with a fresh cookie is exactly what the checkpoint message
  // asks the user to do, so it clears the flag that was blocking automation.
  await accountHealth.clearHealth(account._id)
  for (const sib of await accountHealth.findSiblings(account.platform, account.username)) {
    if (String(sib._id) !== String(account._id)) await accountHealth.clearHealth(sib._id)
  }

  ok(res, {}, 'Cookie updated')
}

// ── Disconnect account ────────────────────────────────────────────────────────

const disconnectAccount = async (req, res) => {
  const account = await PlatformAccount.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { isActive: false, sessionFile: null },
    { new: true }
  )
  if (!account) return notFound(res, 'Account not found')
  ok(res, {}, 'Account disconnected')
}

// ── Verify cookie (test if stored session is still valid) ─────────────────────

const verifyCookie = async (req, res) => {
  const account = await PlatformAccount.findOne({ _id: req.params.id, user: req.user._id, isActive: true })
    .select('+encryptedCredentials')
  if (!account) return notFound(res, 'Account not found')

  let cookie
  try {
    cookie = decryptObject(account.encryptedCredentials)
  } catch (err) {
    return badRequest(res, `Failed to read stored cookie: ${err.message}`)
  }

  // Verification opens a real browser, so it costs a session like any other
  // run. Leaving it uncounted let repeated Verify clicks burn the hourly budget
  // invisibly, which is exactly what the guard exists to prevent.
  const gate = accountHealth.canRun(account, {
    kind: 'check',
    siblings: await accountHealth.findSiblings(account.platform, account.username),
  })
  // A checkpointed or throttled account may still be verified, since that is
  // how the user clears it. Only the volume budget applies here.
  if (!gate.ok && /budget|Too soon/i.test(gate.reason)) {
    return badRequest(res, gate.reason)
  }
  await accountHealth.recordSessionStart(account)

  try {
    const valid = await AutomationHub.verifyCookie({ platform: account.platform, cookie, sessionFile: null })
    account.isVerified = valid
    account.lastError  = valid ? null : 'Cookie verification failed — please refresh your cookie'

    if (valid) {
      // A successful live check is proof the account is usable again, so it
      // clears a stale checkpoint or cooldown. Without this the health flag is
      // a one-way door: set when a checkpoint is seen, never reset even after
      // the user resolves it in their browser.
      await accountHealth.clearHealth(account._id)
      for (const sib of await accountHealth.findSiblings(account.platform, account.username)) {
        if (String(sib._id) !== String(account._id)) await accountHealth.clearHealth(sib._id)
      }
      logger.info('verifyCookie: account healthy, health cleared', { username: account.username })
    }

    await account.save()
    ok(res, { valid, health: valid ? 'active' : account.health },
      valid ? 'Cookie is valid and the account is cleared for automation'
            : 'Cookie is expired or invalid')
  } catch (err) {
    account.isVerified = false
    account.lastError  = err.message
    await account.save()

    // A checkpoint is a distinct condition from a dead cookie and must be
    // recorded as such, on every row for this handle.
    if (err.code === 'CHECKPOINT' || /confirm that it'?s you|checkpoint/i.test(err.message)) {
      await accountHealth.recordFailure(account, err)
      return ok(res, { valid: false, health: 'checkpointed' },
        'Instagram is asking this account to verify its identity. Complete it in a browser, then verify again.')
    }

    ok(res, { valid: false, health: account.health }, `Verification failed: ${err.message}`)
  }
}

/**
 * Clear a checkpoint / cooldown without a live check.
 *
 * The escape hatch for when the user has resolved things in their browser and
 * just wants automation re-enabled. Verification is the better path because it
 * actually proves the account works, but this exists so a stale flag can never
 * permanently strand a working account.
 */
const clearAccountHealth = async (req, res) => {
  const account = await PlatformAccount.findOne({ _id: req.params.id, user: req.user._id })
  if (!account) return notFound(res, 'Account not found')

  await accountHealth.clearHealth(account._id)
  for (const sib of await accountHealth.findSiblings(account.platform, account.username)) {
    if (String(sib._id) !== String(account._id)) await accountHealth.clearHealth(sib._id)
  }

  const fresh = await PlatformAccount.findById(account._id).lean()
  logger.info('clearAccountHealth: reset by user', { username: account.username })
  ok(res, { account: fresh }, 'Account cleared for automation')
}

module.exports = {
  listAccounts, connectAccount, updateCredentials, disconnectAccount,
  verifyCookie, clearAccountHealth,
}
