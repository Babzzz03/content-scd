const mongoose = require('mongoose')

const postSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    platform: { type: String, enum: ['x', 'linkedin', 'instagram'], required: true },
    platformAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformAccount' },

    // ── Content ────────────────────────────────────────────────────────────
    content: { type: String, required: true, maxlength: 5000 },
    hashtags: [String],
    mediaUrls: [String],          // full Cloudinary HTTPS URLs
    postType: {
      type: String,
      enum: ['standard', 'single', 'thread', 'reply', 'carousel', 'story', 'article', 'reel', 'text', 'image'],
      default: 'standard',
    },
    threadParts: [String],        // for X threads — each element is one tweet

    // ── Scheduling ─────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'publishing', 'published', 'failed'],
      default: 'draft',
    },
    scheduledAt: { type: Date, index: true },
    publishedAt: { type: Date },

    // ── AI generation metadata ─────────────────────────────────────────────
    generatedBy: { type: String, enum: ['deepseek', 'user', 'mixed'], default: 'user' },
    generationPrompt: { type: String, select: false },  // store for debugging

    // ── Automation result ─────────────────────────────────────────────────
    automationAttempts: { type: Number, default: 0 },
    automationError: { type: String, default: null },
    platformPostId: { type: String, default: null },  // ID returned by the platform

    // ── Engagement (updated by a separate analytics sync) ─────────────────
    engagement: {
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      reach: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
)

// Index for efficient scheduler queries
postSchema.index({ status: 1, scheduledAt: 1 })

module.exports = mongoose.model('Post', postSchema)
