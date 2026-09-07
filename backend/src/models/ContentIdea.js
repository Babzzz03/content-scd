const mongoose = require('mongoose')

const contentIdeaSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    title: { type: String, required: true },
    format: { type: String },          // Tutorial, BTS, Skit, Educational, etc.
    platform: { type: String },        // best-fit platform suggestion
    hook: { type: String },            // first 3-second hook
    description: { type: String },
    whyItWorks: { type: String },
    trendingTags: [String],

    // 'idea' for content/video ideas, 'post' for ready-to-use post drafts
    type: { type: String, enum: ['idea', 'post'], default: 'idea' },
    savedPlatform: { type: String },   // platform the user saved it for

    isSaved: { type: Boolean, default: false },
    isUsed: { type: Boolean, default: false },
    linkedPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },

    generationPrompt: { type: String, select: false },
  },
  { timestamps: true }
)

module.exports = mongoose.model('ContentIdea', contentIdeaSchema)
