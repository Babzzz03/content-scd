/**
 * AccountHealth
 *
 * The anti-flagging layer. Every automation run must pass through assertUsable()
 * before opening a browser, and must report what happened afterwards.
 *
 * WHY THIS EXISTS
 * ───────────────
 * An Instagram account was checkpointed during development after roughly 15
 * browser sessions in one hour, a burst of profile page loads that tripped a
 * 429, and a cold DM sent from an account whose inbox had no prior threads.
 * Each of those is a spam signal on its own; together they are unmistakable.
 *
 * Nothing here makes automation undetectable. What it does is keep the volume
 * and shape of activity inside what a real person plausibly does, and stop
 * everything the moment Instagram signals displeasure — because continuing to
 * hammer a throttled or checkpointed account is what turns a soft flag into a
 * hard one.
 */
const PlatformAccount = require('../models/PlatformAccount')
const logger = require('../utils/logger')

// ─── Budgets ──────────────────────────────────────────────────────────────────

const BUDGET = {
  /**
   * Browser sessions per rolling hour. Each session is a fresh browser launch,
   * and a real person does not start 15 browsing sessions an hour.
   */
  sessionsPerHour: 4,

  /**
   * Profile loads per rolling hour. This is the number that tripped the 429.
   * Deliberately well under it — a person skimming leads opens maybe 20-30
   * profiles an hour at most, and only in bursts.
   */
  profileFetchesPerHour: 25,

  /** Minimum gap between two browser sessions on one account */
  minSessionGapMs: 8 * 60 * 1000,

  /** Consecutive failures before the circuit breaker trips */
  maxConsecutiveFailures: 3,

  /** Cooldowns applied per signal */
  cooldown: {
    rateLimited:  45 * 60 * 1000,        // soft throttle, back off and retry later
    checkpoint:   7 * 24 * 60 * 60 * 1000, // effectively "stop until a human fixes it"
    breakerTrip:  6 * 60 * 60 * 1000,
  },

  /**
   * An account with no DM history sending a cold DM is the single strongest
   * spam signal. Require some inbox history, or an explicit override once the
   * user has warmed the account by hand.
   */
  requireInboxHistoryBeforeDm: true,
}

// ─── Rolling window helpers ───────────────────────────────────────────────────

const HOUR_MS = 60 * 60 * 1000

/** Zero a counter if its window has rolled over. Mutates, does not save. */
const rollWindow = (account, counterField, windowField) => {
  const windowStart = account[windowField] ? new Date(account[windowField]).getTime() : 0
  if (Date.now() - windowStart > HOUR_MS) {
    account[counterField] = 0
    account[windowField] = new Date()
  }
}

// ─── Gate ─────────────────────────────────────────────────────────────────────

/**
 * Find every PlatformAccount row that points at the same real platform
 * identity, across all app users.
 *
 * WHY: budgets and health protect the *Instagram account*, not the database
 * row. The same handle connected by two app users previously produced two
 * independent health records and two independent budgets, which let a
 * checkpointed account keep running under a second user. Observed in
 * development, and it is the reason this function exists.
 */
