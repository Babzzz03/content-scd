// ─── WAHA client ───
//
// Thin HTTP wrapper around a self hosted WAHA instance, which is what actually
// holds the WhatsApp Web session. WAHA runs as a Docker container on a VPS, not
// on Vercel, because it keeps a long lived browser session that serverless
// cannot host. See docs/WHATSAPP_CHANNEL.md.
//
// Deliberately free of mongoose. Everything here is request in, response out,
// which is what makes it testable without a database and what keeps session
// state decisions in whatsappHealth.service.js instead of tangled in transport.
//
// WAHA's route names have shifted between major versions. Every path lives in
// ROUTES below so a version bump is one edit, not a search across the codebase.

const DEFAULT_TIMEOUT_MS = 15000
const MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 600

// ─── Config ───

// Lazy, so a test that sets env after require still sees it.
const config = () => ({
  baseUrl: (process.env.WAHA_URL || '').replace(/\/+$/, ''),
  apiKey: process.env.WAHA_API_KEY || '',
  timeoutMs: Number(process.env.WAHA_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
})

const isConfigured = () => {
  const { baseUrl, apiKey } = config()
  return Boolean(baseUrl && apiKey)
}

const ROUTES = {
  sessionCreate: () => '/api/sessions',
  sessionStart: name => `/api/sessions/${encodeURIComponent(name)}/start`,
  sessionStop: name => `/api/sessions/${encodeURIComponent(name)}/stop`,
  sessionLogout: name => `/api/sessions/${encodeURIComponent(name)}/logout`,
  sessionGet: name => `/api/sessions/${encodeURIComponent(name)}`,
  sessionMe: name => `/api/sessions/${encodeURIComponent(name)}/me`,
  qr: name => `/api/${encodeURIComponent(name)}/auth/qr?format=image`,
  sendText: () => '/api/sendText',
  sendImage: () => '/api/sendImage',
  startTyping: () => '/api/startTyping',
  stopTyping: () => '/api/stopTyping',
  checkExists: (session, phone) =>
    `/api/contacts/check-exists?session=${encodeURIComponent(session)}&phone=${encodeURIComponent(phone)}`
}

// ─── Chat ids ───

// WhatsApp addresses individuals as <number>@c.us and groups as <id>@g.us.
// The number must already carry its country code. A local format like 0803...
// resolves to nothing and WAHA returns a success for a message that never
// existed, which is the worst possible failure mode here.
const toChatId = phone => {
  if (!phone) return null
  if (typeof phone === 'string' && phone.includes('@')) return phone

  const digits = String(phone).replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return null

  return `${digits}@c.us`
}

const fromChatId = chatId => (chatId ? String(chatId).split('@')[0] : null)

// ─── Transport ───

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// Retry transport failures and server faults only. A 401 means the API key is
// wrong and a 422 means the payload is, and retrying either just buries the real
// error under two more identical lines in the log.
const isRetryable = status => status === 429 || status === 408 || (status >= 500 && status <= 599)

const request = async (method, path, body = null, options = {}) => {
  const { baseUrl, apiKey, timeoutMs } = config()
  const maxAttempts = options.maxAttempts || MAX_ATTEMPTS

  if (!isConfigured()) {
    return { ok: false, status: null, error: { code: 'NOT_CONFIGURED', message: 'WAHA_URL or WAHA_API_KEY missing' } }
  }

  let lastError = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      })

      if (response.ok) {
        const data = await response.json().catch(() => ({}))
        return { ok: true, status: response.status, data, attempts: attempt }
      }

      const text = await response.text().catch(() => '')
      lastError = { status: response.status, code: `HTTP_${response.status}`, message: text.slice(0, 300) }

      // Log the code every time. A catch that treats a status as "expected" is
      // exactly how the stale index bug hid for a week.
      console.error(`[waha] ${method} ${path} failed status=${response.status} attempt=${attempt} body=${lastError.message}`)

      if (!isRetryable(response.status)) {
        return { ok: false, status: response.status, error: lastError, attempts: attempt, retryable: false }
      }
    } catch (err) {
      const code = err.name === 'AbortError' ? 'TIMEOUT' : err.code || 'NETWORK'
      lastError = { status: null, code, message: err.message }
      console.error(`[waha] ${method} ${path} threw code=${code} attempt=${attempt} message=${err.message}`)
    } finally {
      // Must be in finally. An early return skips a trailing clearTimeout and
      // the pending timer holds the event loop open for the whole timeout.
      clearTimeout(timer)
    }

    if (attempt < maxAttempts) {
      // Back off, never escalate. A struggling WAHA container recovers faster if
      // we stop hammering it.
      await sleep(BASE_BACKOFF_MS * Math.pow(2, attempt - 1))
    }
  }

  return { ok: false, status: lastError?.status ?? null, error: lastError, attempts: maxAttempts, retryable: true }
}

// ─── Session lifecycle ───

// Session names are namespaced per user so two PostFlow accounts can never
// collide on one WAHA instance.
const sessionNameFor = userId => `postflow_${String(userId)}`

