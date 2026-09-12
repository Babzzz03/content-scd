// ─── WhatsApp channel tests ───
//
//   node --test backend/src/services/__tests__/whatsapp.test.js
//
// No network, no database, no npm install. Only the three pure modules are
// covered here, which is on purpose: the rules that protect a user's WhatsApp
// number belong somewhere they can be tested cheaply and often. Everything that
// touches mongoose is exercised by test_whatsapp.js against a real instance.

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const SERVICES = path.join(__dirname, '..')
const UTILS = path.join(__dirname, '..', '..', 'utils')

const health = require(path.join(SERVICES, 'whatsappHealth.service.js'))
const { detectOptOut } = require(path.join(UTILS, 'optOut.js'))

const loadWaha = (env = {}) => {
  const p = path.join(SERVICES, 'waha.service.js')
  delete require.cache[require.resolve(p)]

  process.env.WAHA_URL = 'https://wa.example.com'
  process.env.WAHA_API_KEY = 'key_test'
  process.env.WAHA_TIMEOUT_MS = '200'

  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }

  return require(p)
}

const mockFetch = responses => {
  const calls = []
  const queue = Array.isArray(responses) ? [...responses] : [responses]

  global.fetch = async (url, init) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null })
    const next = queue.length > 1 ? queue.shift() : queue[0]

    if (next instanceof Error) throw next

    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.body || {},
      text: async () => JSON.stringify(next.body || {})
    }
  }

  return calls
}

const silence = () => {
  const e = console.error
  const l = console.log
  const w = console.warn
  console.error = () => {}
  console.log = () => {}
  console.warn = () => {}
  return () => {
    console.error = e
    console.log = l
    console.warn = w
  }
}

const workingSession = (overrides = {}) => ({
  status: 'WORKING',
  createdAt: new Date('2020-01-01'),
  consecutiveFailures: 0,
  pausedByUser: false,
  limits: {},
  ...overrides
})

// Fixed point inside the default 09:00-18:00 Lagos window.
const inWindow = new Date('2026-03-10T12:00:00+01:00')
const outOfWindow = new Date('2026-03-10T04:00:00+01:00')

// ─── Chat ids ───

test('toChatId builds a WhatsApp individual address', () => {
  const waha = loadWaha()
  assert.equal(waha.toChatId('2348031234567'), '2348031234567@c.us')
  assert.equal(waha.toChatId('+234 803 123 4567'), '2348031234567@c.us')
})

test('toChatId passes through an address that is already built', () => {
  const waha = loadWaha()
  assert.equal(waha.toChatId('2348031234567@c.us'), '2348031234567@c.us')
  assert.equal(waha.toChatId('12036543210@g.us'), '12036543210@g.us')
})

test('toChatId refuses a number too short to be real', () => {
  const waha = loadWaha()
  // A local format silently resolves to nothing and WAHA reports success for a
  // message that never existed, so this must fail loudly and early.
  assert.equal(waha.toChatId('0803'), null)
  assert.equal(waha.toChatId(''), null)
  assert.equal(waha.toChatId(null), null)
})

test('fromChatId strips the suffix', () => {
  const waha = loadWaha()
  assert.equal(waha.fromChatId('2348031234567@c.us'), '2348031234567')
  assert.equal(waha.fromChatId(null), null)
})

// ─── Client ───

test('sendText posts the session, chatId and text', async () => {
  const restore = silence()
  const waha = loadWaha()
  const calls = mockFetch({ status: 200, body: { id: { _serialized: 'msg_1' } } })

  const result = await waha.sendText('postflow_u1', '2348031234567', 'hello')

  assert.equal(result.ok, true)
  assert.equal(result.messageId, 'msg_1')
  assert.equal(calls[0].url, 'https://wa.example.com/api/sendText')
  assert.equal(calls[0].init.headers['X-Api-Key'], 'key_test')
  assert.deepEqual(calls[0].body, { session: 'postflow_u1', chatId: '2348031234567@c.us', text: 'hello' })
  restore()
})

test('sendText refuses an empty message without calling the API', async () => {
  const waha = loadWaha()
  const calls = mockFetch({ status: 200 })

  const result = await waha.sendText('postflow_u1', '2348031234567', '   ')

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'EMPTY_MESSAGE')
  assert.equal(calls.length, 0)
})

test('client reports missing configuration instead of calling a bad URL', async () => {
  const waha = loadWaha({ WAHA_API_KEY: undefined })
  const calls = mockFetch({ status: 200 })

  const result = await waha.sendText('postflow_u1', '2348031234567', 'hi')

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'NOT_CONFIGURED')
  assert.equal(calls.length, 0)
})

