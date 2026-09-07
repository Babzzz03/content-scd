const deepseek = require('../services/deepseek.service')
const BrandVoice = require('../models/BrandVoice')
const { ok, badRequest } = require('../utils/apiResponse')
const { isValidPlatform } = require('../utils/helpers')

/** Load brand voice for the requesting user (may be null) */
const getBrandVoice = async (userId) => BrandVoice.findOne({ user: userId })

// ─── Generate post content ────────────────────────────────────────────────────

const generatePost = async (req, res) => {
  const { platform, topic, postType, count = 3, format, useBrandVoice = true } = req.body

  if (!isValidPlatform(platform)) return badRequest(res, 'Invalid platform')

  const brandVoice = useBrandVoice ? await getBrandVoice(req.user._id) : null
  const resolvedTopic = topic?.trim() || brandVoice?.brandName || brandVoice?.industry

  if (!resolvedTopic) return badRequest(res, 'Topic is required when brand voice is off')

  let posts
  if (platform === 'x') {
    posts = await deepseek.generateXPosts({ topic: resolvedTopic, postType, count, brandVoice, format })
  } else if (platform === 'linkedin') {
    posts = await deepseek.generateLinkedInPost({
      topic: resolvedTopic, count,
      authorRole: brandVoice?.brandName,
      industry: brandVoice?.industry,
      brandVoice, format,
    })
  } else {
    posts = await deepseek.generateInstagramCaption({
      topic: resolvedTopic, count, brandVoice,
      mediaDescription: req.body.mediaDescription,
      aesthetic: req.body.aesthetic,
    })
  }

  ok(res, { posts, platform, topic: resolvedTopic })
}

// ─── Generate content ideas ───────────────────────────────────────────────────

const generateIdeas = async (req, res) => {
  const { count = 8, platforms, useBrandVoice = true } = req.body
  const brandVoice = useBrandVoice ? await getBrandVoice(req.user._id) : null

  const ideas = await deepseek.generateContentIdeas({
    brandName: brandVoice?.brandName,
    industry: brandVoice?.industry,
    platforms: platforms || ['x', 'instagram'],
    goals: req.body.goals,
    count,
    brandVoice,
  })
  ok(res, { ideas })
}

// ─── Generate post ideas ──────────────────────────────────────────────────────

const generatePostIdeas = async (req, res) => {
  const { platform, topic, count = 6, useBrandVoice = true } = req.body
  const brandVoice = useBrandVoice ? await getBrandVoice(req.user._id) : null

  const ideas = await deepseek.generatePostIdeas({
    platform, topic, count,
    industry: brandVoice?.industry,
    brandVoice,
  })
  ok(res, { ideas })
}

// ─── Generate brand voice ─────────────────────────────────────────────────────

const generateBrandVoice = async (req, res) => {
  const {
    brandName, industry, tagline, targetAudience, brandValues,
    toneKeywords, competitors, sampleContent, styleNotes,
  } = req.body

  const profile = await deepseek.generateBrandVoiceProfile({
    brandName, industry, tagline, targetAudience, brandValues,
    toneKeywords, competitors, sampleContent, styleNotes,
  })

  const resolvedTagline = profile.taglineSuggestion || tagline || ''
  const resolvedTargetAudience = profile.targetAudienceSummary || targetAudience || ''
  const resolvedBrandValues = Array.isArray(profile.keyMessages) && profile.keyMessages.length > 0
    ? profile.keyMessages.join('\n')
    : (brandValues || '')
  const resolvedToneKeywords = Array.isArray(profile.recommendedToneKeywords) && profile.recommendedToneKeywords.length > 0
    ? profile.recommendedToneKeywords
    : (toneKeywords || [])
  const resolvedSampleContent = profile.aboutBrandSummary || sampleContent || ''
  const resolvedStyleNotes = profile.styleNotes || profile.toneGuidelines || styleNotes || ''

  // Upsert to DB
  const doc = await BrandVoice.findOneAndUpdate(
    { user: req.user._id },
    {
      user: req.user._id,
      brandName,
      industry,
      tagline: resolvedTagline,
      targetAudience: resolvedTargetAudience,
      brandValues: resolvedBrandValues,
      toneKeywords: resolvedToneKeywords,
      competitorBrands: competitors || [],
      sampleContent: resolvedSampleContent,
      styleNotes: resolvedStyleNotes,
      voiceProfile: profile,
      isGenerated: true,
    },
    { upsert: true, new: true }
  )
  ok(res, { brandVoice: doc }, 'Brand voice profile generated')
}

// ─── Generate marketing strategy ─────────────────────────────────────────────

const generateStrategy = async (req, res) => {
  const {
    businessName, industry, currentSituation, goals, budget, teamSize, platforms,
    useBrandVoice = true, timeline, businessStage, additionalContext,
  } = req.body

  const brandVoice = useBrandVoice ? await getBrandVoice(req.user._id) : null

  const strategy = await deepseek.generateMarketingStrategy({
    businessName: businessName || brandVoice?.brandName,
    industry: industry || brandVoice?.industry,
    currentSituation,
    goals,
    budget,
    teamSize,
    platforms,
    timeline,
    businessStage,
    additionalContext,
    brandVoice,
  })
  ok(res, { strategy })
}

// ─── Generate reply ───────────────────────────────────────────────────────────

const generateReply = async (req, res) => {
  const { originalPost, replyIntent, platform, useBrandVoice = true, topComments = [] } = req.body
  if (!originalPost) return badRequest(res, 'originalPost is required')
  const brandVoice = useBrandVoice ? await getBrandVoice(req.user._id) : null
  const replies = await deepseek.generateReply({ originalPost, replyIntent, platform, brandVoice, topComments })
  ok(res, { replies })
}

// ─── Generate engagements ─────────────────────────────────────────────────────

const generateEngagements = async (req, res) => {
  const { platform, topic, tone, engagementType, count = 4, useBrandVoice = true } = req.body
  if (!topic) return badRequest(res, 'topic is required')
  const brandVoice = useBrandVoice ? await getBrandVoice(req.user._id) : null
  const engagements = await deepseek.generateEngagements({ platform, topic, tone, engagementType, count, brandVoice })
  ok(res, { engagements })
}

module.exports = { generatePost, generateIdeas, generatePostIdeas, generateBrandVoice, generateStrategy, generateReply, generateEngagements }
