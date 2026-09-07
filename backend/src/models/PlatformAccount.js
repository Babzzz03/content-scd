const mongoose = require('mongoose')

const platformAccountSchema = new mongoose.Schema(
  {
    user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    platform:{ type: String, enum: ['x', 'linkedin', 'instagram'], required: true },

    username:        { type: String, required: true },
    displayName:     { type: String },
    profileImageUrl: { type: String },

    // Encrypted session cookie — decrypted only in automation service
    // Shape (pre-encryption): { cookieName, cookieValue }
    encryptedCredentials: { type: String, required: true, select: false },

    // Cached Playwright storageState path — reused across runs to avoid re-injecting the cookie
    sessionFile: { type: String, default: null },

    isActive:   { type: Boolean, default: true },

    /**
     * Account health, distinct from isActive (which is the user's own on/off).
     *
     *   active       — usable
     *   checkpointed — Instagram is demanding identity verification. Only the
     *                  human can clear this; automation must stop entirely or
     *                  it will keep hammering a wall and deepen the flag.
     *   rate_limited — soft throttle. Automation pauses until cooldownUntil.
     *   disabled     — cookie dead or repeated failures. Needs a new cookie.
     */
    health: {
      type: String,
      enum: ['active', 'checkpointed', 'rate_limited', 'disabled'],
      default: 'active',
      index: true,
    },
    healthReason:  { type: String, default: '' },
    healthAt:      { type: Date, default: null },
    /** No automation may touch this account before this time */
    cooldownUntil: { type: Date, default: null },

    // ── Activity budget (the anti-flagging accounting) ──────────────────────
    /** Browser sessions opened in the current rolling hour */
    sessionsThisHour:    { type: Number, default: 0 },
    sessionWindowAt:     { type: Date,   default: () => new Date() },
    /** Profile page loads / API enrichments in the current rolling hour */
    profileFetchesThisHour: { type: Number, default: 0 },
    profileWindowAt:     { type: Date,   default: () => new Date() },
    /** Consecutive automation failures — trips the circuit breaker */
    consecutiveFailures: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    lastUsedAt: { type: Date,    default: null },
    lastError:  { type: String,  default: null },

    dailyPostCount:    { type: Number, default: 0 },
    dailyCountResetAt: { type: Date,   default: () => new Date() },
  },
  { timestamps: true }
)

platformAccountSchema.index({ user: 1, platform: 1, username: 1 }, { unique: true })

module.exports = mongoose.model('PlatformAccount', platformAccountSchema)
