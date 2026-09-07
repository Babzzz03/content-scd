const mongoose = require('mongoose')

const brandVoiceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

    // Raw inputs from the user
    brandName: { type: String, trim: true },
    industry: { type: String, trim: true },
    tagline: { type: String, trim: true },
    targetAudience: { type: String, trim: true },
    brandValues: { type: String, trim: true },
    toneKeywords: [String],         // e.g. ['bold', 'inspirational', 'concise']
    competitorBrands: [String],
    sampleContent: { type: String, trim: true },  // user-pasted example posts
    styleNotes: { type: String, trim: true },

    // AI-generated brand voice profile
    voiceProfile: {
      taglineSuggestion: { type: String },
      aboutBrandSummary: { type: String },
      targetAudienceSummary: { type: String },
      recommendedToneKeywords: [String],
      keyMessages: [String],
      styleNotes: { type: String },
      personalityAdjectives: [String],
      toneGuidelines: { type: String },
      languageToUse: [String],
      languageToAvoid: [String],
      contentPillars: [String],
      emojiGuideline: { type: String },
      hashtagStrategy: { type: String },
      signaturePhrases: [String],
      platformNotes: {
        x: { type: String },
        linkedin: { type: String },
        instagram: { type: String },
      },
    },

    isGenerated: { type: Boolean, default: false },
  },
  { timestamps: true }
)

module.exports = mongoose.model('BrandVoice', brandVoiceSchema)
