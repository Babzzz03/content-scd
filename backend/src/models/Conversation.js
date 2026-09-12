const mongoose = require('mongoose')

// ─── Conversation ───
//
// One thread per (user, chatId). This is the record PostFlow has been missing:
// outreach today is one directional, so there is nowhere for a reply to live.
//
// The opt out flag lives here as well as on the Lead because a person can reply
// STOP from a number that was never linked to a Lead at all, and that opt out
// must still be permanent.

const conversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    channel: {
      type: String,
      enum: ['whatsapp', 'instagram'],
      default: 'whatsapp',
      index: true
    },

    // WhatsApp form: 2348031234567@c.us
    chatId: { type: String, required: true },

    // Same digits without the suffix, so a Lead phone can be matched against it
    // without parsing on every query.
    phoneNumber: { type: String, default: null, index: true },

    displayName: { type: String, default: null },

    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
      index: true
    },

    status: {
      type: String,
      enum: ['open', 'awaiting_reply', 'replied', 'closed'],
      default: 'open',
      index: true
    },

    // ─── Opt out ───
    // Permanent and cross campaign. Nothing in the codebase may set this back to
    // false. The absence of a clearOptOut method is deliberate.
    optedOut: { type: Boolean, default: false, index: true },
    optedOutAt: { type: Date, default: null },
    optedOutReason: { type: String, default: null },

    lastMessageAt: { type: Date, default: null, index: true },
    lastInboundAt: { type: Date, default: null },
    lastOutboundAt: { type: Date, default: null },
    unreadCount: { type: Number, default: 0 },

    // Set when the AI should stop and a person should take over. Mirrors the
    // handoff idea from DeskcommCRM: the agent knowing when to stop is worth
    // more than the agent being clever.
    humanTakeover: { type: Boolean, default: false },
    humanTakeoverAt: { type: Date, default: null }
  },
  { timestamps: true }
)

// One thread per contact per user. This is the guarantee that a lead is never
// messaged twice through two parallel conversations.
//
// Note for deployment: mongoose does not drop old indexes. If an earlier version
// of this index ever ships, run Conversation.syncIndexes() and drop the stale
// one by name, or writes will fail in ways that look like validation errors.
conversationSchema.index({ user: 1, channel: 1, chatId: 1 }, { unique: true })

conversationSchema.index({ user: 1, lastMessageAt: -1 })

// ─── Methods ───

conversationSchema.methods.markOptedOut = function (reason, now = new Date()) {
  // Idempotent on purpose. A second STOP must not overwrite the timestamp of
  // the first, because the first is the one that matters legally.
  if (this.optedOut) return this

  this.optedOut = true
  this.optedOutAt = now
  this.optedOutReason = reason || 'user_request'
  this.status = 'closed'

  return this
}

conversationSchema.methods.recordInbound = function (now = new Date()) {
  this.lastInboundAt = now
  this.lastMessageAt = now
  this.unreadCount += 1
  this.status = 'replied'

  return this
}

conversationSchema.methods.recordOutbound = function (now = new Date()) {
  this.lastOutboundAt = now
  this.lastMessageAt = now
  this.status = 'awaiting_reply'

  return this
}

module.exports = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema)