const createSession = async (sessionName, options = {}) => {
  const body = {
    name: sessionName,
    start: true,
    config: {
      // NOWEB is lighter than the browser engines and is what DeskcommCRM runs
      // in production. It does not render a page, so it survives a small VPS.
      metadata: { source: 'postflow' },
      ...(options.webhookUrl
        ? {
            webhooks: [
              {
                url: options.webhookUrl,
                events: ['message', 'session.status'],
                ...(options.webhookHmacKey ? { hmac: { key: options.webhookHmacKey } } : {})
              }
            ]
          }
        : {})
    }
  }

  return request('POST', ROUTES.sessionCreate(), body, options)
}

const startSession = (sessionName, options = {}) => request('POST', ROUTES.sessionStart(sessionName), null, options)
const stopSession = (sessionName, options = {}) => request('POST', ROUTES.sessionStop(sessionName), null, options)

// Logout destroys the pairing. The user has to scan a fresh QR afterwards, so
// never call this as part of an error recovery path.
const logoutSession = (sessionName, options = {}) => request('POST', ROUTES.sessionLogout(sessionName), null, options)

const getSession = (sessionName, options = {}) => request('GET', ROUTES.sessionGet(sessionName), null, options)
const getMe = (sessionName, options = {}) => request('GET', ROUTES.sessionMe(sessionName), null, options)

// Returns the QR as a data URL the frontend can render directly in an <img>.
const getQrCode = async (sessionName, options = {}) => {
  const { baseUrl, apiKey, timeoutMs } = config()

  if (!isConfigured()) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'WAHA_URL or WAHA_API_KEY missing' } }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${baseUrl}${ROUTES.qr(sessionName)}`, {
      headers: { 'X-Api-Key': apiKey },
      signal: controller.signal
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error(`[waha] qr fetch failed status=${response.status} body=${text.slice(0, 200)}`)
      return { ok: false, status: response.status, error: { code: `HTTP_${response.status}`, message: text.slice(0, 300) } }
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const mime = response.headers.get('content-type') || 'image/png'

    return { ok: true, status: response.status, dataUrl: `data:${mime};base64,${buffer.toString('base64')}` }
  } catch (err) {
    const code = err.name === 'AbortError' ? 'TIMEOUT' : err.code || 'NETWORK'
    console.error(`[waha] qr fetch threw code=${code} message=${err.message}`)
    return { ok: false, status: null, error: { code, message: err.message } }
  } finally {
    clearTimeout(timer)
  }
}

// ─── Sending ───

// Whether a number is actually on WhatsApp. Google Maps listings give landlines
// and dead mobiles freely, and sending to one burns send budget for nothing.
// Unknown is not false: if the check itself fails we return null, and the caller
// must treat that as "could not evaluate" rather than "not on WhatsApp".
const checkNumberExists = async (sessionName, phone, options = {}) => {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return { ok: false, exists: null, error: { code: 'BAD_PHONE', message: 'empty phone' } }

  const result = await request('GET', ROUTES.checkExists(sessionName, digits), null, options)
  if (!result.ok) return { ok: false, exists: null, error: result.error }

  const exists = result.data?.numberExists
  return { ok: true, exists: typeof exists === 'boolean' ? exists : null, chatId: result.data?.chatId || null }
}

const sendText = async (sessionName, phone, text, options = {}) => {
  const chatId = toChatId(phone)

  if (!chatId) {
    return { ok: false, error: { code: 'BAD_PHONE', message: `cannot build chatId from ${phone}` } }
  }

  if (!text || !String(text).trim()) {
    return { ok: false, error: { code: 'EMPTY_MESSAGE', message: 'refusing to send an empty message' } }
  }

  const result = await request('POST', ROUTES.sendText(), { session: sessionName, chatId, text: String(text) }, options)

  if (!result.ok) return result

  return {
    ok: true,
    status: result.status,
    chatId,
    messageId: result.data?.id?._serialized || result.data?.id || null,
    attempts: result.attempts
  }
}

const sendImage = async (sessionName, phone, imageUrl, caption = '', options = {}) => {
  const chatId = toChatId(phone)
  if (!chatId) return { ok: false, error: { code: 'BAD_PHONE', message: `cannot build chatId from ${phone}` } }

  return request(
    'POST',
    ROUTES.sendImage(),
    { session: sessionName, chatId, file: { url: imageUrl }, caption: String(caption || '') },
    options
  )
}

// Typing indicators make outreach read as human rather than as a bot burst.
// Failures here are cosmetic, so they are logged and swallowed on purpose, which
// is the one place in this file where swallowing is correct.
const showTyping = async (sessionName, phone, durationMs = 2000) => {
  const chatId = toChatId(phone)
  if (!chatId) return { ok: false }

  await request('POST', ROUTES.startTyping(), { session: sessionName, chatId }, { maxAttempts: 1 })
  await sleep(durationMs)
  await request('POST', ROUTES.stopTyping(), { session: sessionName, chatId }, { maxAttempts: 1 })

  return { ok: true }
}

module.exports = {
  isConfigured,
  sessionNameFor,
  toChatId,
  fromChatId,
  createSession,
  startSession,
  stopSession,
  logoutSession,
  getSession,
  getMe,
  getQrCode,
  checkNumberExists,
  sendText,
  sendImage,
  showTyping,
  ROUTES
}
