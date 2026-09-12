// ─── WhatsApp account health ───
//
// Every decision about whether a send is safe right now lives here, as pure
// functions. Nothing in this file touches the database or the network, which is
// what lets the rules be tested properly instead of only observed in production
// after an account is already restricted.
//
// The governing rule, borrowed from the Instagram side and from DeskcommCRM:
// back off, never escalate. When WhatsApp pushes back, the correct response is
// always less traffic. Every "recovery" that sends more is how a warning becomes
// a ban.

// Deliberately conservative. A fresh number that blasts 100 cold messages on day
// one gets restricted, and no amount of jitter saves it.
const DEFAULTS = {
  minGapMs: 45000,
  jitterMs: 30000,
  dailyCap: 40,
  warmupDailyCap: 15,
  warmupDays: 7,
  windowStartHour: 9,
  windowEndHour: 18,
  timezone: 'Africa/Lagos'
}

// ─── Session status ───

// WAHA session states and what each one actually means for us.
//
// The distinction that matters: a FAILED session and a SCAN_QR_CODE session look
// equally broken on a dashboard, but the remedies are opposite. One needs a
// human to look at the container, the other needs the user to re-pair. Treating
// them the same either strands a recoverable session or spams a user with QR
// prompts that cannot help.
const classifySessionStatus = status => {
  switch (status) {
    case 'WORKING':
      return { healthy: true, canSend: true, needsQr: false, needsHuman: false, reason: 'working' }

    case 'SCAN_QR_CODE':
      return { healthy: false, canSend: false, needsQr: true, needsHuman: false, reason: 'awaiting_qr_scan' }

    case 'STARTING':
      // Transient. Poll, do not restart. Restarting a STARTING session is how
      // you get a restart loop that never reaches WORKING.
      return { healthy: false, canSend: false, needsQr: false, needsHuman: false, reason: 'starting', transient: true }

    case 'STOPPED':
      return { healthy: false, canSend: false, needsQr: false, needsHuman: false, reason: 'stopped', restartable: true }

    case 'FAILED':
      // Container level problem. Never auto retry into this, and never auto
      // logout, which would destroy a pairing that may still be fine.
      return { healthy: false, canSend: false, needsQr: false, needsHuman: true, reason: 'failed' }

    default:
      // Unknown is not false. An unrecognised status might be a new WAHA state,
      // so refuse to send but do not declare the session dead.
      return { healthy: false, canSend: false, needsQr: false, needsHuman: true, reason: `unknown_status:${status}` }
  }
}

// ─── Send window ───

// Cold outreach at 3am reads as automation to a human and as a pattern to
// WhatsApp. Hours are evaluated in the user's timezone, not the server's, which
// on Vercel or a VPS is almost never the one that matters.
const currentHourIn = (date, timezone) => {
  try {
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false
    }).format(date)

    return Number(formatted)
  } catch {
    // An invalid timezone string must not silently become UTC, because that
    // shifts the whole send window by hours without anyone noticing.
    return null
  }
}

const isWithinSendWindow = (date, options = {}) => {
  const {
    windowStartHour = DEFAULTS.windowStartHour,
    windowEndHour = DEFAULTS.windowEndHour,
    timezone = DEFAULTS.timezone
  } = options

  const hour = currentHourIn(date, timezone)
  if (hour === null) return { allowed: false, reason: 'bad_timezone' }

  const allowed = hour >= windowStartHour && hour < windowEndHour

  return { allowed, hour, reason: allowed ? 'in_window' : 'outside_window' }
}

// How long until the window opens again, so the worker can sleep instead of
// waking every minute to be told no.
const msUntilWindowOpens = (date, options = {}) => {
  const {
    windowStartHour = DEFAULTS.windowStartHour,
    windowEndHour = DEFAULTS.windowEndHour,
    timezone = DEFAULTS.timezone
  } = options

  const hour = currentHourIn(date, timezone)
  if (hour === null) return 60 * 60 * 1000

  if (hour >= windowStartHour && hour < windowEndHour) return 0

  const hoursUntil = hour < windowStartHour ? windowStartHour - hour : 24 - hour + windowStartHour

  return hoursUntil * 60 * 60 * 1000
}

// ─── Pacing ───

