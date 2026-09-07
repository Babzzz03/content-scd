const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String, required: true, unique: true, lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
    },
    password: { type: String, required: true, minlength: 8, select: false },
    avatarUrl: { type: String, default: null },

    plan: {
      type: String, enum: ['free', 'starter', 'pro', 'agency'],
      default: 'free',
    },

    // Counters reset monthly by a cleanup job
    usage: {
      postsThisMonth: { type: Number, default: 0 },
      aiGenerationsThisMonth: { type: Number, default: 0 },
      leadsThisMonth: { type: Number, default: 0 },
      dmsThisMonth: { type: Number, default: 0 },
      usageResetAt: { type: Date, default: () => new Date() },
    },

    // Paystack customer & subscription references
    paystackCustomerId: { type: String, default: null },
    paystackSubscriptionCode: { type: String, default: null },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'inactive', 'cancelled', 'past_due'],
      default: 'inactive',
    },
    subscriptionExpiresAt: { type: Date, default: null },

    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },

    // Refresh-token hash for rotation
    refreshTokenHash: { type: String, default: null, select: false },
  },
  { timestamps: true }
)

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

// Compare plain password to stored hash
userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password)
}

// Check if monthly usage should reset (called before incrementing)
userSchema.methods.resetUsageIfNeeded = async function () {
  const now = new Date()
  const reset = this.usage.usageResetAt
  const monthDiff = (now.getFullYear() - reset.getFullYear()) * 12 + (now.getMonth() - reset.getMonth())
  if (monthDiff >= 1) {
    this.usage.postsThisMonth = 0
    this.usage.aiGenerationsThisMonth = 0
    this.usage.leadsThisMonth = 0
    this.usage.dmsThisMonth = 0
    this.usage.usageResetAt = now
    await this.save()
  }
}

// Strip password from toJSON output
userSchema.set('toJSON', {
  transform(_, ret) {
    delete ret.password
    delete ret.refreshTokenHash
    return ret
  },
})

module.exports = mongoose.model('User', userSchema)