test('client retries a 500 and does not retry a 401', async () => {
  const restore = silence()
  const waha = loadWaha()

  const retried = mockFetch([{ status: 500 }, { status: 200, body: { id: 'm' } }])
  const okResult = await waha.sendText('s', '2348031234567', 'hi')
  assert.equal(okResult.ok, true)
  assert.equal(retried.length, 2)

  const notRetried = mockFetch({ status: 401, body: { message: 'bad key' } })
  const failResult = await waha.sendText('s', '2348031234567', 'hi')
  assert.equal(failResult.ok, false)
  assert.equal(failResult.retryable, false)
  assert.equal(notRetried.length, 1)

  restore()
})

test('checkNumberExists returns null rather than false when it cannot tell', async () => {
  const restore = silence()
  const waha = loadWaha()
  mockFetch({ status: 500 })

  const result = await waha.checkNumberExists('s', '2348031234567')

  // Unknown is not false. Treating a failed check as "not on WhatsApp" would
  // silently empty the funnel every time the API throttled.
  assert.equal(result.exists, null)
  restore()
})

test('checkNumberExists reports a real negative as false', async () => {
  const waha = loadWaha()
  mockFetch({ status: 200, body: { numberExists: false } })

  const result = await waha.checkNumberExists('s', '2348031234567')

  assert.equal(result.ok, true)
  assert.equal(result.exists, false)
})

// ─── Session status ───

test('classifySessionStatus separates a QR prompt from a container failure', () => {
  const qr = health.classifySessionStatus('SCAN_QR_CODE')
  const failed = health.classifySessionStatus('FAILED')

  // These look equally broken on a dashboard and need opposite remedies.
  assert.equal(qr.needsQr, true)
  assert.equal(qr.needsHuman, false)
  assert.equal(failed.needsQr, false)
  assert.equal(failed.needsHuman, true)
})

test('classifySessionStatus treats STARTING as transient, not broken', () => {
  const result = health.classifySessionStatus('STARTING')
  assert.equal(result.transient, true)
  assert.equal(result.needsHuman, false)
})

test('classifySessionStatus refuses to send on an unrecognised status', () => {
  const result = health.classifySessionStatus('SOMETHING_NEW')
  assert.equal(result.canSend, false)
  assert.match(result.reason, /unknown_status/)
})

// ─── Send window ───

test('isWithinSendWindow uses the configured timezone, not the server clock', () => {
  assert.equal(health.isWithinSendWindow(inWindow).allowed, true)
  assert.equal(health.isWithinSendWindow(outOfWindow).allowed, false)
})

test('isWithinSendWindow refuses rather than defaulting to UTC on a bad timezone', () => {
  const result = health.isWithinSendWindow(inWindow, { timezone: 'Not/AZone' })
  // Falling back to UTC would shift the window by hours without anyone noticing.
  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'bad_timezone')
})

test('msUntilWindowOpens is zero inside the window and positive outside', () => {
  assert.equal(health.msUntilWindowOpens(inWindow), 0)
  assert.ok(health.msUntilWindowOpens(outOfWindow) > 0)
})

// ─── Pacing ───

test('nextSendDelay enforces the minimum gap between sends', () => {
  const now = new Date('2026-03-10T12:00:00Z')
  const lastSentAt = new Date('2026-03-10T11:59:50Z')

  const delay = health.nextSendDelay({ lastSentAt, now, minGapMs: 45000, jitterMs: 0, random: () => 0 })

  assert.equal(delay, 35000)
})

test('nextSendDelay adds jitter so the cadence is not a fingerprint', () => {
  const now = new Date('2026-03-10T12:00:00Z')

  const low = health.nextSendDelay({ lastSentAt: null, now, jitterMs: 30000, random: () => 0 })
  const high = health.nextSendDelay({ lastSentAt: null, now, jitterMs: 30000, random: () => 0.99 })

  assert.equal(low, 0)
  assert.ok(high > 29000)
})

test('effectiveDailyCap holds a new number to the warmup cap', () => {
  const now = new Date('2026-03-10T12:00:00Z')
  const fresh = new Date('2026-03-10T00:00:00Z')
  const old = new Date('2025-01-01T00:00:00Z')

  const freshCap = health.effectiveDailyCap({ sessionCreatedAt: fresh, now })
  const matureCap = health.effectiveDailyCap({ sessionCreatedAt: old, now })

  assert.ok(freshCap < matureCap, `warmup ${freshCap} should be under mature ${matureCap}`)
  assert.equal(matureCap, 40)
})

