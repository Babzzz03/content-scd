const mongoose = require('mongoose')

// ─── WhatsAppSession ───
//
// One WAHA session per PostFlow user. The session itself lives inside the WAHA
// container, so this document is a mirror of it plus the send policy and health
// state that WAHA does not track for us.
//
// Health flags are all clearable by design. The Instagram side taught this the
// hard way: a flag that only ever gets set leaves a recovered account stranded
// forever, and the user has no way to tell you the problem is gone.

const whatsAppSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    // Matches waha.service.sessionNameFor(userId). Stored rather than derived so
    // a change to the naming scheme does not orphan live sessions.
    sessionName: {
      type: String,
      required: true,
      unique: true
    },

    // The connected number in country code form, filled from WAHA /me once the
    // QR is scanned. Null until then.
    phoneNumber: { type: String, default: null },
    pushName: { type: String, default: null },

    // Mirrors WAHA: STOPPED, STARTING, SCAN_QR_CODE, WORKING, FAILED.
    // Never trust this alone for a send decision, because it can be stale.
    // whatsappHealth.classifySessionStatus is what interprets it.
    status: {
      type: String,
      enum: ['STOPPED', 'STARTING', 'SCAN_QR_CODE', 'WORKING', 'FAILED', 'UNKNOWN'],
      default: 'STOPPED',
      index: true
    },

    statusCheckedAt: { type: Date, default: null },

    // ─── Send policy ───
    // Per session so a user with an established number is not held to the same
    // limits as one who paired yesterday.
    limits: {
      minGapMs: { type: Number, default: 45000 },
      jitterMs: { type: Number, default: 30000 },
      dailyCap: { type: Number, default: 40 },
      windowStartHour: { type: Number, default: 9 },
      windowEndHour: { type: Number, default: 18 },
      timezone: { type: String, default: 'Africa/Lagos' }
    },

    // ─── Health ───
    consecutiveFailures: { type: Number, default: 0 },
    lastFailureAt: { type: Date, default: null },
    lastFailureCode: { type: String, default: null },

    // Set when a human must look at it. Nothing automated may clear this, which
    // is the point: a checkpoint is not something a retry loop gets to decide is
    // over.
    requiresHumanReview: { type: Boolean, default: false },
    humanReviewReason: { type: String, default: null },

    // The user's own stop switch, separate from health. Pausing must survive a
    // reconnect, so it lives here and not in memory.
    pausedByUser: { type: Boolean, default: false },

    lastSentAt: { type: Date, default: null },
    sentToday: { type: Number, default: 0 },
    sentTodayDate: { type: String, default: null }
  },
  { timestamps: true }
)

// ─── Methods ───

// Daily counters reset by comparing a date string in the session's own timezone.
// A UTC midnight reset would cut a Lagos user's day at 1am local, which silently
// splits their send budget across two calendar days.
whatsAppSessionSchema.methods.todayKey = function (now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: this.limits?.timezone || 'Africa/Lagos' }).format(now)
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(now)
  }
}

whatsAppSessionSchema.methods.sentTodayCount = function (now = new Date()) {
  return this.sentTodayDate === this.todayKey(now) ? this.sentToday : 0
}

whatsAppSessionSchema.methods.recordSend = function (now = new Date()) {
  const key = this.todayKey(now)

  if (this.sentTodayDate !== key) {
    this.sentTodayDate = key
    this.sentToday = 0
  }

  this.sentToday += 1
  this.lastSentAt = now
  this.consecutiveFailures = 0
  this.lastFailureCode = null

  return this
}

whatsAppSessionSchema.methods.recordFailure = function (code, now = new Date()) {
  this.consecutiveFailures += 1
  this.lastFailureAt = now
  this.lastFailureCode = code || 'UNKNOWN'

  return this
}

// Explicit and human triggered. Deliberately not called from any retry path.
whatsAppSessionSchema.methods.clearHealthFlags = function () {
  this.consecutiveFailures = 0
  this.lastFailureCode = null
  this.requiresHumanReview = false
  this.humanReviewReason = null

  return this
}

module.exports = mongoose.models.WhatsAppSession || mongoose.model('WhatsAppSession', whatsAppSessionSchema)