const findSiblings = (platform, username) =>
  PlatformAccount.find({
    platform,
    username: new RegExp(`^${String(username).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  })

/**
 * The worst health across every record of one identity.
 * A checkpoint anywhere means checkpointed everywhere.
 */
const worstHealth = (accounts) => {
  const rank = { active: 0, rate_limited: 1, disabled: 2, checkpointed: 3 }
  return accounts.reduce((worst, a) => {
    const h = a.health || 'active'
    return (rank[h] ?? 0) > (rank[worst.health] ?? 0)
      ? { health: h, reason: a.healthReason, cooldownUntil: a.cooldownUntil }
      : worst
  }, { health: 'active', reason: '', cooldownUntil: null })
}

/** Sum a counter across sibling rows whose window is still open. */
const combinedCounter = (accounts, counterField, windowField) => {
  const now = Date.now()
  return accounts.reduce((sum, a) => {
    const start = a[windowField] ? new Date(a[windowField]).getTime() : 0
    return now - start > HOUR_MS ? sum : sum + (a[counterField] || 0)
  }, 0)
}

/**
 * May this account run automation right now?
 *
 * Pass `siblings` (every row for the same handle) to enforce budgets against
 * the real identity. Without it, only this row is considered — correct only
 * when the handle is connected once.
 *
 * @param {object} account - a PlatformAccount document
 * @param {object} opts
 * @param {string} opts.kind - 'discovery' | 'dm' | 'check'
 * @param {object[]} [opts.siblings] - all rows sharing this platform+username
 * @returns {{ ok: boolean, reason: string, retryAfterMs: number }}
 */
const canRun = (account, { kind = 'discovery', siblings = null } = {}) => {
  const now = Date.now()
  const family = siblings && siblings.length ? siblings : [account]

  // Health is shared across the identity: a checkpoint on any row blocks all
  const shared = worstHealth(family)
  if (shared.health !== 'active' && shared.health !== (account.health || 'active')) {
    account = { ...account.toObject?.() ?? account, health: shared.health, healthReason: shared.reason, cooldownUntil: shared.cooldownUntil }
  }

  if (!account.isActive) {
    return { ok: false, reason: 'Account is disconnected', retryAfterMs: 0 }
  }

  if (account.health === 'checkpointed') {
    return {
      ok: false,
      retryAfterMs: 0,
      reason: 'Instagram is asking this account to verify its identity. '
            + 'Open Instagram in a browser, complete the verification, then reconnect '
            + 'the account with a fresh cookie. Automation stays off until you do.',
    }
  }

  if (account.health === 'disabled') {
    return { ok: false, reason: account.healthReason || 'Account needs a new session cookie', retryAfterMs: 0 }
  }

  if (account.cooldownUntil && new Date(account.cooldownUntil).getTime() > now) {
    const ms = new Date(account.cooldownUntil).getTime() - now
    return {
      ok: false,
      retryAfterMs: ms,
      reason: `Cooling down for ${Math.ceil(ms / 60000)} more minute(s): ${account.healthReason || 'recent throttling'}`,
    }
  }

  rollWindow(account, 'sessionsThisHour', 'sessionWindowAt')
  rollWindow(account, 'profileFetchesThisHour', 'profileWindowAt')

  // Spend is summed across every row for this identity, so connecting the
  // same handle under a second user cannot double the budget.
  account.sessionsThisHour = Math.max(
    account.sessionsThisHour,
    combinedCounter(family, 'sessionsThisHour', 'sessionWindowAt')
  )
  account.profileFetchesThisHour = Math.max(
    account.profileFetchesThisHour,
    combinedCounter(family, 'profileFetchesThisHour', 'profileWindowAt')
  )

  if (account.sessionsThisHour >= BUDGET.sessionsPerHour) {
    const ms = HOUR_MS - (now - new Date(account.sessionWindowAt).getTime())
    return {
      ok: false,
      retryAfterMs: Math.max(ms, 0),
      reason: `Session budget spent (${account.sessionsThisHour}/${BUDGET.sessionsPerHour} this hour)`,
    }
  }

  if (account.lastUsedAt) {
    const since = now - new Date(account.lastUsedAt).getTime()
    if (since < BUDGET.minSessionGapMs) {
      const ms = BUDGET.minSessionGapMs - since
      return {
        ok: false,
        retryAfterMs: ms,
        reason: `Too soon after the last session, waiting ${Math.ceil(ms / 60000)} more minute(s)`,
      }
    }
  }

  if (kind === 'discovery' && account.profileFetchesThisHour >= BUDGET.profileFetchesPerHour) {
    return {
      ok: false,
      retryAfterMs: HOUR_MS - (now - new Date(account.profileWindowAt).getTime()),
      reason: `Profile view budget spent (${account.profileFetchesThisHour}/${BUDGET.profileFetchesPerHour} this hour)`,
    }
  }

  return { ok: true, reason: '', retryAfterMs: 0 }
}

/** Throwing wrapper for call sites that should simply abort. */
const assertUsable = async (accountId, opts = {}) => {
  const account = await PlatformAccount.findById(accountId)
  if (!account) throw new Error('Platform account not found')

  const verdict = canRun(account, opts)
  if (!verdict.ok) {
    const err = new Error(verdict.reason)
    err.code = 'ACCOUNT_UNAVAILABLE'
    err.retryAfterMs = verdict.retryAfterMs
    throw err
  }
  return account
}

// ─── Recording ────────────────────────────────────────────────────────────────

/** Call immediately before opening a browser context. */
const recordSessionStart = async (account) => {
  rollWindow(account, 'sessionsThisHour', 'sessionWindowAt')
  account.sessionsThisHour += 1
  account.lastUsedAt = new Date()
  await account.save()
}

/** Call after each profile enrichment, whichever path was used. */
const recordProfileFetches = async (account, count = 1) => {
  rollWindow(account, 'profileFetchesThisHour', 'profileWindowAt')
  account.profileFetchesThisHour += count
  await account.save()
}

/** A run finished cleanly. */
const recordSuccess = async (account) => {
  account.consecutiveFailures = 0
  account.lastError = null
  if (account.health === 'rate_limited' &&
      (!account.cooldownUntil || new Date(account.cooldownUntil) <= new Date())) {
    account.health = 'active'
    account.healthReason = ''
  }
  await account.save()
}

/**
 * A run failed. Classifies the error and applies the matching cooldown.
 * Checkpoints stop automation outright; everything else backs off.
 */
const recordFailure = async (account, err) => {
  const message = err?.message || String(err)
  account.lastError = message
  account.consecutiveFailures = (account.consecutiveFailures || 0) + 1

  const isCheckpoint = /checkpoint|confirm that it'?s you|challenge_required|verify your identity/i.test(message)
  const isRateLimit  = /429|rate.?limit|too many requests|please wait a few minutes/i.test(message)
  const isAuthDead   = /cookie is invalid or expired|login_required|not logged in/i.test(message)

  // A checkpoint belongs to the Instagram account, not to one database row,
  // so mark every record of this handle.
  if (isCheckpoint) {
    try {
      const siblings = await findSiblings(account.platform, account.username)
      for (const sib of siblings) {
        if (String(sib._id) === String(account._id)) continue
        sib.health = 'checkpointed'
        sib.healthReason = 'Instagram requires identity verification'
        sib.healthAt = new Date()
        sib.cooldownUntil = new Date(Date.now() + BUDGET.cooldown.checkpoint)
        await sib.save()
      }
      if (siblings.length > 1) {
        logger.warn('accountHealth: checkpoint propagated to sibling records', {
          username: account.username, records: siblings.length,
        })
      }
    } catch (e) {
      logger.warn('accountHealth: could not propagate checkpoint', { err: e.message })
    }
  }

  if (isCheckpoint) {
    account.health = 'checkpointed'
    account.healthReason = 'Instagram requires identity verification'
    account.healthAt = new Date()
    account.cooldownUntil = new Date(Date.now() + BUDGET.cooldown.checkpoint)
    logger.error('accountHealth: CHECKPOINT detected, automation halted', {
      account: account.username,
    })
  } else if (isRateLimit) {
    account.health = 'rate_limited'
    account.healthReason = 'Instagram rate limited this account'
    account.healthAt = new Date()
    account.cooldownUntil = new Date(Date.now() + BUDGET.cooldown.rateLimited)
    logger.warn('accountHealth: rate limited, cooling down', {
      account: account.username,
      minutes: BUDGET.cooldown.rateLimited / 60000,
    })
  } else if (isAuthDead) {
    account.health = 'disabled'
    account.healthReason = 'Session cookie is no longer valid'
    account.healthAt = new Date()
  } else if (account.consecutiveFailures >= BUDGET.maxConsecutiveFailures) {
    account.health = 'rate_limited'
    account.healthReason = `${account.consecutiveFailures} consecutive failures`
    account.healthAt = new Date()
    account.cooldownUntil = new Date(Date.now() + BUDGET.cooldown.breakerTrip)
    logger.warn('accountHealth: circuit breaker tripped', { account: account.username })
  }

  await account.save()
}

/** Clear a checkpoint or disabled state after the user reconnects. */
const clearHealth = async (accountId) => {
  const account = await PlatformAccount.findById(accountId)
  if (!account) throw new Error('Platform account not found')
  account.health = 'active'
  account.healthReason = ''
  account.healthAt = null
  account.cooldownUntil = null
  account.consecutiveFailures = 0
  account.lastError = null
  await account.save()
  return account
}

module.exports = {
  BUDGET,
  canRun,
  findSiblings,
  worstHealth,
  assertUsable,
  recordSessionStart,
  recordProfileFetches,
  recordSuccess,
  recordFailure,
  clearHealth,
}