test('effectiveDailyCap shrinks after failures instead of holding steady', () => {
  const old = new Date('2025-01-01T00:00:00Z')
  const now = new Date('2026-03-10T12:00:00Z')

  const clean = health.effectiveDailyCap({ sessionCreatedAt: old, now, consecutiveFailures: 0 })
  const struggling = health.effectiveDailyCap({ sessionCreatedAt: old, now, consecutiveFailures: 3 })

  // Back off, never escalate.
  assert.ok(struggling < clean)
  assert.ok(struggling >= 1)
})

test('backoffAfterFailure grows but is capped', () => {
  assert.equal(health.backoffAfterFailure(0), 0)
  assert.ok(health.backoffAfterFailure(3) > health.backoffAfterFailure(1))
  assert.ok(health.backoffAfterFailure(99) <= 6 * 60 * 60 * 1000)
})

// ─── canSendNow ───

test('canSendNow allows a healthy session inside the window', () => {
  const decision = health.canSendNow({
    session: workingSession(),
    sentToday: 0,
    now: inWindow,
    lastSentAt: null,
    random: () => 0
  })

  assert.equal(decision.allowed, true)
})

test('canSendNow refuses outside the send window and says when to retry', () => {
  const decision = health.canSendNow({
    session: workingSession(),
    sentToday: 0,
    now: outOfWindow,
    random: () => 0
  })

  assert.equal(decision.allowed, false)
  assert.equal(decision.reason, 'outside_window')
  assert.ok(decision.retryInMs > 0)
})

test('canSendNow refuses when the user has paused sending', () => {
  const decision = health.canSendNow({
    session: workingSession({ pausedByUser: true }),
    sentToday: 0,
    now: inWindow,
    random: () => 0
  })

  assert.equal(decision.allowed, false)
  assert.equal(decision.reason, 'paused_by_user')
})

test('canSendNow refuses at the daily cap', () => {
  const decision = health.canSendNow({
    session: workingSession(),
    sentToday: 40,
    now: inWindow,
    random: () => 0
  })

  assert.equal(decision.allowed, false)
  assert.equal(decision.reason, 'daily_cap_reached')
})

test('canSendNow never auto-recovers a session that needs a human', () => {
  const decision = health.canSendNow({
    session: workingSession({ status: 'FAILED' }),
    sentToday: 0,
    now: inWindow,
    random: () => 0
  })

  assert.equal(decision.allowed, false)
  assert.equal(decision.needsHuman, true)
  // No retry time. A loop must not be able to wait this one out.
  assert.equal(decision.retryInMs, null)
})

test('canSendNow throttles a session that just sent', () => {
  const decision = health.canSendNow({
    session: workingSession(),
    sentToday: 1,
    now: inWindow,
    lastSentAt: new Date(inWindow.getTime() - 1000),
    random: () => 0
  })

  assert.equal(decision.allowed, false)
  assert.equal(decision.reason, 'throttled')
  assert.ok(decision.retryInMs > 0)
})

// ─── Opt out ───

test('detectOptOut catches a bare STOP', () => {
  assert.equal(detectOptOut('STOP').optedOut, true)
  assert.equal(detectOptOut('stop').optedOut, true)
  assert.equal(detectOptOut('Stop.').optedOut, true)
})

test('detectOptOut catches Nigerian Pidgin phrasings', () => {
  // The standard compliance keyword list misses every one of these.
  assert.equal(detectOptOut('abeg stop').optedOut, true)
  assert.equal(detectOptOut('no dey message me').optedOut, true)
  assert.equal(detectOptOut('I no want').optedOut, true)
  assert.equal(detectOptOut('comot').optedOut, true)
})

test('detectOptOut catches plain refusals and hostility', () => {
  assert.equal(detectOptOut('not interested').optedOut, true)
  assert.equal(detectOptOut('please remove me from your list').optedOut, true)
  assert.equal(detectOptOut('leave me alone').optedOut, true)
  assert.equal(detectOptOut('this is spam, I will report you').optedOut, true)
})

test('detectOptOut does not close a live conversation on an innocent sentence', () => {
  // "stop" appears in all of these and means nothing like an opt out.
  assert.equal(detectOptOut('stop by the shop tomorrow and we can talk').optedOut, false)
  assert.equal(detectOptOut('I will stop at the bank first then call you').optedOut, false)
  assert.equal(detectOptOut('yes I am interested, can you send prices').optedOut, false)
  assert.equal(detectOptOut('how much for the end of year package').optedOut, false)
})

test('detectOptOut names the trigger so a wrong close can be audited', () => {
  const result = detectOptOut('abeg stop sending me this')
  assert.equal(result.optedOut, true)
  assert.ok(result.matched)
})

test('detectOptOut handles empty and missing input', () => {
  assert.equal(detectOptOut('').optedOut, false)
  assert.equal(detectOptOut(null).optedOut, false)
  assert.equal(detectOptOut(undefined).optedOut, false)
})
