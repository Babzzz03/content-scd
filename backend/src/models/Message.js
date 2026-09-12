const mongoose = require('mongoose')

// ─── Message ───
//
// Every message in both directions, and also the outbound queue. A separate
// queue collection would mean two places to look when a send goes missing and
// two things to keep in sync, so a queued outbound message is simply a Message
// with status 'queued' that the worker has not picked up yet.

const messageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true
    },

    direction: {
      type: String,
      enum: ['in', 'out'],
      required: true,
      index: true
    },

    body: { type: String, default: '' },

    mediaUrl: { type: String, default: null },
    mediaType: { type: String, default: null },

    // queued   waiting for the worker
    // sending  claimed by a worker, in flight
    // sent     accepted by WAHA
    // failed   gave up, see failureCode
    // received inbound
    status: {
      type: String,
      enum: ['queued', 'sending', 'sent', 'failed', 'received'],
      required: true,
      index: true
    },

    // WAHA's id, used to match delivery receipts back to our record.
    externalId: { type: String, default: null },

    // Who composed it. Distinguishing an AI draft from a human message is what
    // makes the inbox readable later, and what lets you measure whether the AI
    // is actually helping.
    author: {
      type: String,
      enum: ['human', 'ai', 'system', 'contact'],
      default: 'human'
    },

    scheduledFor: { type: Date, default: null, index: true },
    sentAt: { type: Date, default: null },

    attempts: { type: Number, default: 0 },
    failureCode: { type: String, default: null },
    failureMessage: { type: String, default: null },

    // Links a send back to the Lead that caused it, so outreach can be audited
    // and so a Lead's opt out can be traced to the exact message.
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
      index: true
    }
  },
  { timestamps: true }
)

// The worker's query: oldest queued message that is due. Compound so the sort
// is covered and the drain does not degrade as the collection grows.
messageSchema.index({ user: 1, status: 1, scheduledFor: 1 })

// Inbound deduplication. WAHA can redeliver a webhook, and without this a
// network hiccup turns into a duplicate reply in the inbox.
//
// sparse because outbound messages have no externalId until after they send,
// and a non sparse unique index would reject every queued message after the
// first for sharing a null value. That exact failure mode cost a week on the
// Google Maps leads.
messageSchema.index({ user: 1, externalId: 1 }, { unique: true, sparse: true })

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema)
