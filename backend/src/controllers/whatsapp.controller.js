const WhatsAppSession = require('../models/WhatsAppSession')
const Conversation = require('../models/Conversation')
const Message = require('../models/Message')
const waha = require('../services/waha.service')
const send = require('../services/whatsappSend.service')
const inbound = require('../services/whatsappInbound.service')
const health = require('../services/whatsappHealth.service')

// ─── WhatsApp controller ───
//
// The response envelope matches PostFlow's { success, message, data } contract.
// The helpers below build it locally so this file has no import that might not
// resolve. Swap them for utils/apiResponse.js once you confirm its signature.

const ok = (res, data = null, message = 'OK') => res.status(200).json({ success: true, message, data })
const fail = (res, status, message, data = null) => res.status(status).json({ success: false, message, data })

// ─── Connect ───

// Creates the WAHA session if needed and returns a QR code to scan. Safe to call
// repeatedly: a user who lets the QR expire just calls it again.
const connect = async (req, res) => {
  const userId = req.user.id || req.user._id
  const sessionName = waha.sessionNameFor(userId)

  if (!waha.isConfigured()) {
    return fail(res, 503, 'WhatsApp is not configured on this server')
  }

  let session = await WhatsAppSession.findOne({ user: userId })

  if (!session) {
    session = await WhatsAppSession.create({ user: userId, sessionName })
  }

  // A session needing human review must not be restarted by a user clicking
  // connect again. Whatever is wrong is not fixed by another QR code.
  if (session.requiresHumanReview) {
    return fail(res, 409, 'This connection needs support to look at it', { reason: session.humanReviewReason })
  }

  const webhookUrl = process.env.WAHA_WEBHOOK_URL || null

  const created = await waha.createSession(sessionName, {
    webhookUrl,
    webhookHmacKey: process.env.WAHA_WEBHOOK_HMAC_KEY
  })

  // Already exists is the normal case on a reconnect, not an error.
  if (!created.ok && created.status !== 409 && created.status !== 422) {
    return fail(res, 502, 'Could not reach the WhatsApp service', created.error)
  }

  await waha.startSession(sessionName)

  const qr = await waha.getQrCode(sessionName)

  if (!qr.ok) {
    // Not necessarily a failure. A session already paired has no QR to give.
    const current = await waha.getSession(sessionName)
    const status = current.data?.status || 'UNKNOWN'

    session.status = status
    session.statusCheckedAt = new Date()
    await session.save()

    if (status === 'WORKING') return ok(res, { status, alreadyConnected: true }, 'Already connected')

    return fail(res, 502, 'Could not get a QR code', qr.error)
  }

  session.status = 'SCAN_QR_CODE'
  session.statusCheckedAt = new Date()
  await session.save()

  return ok(res, { qr: qr.dataUrl, status: 'SCAN_QR_CODE' }, 'Scan this with WhatsApp on your phone')
}

// ─── Status ───

const status = async (req, res) => {
  const userId = req.user.id || req.user._id

  const session = await WhatsAppSession.findOne({ user: userId })

  if (!session) return ok(res, { connected: false, status: 'NOT_SET_UP' })

  // Ask WAHA rather than trusting our mirror, which goes stale whenever a
  // webhook is missed.
  const live = await waha.getSession(session.sessionName)

  if (live.ok) {
    const liveStatus = live.data?.status || 'UNKNOWN'
    session.status = ['STOPPED', 'STARTING', 'SCAN_QR_CODE', 'WORKING', 'FAILED'].includes(liveStatus) ? liveStatus : 'UNKNOWN'
    session.statusCheckedAt = new Date()

    if (session.status === 'WORKING' && !session.phoneNumber) {
      const me = await waha.getMe(session.sessionName)
      if (me.ok) {
        session.phoneNumber = waha.fromChatId(me.data?.id) || null
        session.pushName = me.data?.pushName || null
      }
    }

    await session.save()
  }

  const classified = health.classifySessionStatus(session.status)
  const queued = await send.queueDepth(userId)

  return ok(res, {
    connected: classified.healthy,
    status: session.status,
    phoneNumber: session.phoneNumber,
    needsQr: classified.needsQr,
    needsHuman: classified.needsHuman || session.requiresHumanReview,
    pausedByUser: session.pausedByUser,
    sentToday: session.sentTodayCount(),
    dailyCap: health.effectiveDailyCap({
      sessionCreatedAt: session.createdAt,
      consecutiveFailures: session.consecutiveFailures,
      ...session.limits
    }),
    queuedMessages: queued
  })
}

