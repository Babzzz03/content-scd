const crypto = require('node:crypto')

const WhatsAppSession = require('../models/WhatsAppSession')
const Conversation = require('../models/Conversation')
const Message = require('../models/Message')
const waha = require('./waha.service')
const { detectOptOut } = require('../utils/optOut')

// ─── Inbound WhatsApp ───
//
// Everything WAHA pushes to us: replies and session status changes.
//
// This endpoint is public, so it is the one place an attacker can reach without
// a login. It verifies an HMAC before trusting a single field.

// ─── Verification ───

// timingSafeEqual throws on length mismatch, which itself leaks information, so
// the lengths are compared first and the result is constant time from there.
const verifySignature = (rawBody, signature, secret) => {
  if (!secret) return { ok: false, reason: 'no_secret_configured' }
  if (!signature) return { ok: false, reason: 'no_signature' }

  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')

  const a = Buffer.from(String(signature))
  const b = Buffer.from(expected)

  if (a.length !== b.length) return { ok: false, reason: 'bad_signature' }

  return crypto.timingSafeEqual(a, b) ? { ok: true } : { ok: false, reason: 'bad_signature' }
}

// ─── Events ───

const handleMessage = async (session, payload) => {
  const chatId = payload.from
  if (!chatId) return { handled: false, reason: 'no_from' }

  // Groups are not outreach. Ignoring them here keeps group chatter out of the
  // inbox entirely rather than filtering it in the UI later.
  if (String(chatId).endsWith('@g.us')) return { handled: false, reason: 'group_message' }

  // WAHA echoes our own sends back. Recording them would double every outbound
  // message in the thread.
  if (payload.fromMe === true) return { handled: false, reason: 'own_message' }

  const phoneNumber = waha.fromChatId(chatId)
  const body = payload.body || ''

  let conversation = await Conversation.findOne({ user: session.user, channel: 'whatsapp', chatId })

  if (!conversation) {
    // An inbound from a number we never messaged. Still worth a thread: it is
    // usually someone replying from a second number, or a referral.
    conversation = await Conversation.create({
      user: session.user,
      channel: 'whatsapp',
      chatId,
      phoneNumber,
      displayName: payload.notifyName || payload._data?.notifyName || null
    })
  }

  // Dedupe on WAHA's id. The unique sparse index is the real guarantee, but
  // checking first avoids a thrown duplicate key error on every redelivery.
  const externalId = payload.id?._serialized || payload.id || null

  if (externalId) {
    const existing = await Message.findOne({ user: session.user, externalId })
    if (existing) return { handled: false, reason: 'duplicate' }
  }

  await Message.create({
    user: session.user,
    conversation: conversation._id,
    direction: 'in',
    body,
    status: 'received',
    author: 'contact',
    externalId,
    lead: conversation.lead || null,
    sentAt: payload.timestamp ? new Date(payload.timestamp * 1000) : new Date()
  })

  conversation.recordInbound(new Date())

  // ─── STOP enforcement ───
  const optOut = detectOptOut(body)

  if (optOut.optedOut) {
    conversation.markOptedOut(`whatsapp_reply:${optOut.matched}`)

    // Cancel anything already queued for this contact. Without this, a message
    // queued sixty seconds ago still goes out after they said stop, which is the
    // exact failure the opt out rule exists to prevent.
    await Message.updateMany(
      { conversation: conversation._id, direction: 'out', status: 'queued' },
      { $set: { status: 'failed', failureCode: 'OPTED_OUT', failureMessage: 'contact opted out' } }
    )

    // Propagate to the Lead so every other campaign sees it too. Loaded lazily
    // to avoid a circular import at module load.
    if (conversation.lead) {
      const Lead = require('../models/Lead')
      await Lead.updateOne({ _id: conversation.lead }, { $set: { optedOut: true, optedOutAt: new Date() } })
    }

    console.log(`[whatsapp] opt out recorded conversation=${conversation._id} matched=${optOut.matched}`)
  }

  await conversation.save()

  return { handled: true, conversationId: conversation._id, optedOut: optOut.optedOut }
}

const handleSessionStatus = async (session, payload) => {
  const status = payload.status || 'UNKNOWN'

  session.status = ['STOPPED', 'STARTING', 'SCAN_QR_CODE', 'WORKING', 'FAILED'].includes(status) ? status : 'UNKNOWN'
  session.statusCheckedAt = new Date()

  // A session that comes back WORKING has recovered. Clearing the failure
  // counter here is safe and necessary: without it a session that recovered on
  // its own stays throttled by a backoff that no longer applies.
  //
  // requiresHumanReview is deliberately NOT cleared. That one is a person's
  // decision, because the thing that set it was not a transient fault.
  if (session.status === 'WORKING') {
    session.consecutiveFailures = 0
    session.lastFailureCode = null
  }

  if (session.status === 'FAILED') {
    session.requiresHumanReview = true
    session.humanReviewReason = 'WAHA reported session FAILED'
  }

  await session.save()

  return { handled: true, status: session.status }
}

// ─── Entry point ───

const handleWebhook = async ({ rawBody, signature, body }) => {
  const verified = verifySignature(rawBody, signature, process.env.WAHA_WEBHOOK_HMAC_KEY)

  if (!verified.ok) {
    console.error(`[whatsapp] webhook rejected reason=${verified.reason}`)
    return { ok: false, status: 401, reason: verified.reason }
  }

  const sessionName = body.session
  if (!sessionName) return { ok: false, status: 400, reason: 'no_session' }

  const session = await WhatsAppSession.findOne({ sessionName })
  if (!session) return { ok: false, status: 404, reason: 'unknown_session' }

  switch (body.event) {
    case 'message':
      return { ok: true, status: 200, result: await handleMessage(session, body.payload || {}) }

    case 'session.status':
      return { ok: true, status: 200, result: await handleSessionStatus(session, body.payload || {}) }

    default:
      // Unknown is not false. An unrecognised event is acknowledged so WAHA does
      // not retry it forever, but it is logged so a new event type surfaces.
      console.log(`[whatsapp] unhandled event=${body.event}`)
      return { ok: true, status: 200, result: { handled: false, reason: 'unhandled_event' } }
  }
}

module.exports = { handleWebhook, verifySignature, handleMessage, handleSessionStatus }
