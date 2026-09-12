const mongoose = require('mongoose')

const WhatsAppSession = require('../models/WhatsAppSession')
const Conversation = require('../models/Conversation')
const Message = require('../models/Message')
const waha = require('./waha.service')
const health = require('./whatsappHealth.service')

// ─── WhatsApp send ───
//
// Two responsibilities: put a message in the queue, and take exactly one message
// out of it when the rules allow. Nothing here decides whether sending is safe.
// That lives in whatsappHealth.service.js, deliberately, so the rules can be
// tested without a database.
//
// The worker calls drainOne in a loop. One message per call, never a batch. A
// batch is indistinguishable from a burst from WhatsApp's side, and a burst is
// what gets a number restricted.

// ─── Enqueue ───

// Finds or creates the conversation, then queues the message. Returns the queued
// Message, or a skip reason. Never sends anything itself.
const queueMessage = async ({ userId, phone, text, leadId = null, author = 'ai', scheduledFor = null }) => {
  const chatId = waha.toChatId(phone)

  if (!chatId) {
    return { ok: false, skipped: 'bad_phone', detail: `cannot build chatId from ${phone}` }
  }

  const phoneNumber = waha.fromChatId(chatId)

  let conversation = await Conversation.findOne({ user: userId, channel: 'whatsapp', chatId })

  if (!conversation) {
    conversation = await Conversation.create({
      user: userId,
      channel: 'whatsapp',
      chatId,
      phoneNumber,
      lead: leadId || null
    })
  }

  // Opt outs are permanent and cross campaign. Checked before the message is
  // even written, so an opted out contact leaves no queued row behind for some
  // future worker to pick up after a code change.
  if (conversation.optedOut) {
    return { ok: false, skipped: 'opted_out', conversationId: conversation._id }
  }

  const message = await Message.create({
    user: userId,
    conversation: conversation._id,
    direction: 'out',
    body: text,
    status: 'queued',
    author,
    lead: leadId || conversation.lead || null,
    scheduledFor: scheduledFor || new Date()
  })

  return { ok: true, messageId: message._id, conversationId: conversation._id }
}

// ─── Drain ───

// Claims one due message atomically. findOneAndUpdate rather than find then
// save, because two worker ticks overlapping would otherwise both claim the
// same row and send it twice.
const claimNextMessage = async (userId, now) =>
  Message.findOneAndUpdate(
    {
      user: userId,
      direction: 'out',
      status: 'queued',
      scheduledFor: { $lte: now }
    },
    { $set: { status: 'sending' }, $inc: { attempts: 1 } },
    { sort: { scheduledFor: 1 }, new: true }
  )

// Sends at most one message for one user. Returns a result describing what
// happened and, when it declined, how long the worker should wait.
const drainOne = async (userId, options = {}) => {
  const now = options.now || new Date()

  const session = await WhatsAppSession.findOne({ user: userId })

  if (!session) return { sent: false, reason: 'no_session' }

  const decision = health.canSendNow({
    session,
    sentToday: session.sentTodayCount(now),
    lastSentAt: session.lastSentAt,
    now
  })

  if (!decision.allowed) {
    return { sent: false, reason: decision.reason, retryInMs: decision.retryInMs, needsQr: decision.needsQr, needsHuman: decision.needsHuman }
  }

  const message = await claimNextMessage(userId, now)

  if (!message) return { sent: false, reason: 'queue_empty' }

  // Re-check the opt out at send time. The queue can be minutes old, and a STOP
  // that arrived in between must win over a message already queued.
  const conversation = await Conversation.findById(message.conversation)

  if (!conversation || conversation.optedOut) {
    message.status = 'failed'
    message.failureCode = 'OPTED_OUT'
    message.failureMessage = 'contact opted out after this message was queued'
    await message.save()

    return { sent: false, reason: 'opted_out' }
  }

  // Typing indicator first. Cosmetic, but a message that lands with no typing
  // pause reads as a bot to a person who is watching.
  await waha.showTyping(session.sessionName, conversation.phoneNumber, 1500)

  const result = await waha.sendText(session.sessionName, conversation.phoneNumber, message.body)

  if (result.ok) {
    message.status = 'sent'
    message.sentAt = new Date()
    message.externalId = result.messageId
    await message.save()

    conversation.recordOutbound(new Date())
    await conversation.save()

    session.recordSend(new Date())
    await session.save()

    return { sent: true, messageId: message._id, externalId: result.messageId }
  }

  // Log the code every time. A failure that records only "it did not send"
  // makes the difference between a bad number and a dying session invisible.
  const code = result.error?.code || `HTTP_${result.status}`

  message.failureCode = code
  message.failureMessage = result.error?.message || 'unknown'

  // Retryable failures go back in the queue. Permanent ones do not, because
  // three attempts at a number that does not exist is three attempts wasted.
  const permanent = ['BAD_PHONE', 'EMPTY_MESSAGE', 'HTTP_404', 'HTTP_422'].includes(code)

  message.status = permanent || message.attempts >= 3 ? 'failed' : 'queued'

  if (message.status === 'queued') {
    // Back off, never escalate.
    message.scheduledFor = new Date(Date.now() + health.backoffAfterFailure(message.attempts, 30000))
  }

  await message.save()

  session.recordFailure(code, new Date())

  // Repeated failures against a session that claims to be WORKING means the
  // session is lying, and a human needs to look rather than a loop retrying.
  if (session.consecutiveFailures >= 5) {
    session.requiresHumanReview = true
    session.humanReviewReason = `${session.consecutiveFailures} consecutive send failures, last code ${code}`
  }

  await session.save()

  return { sent: false, reason: 'send_failed', code, willRetry: message.status === 'queued' }
}

// ─── Queue inspection ───

const queueDepth = async userId =>
  Message.countDocuments({
    user: new mongoose.Types.ObjectId(String(userId)),
    direction: 'out',
    status: 'queued'
  })

// Users with something waiting, so the worker does not walk every account on
// every tick. distinct casts correctly, unlike $match in an aggregation, which
// silently matches nothing when handed a string id.
const usersWithQueuedMessages = async () =>
  Message.distinct('user', { direction: 'out', status: 'queued', scheduledFor: { $lte: new Date() } })

module.exports = {
  queueMessage,
  drainOne,
  queueDepth,
  usersWithQueuedMessages,
  claimNextMessage
}