// ─── Pause and disconnect ───

const pause = async (req, res) => {
  const userId = req.user.id || req.user._id
  const paused = req.body?.paused !== false

  const session = await WhatsAppSession.findOneAndUpdate({ user: userId }, { $set: { pausedByUser: paused } }, { new: true })

  if (!session) return fail(res, 404, 'No WhatsApp connection found')

  return ok(res, { pausedByUser: session.pausedByUser }, paused ? 'Sending paused' : 'Sending resumed')
}

// Logout destroys the pairing, so it is only ever reached by an explicit user
// action, never by error recovery.
const disconnect = async (req, res) => {
  const userId = req.user.id || req.user._id

  const session = await WhatsAppSession.findOne({ user: userId })
  if (!session) return fail(res, 404, 'No WhatsApp connection found')

  await waha.logoutSession(session.sessionName)
  await waha.stopSession(session.sessionName)

  session.status = 'STOPPED'
  session.phoneNumber = null
  session.clearHealthFlags()
  await session.save()

  return ok(res, { status: 'STOPPED' }, 'Disconnected')
}

// ─── Sending ───

// Queues only. Nothing in the request path ever calls WAHA directly, because a
// send that bypasses the queue also bypasses every rate limit protecting the
// number.
const queueSend = async (req, res) => {
  const userId = req.user.id || req.user._id
  const { phone, text, leadId } = req.body || {}

  if (!phone || !text) return fail(res, 422, 'phone and text are required')

  const result = await send.queueMessage({ userId, phone, text, leadId, author: req.body.author || 'human' })

  if (!result.ok) {
    const status = result.skipped === 'opted_out' ? 409 : 422
    return fail(res, status, `Not queued: ${result.skipped}`, result)
  }

  return ok(res, result, 'Queued')
}

// ─── Inbox ───

const listConversations = async (req, res) => {
  const userId = req.user.id || req.user._id
  const limit = Math.min(Number(req.query.limit) || 30, 100)

  const conversations = await Conversation.find({ user: userId, channel: 'whatsapp' })
    .sort({ lastMessageAt: -1 })
    .limit(limit)
    .populate('lead', 'name source externalId')

  return ok(res, { conversations })
}

const listMessages = async (req, res) => {
  const userId = req.user.id || req.user._id
  const limit = Math.min(Number(req.query.limit) || 50, 200)

  const conversation = await Conversation.findOne({ _id: req.params.id, user: userId })
  if (!conversation) return fail(res, 404, 'Conversation not found')

  const messages = await Message.find({ conversation: conversation._id }).sort({ createdAt: -1 }).limit(limit)

  conversation.unreadCount = 0
  await conversation.save()

  return ok(res, { conversation, messages: messages.reverse() })
}

// ─── Webhook ───

// Public. Needs express.raw on this route so the HMAC is computed over the exact
// bytes WAHA signed, not over a re-serialised object.
const webhook = async (req, res) => {
  const rawBody = req.rawBody || (Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body))
  const signature = req.get('X-Webhook-Hmac') || req.get('x-webhook-hmac')

  let parsed
  try {
    parsed = Buffer.isBuffer(req.body) ? JSON.parse(rawBody) : req.body
  } catch {
    return fail(res, 400, 'Invalid JSON')
  }

  const result = await inbound.handleWebhook({ rawBody, signature, body: parsed })

  if (!result.ok) return fail(res, result.status, result.reason)

  return ok(res, result.result)
}

module.exports = {
  connect,
  status,
  pause,
  disconnect,
  queueSend,
  listConversations,
  listMessages,
  webhook
}