// Jitter is injectable so tests are deterministic. A fixed gap between sends is
// a fingerprint: 45s exactly, 40 times a day, is obviously not a person.
const nextSendDelay = (options = {}) => {
  const {
    lastSentAt = null,
    now = new Date(),
    minGapMs = DEFAULTS.minGapMs,
    jitterMs = DEFAULTS.jitterMs,
    random = Math.random
  } = options

  const jitter = Math.floor(random() * jitterMs)

  if (!lastSentAt) return jitter

  const elapsed = now.getTime() - new Date(lastSentAt).getTime()
  const remaining = minGapMs - elapsed

  return remaining > 0 ? remaining + jitter : jitter
}

// A number in its first week sends far less. Warmup is the cheapest protection
// against a restriction there is.
const effectiveDailyCap = (options = {}) => {
  const {
    sessionCreatedAt = null,
    now = new Date(),
    dailyCap = DEFAULTS.dailyCap,
    warmupDailyCap = DEFAULTS.warmupDailyCap,
    warmupDays = DEFAULTS.warmupDays,
    consecutiveFailures = 0
  } = options

  let cap = dailyCap

  if (sessionCreatedAt) {
    const ageDays = (now.getTime() - new Date(sessionCreatedAt).getTime()) / (24 * 60 * 60 * 1000)
    if (ageDays < warmupDays) {
      // Ramp linearly from the warmup cap to the full cap across the window.
      const progress = Math.max(0, ageDays) / warmupDays
      cap = Math.round(warmupDailyCap + (dailyCap - warmupDailyCap) * progress)
    }
  }

  // Back off, never escalate. Each consecutive failure halves the day's budget.
  if (consecutiveFailures > 0) {
    cap = Math.max(1, Math.floor(cap / Math.pow(2, Math.min(consecutiveFailures, 5))))
  }

  return cap
}

// Growing pause after failures, capped so a session is never parked forever.
const backoffAfterFailure = (consecutiveFailures, baseMs = 60000) => {
  if (consecutiveFailures <= 0) return 0
  const capped = Math.min(consecutiveFailures, 6)
  return Math.min(baseMs * Math.pow(2, capped - 1), 6 * 60 * 60 * 1000)
}

// ─── The one call the worker makes ───

// Returns a single decision so the worker does not reimplement this ordering and
// quietly get it wrong. Order matters: cheap local checks before anything that
// costs a round trip, and hard blocks before soft ones.
const canSendNow = (input = {}) => {
  const {
    session = {},
    sentToday = 0,
    now = new Date(),
    lastSentAt = null,
    random = Math.random,
    overrides = {}
  } = input

  const opts = { ...DEFAULTS, ...overrides, ...(session.limits || {}) }

  if (session.pausedByUser === true) {
    return { allowed: false, reason: 'paused_by_user', retryInMs: null }
  }

  const health = classifySessionStatus(session.status)

  if (health.needsHuman) {
    // Never automate past this. A human decides whether the container is sick.
    return { allowed: false, reason: health.reason, needsHuman: true, retryInMs: null }
  }

  if (health.needsQr) {
    return { allowed: false, reason: 'awaiting_qr_scan', needsQr: true, retryInMs: null }
  }

  if (!health.canSend) {
    return { allowed: false, reason: health.reason, retryInMs: health.transient ? 15000 : 60000 }
  }

  const window = isWithinSendWindow(now, opts)
  if (!window.allowed) {
    return { allowed: false, reason: window.reason, retryInMs: msUntilWindowOpens(now, opts) }
  }

  const cap = effectiveDailyCap({
    sessionCreatedAt: session.createdAt,
    now,
    consecutiveFailures: session.consecutiveFailures || 0,
    ...opts
  })

  if (sentToday >= cap) {
    return { allowed: false, reason: 'daily_cap_reached', cap, sentToday, retryInMs: msUntilWindowOpens(now, opts) || 60 * 60 * 1000 }
  }

  if (session.consecutiveFailures > 0) {
    const pause = backoffAfterFailure(session.consecutiveFailures)
    const since = lastSentAt ? now.getTime() - new Date(lastSentAt).getTime() : Infinity

    if (since < pause) {
      return { allowed: false, reason: 'backing_off', retryInMs: pause - since }
    }
  }

  const delay = nextSendDelay({ lastSentAt, now, minGapMs: opts.minGapMs, jitterMs: opts.jitterMs, random })

  if (delay > 0) {
    return { allowed: false, reason: 'throttled', retryInMs: delay }
  }

  return { allowed: true, reason: 'ok', cap, sentToday }
}

module.exports = {
  DEFAULTS,
  classifySessionStatus,
  isWithinSendWindow,
  msUntilWindowOpens,
  nextSendDelay,
  effectiveDailyCap,
  backoffAfterFailure,
  canSendNow
}
