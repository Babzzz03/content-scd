/**
 * DeepSeek AI Service
 *
 * Uses the OpenAI-compatible DeepSeek API.
 * Each generate* function returns structured data (arrays or objects).
 * The extractJson helper tolerates markdown code fences in the response.
 *
 * PROMPT PHILOSOPHY
 * ─────────────────
 * Every prompt explicitly instructs the model to:
 *  1. Sound like a real human — not like AI-generated content.
 *  2. Follow the brand voice profile precisely.
 *  3. Return valid JSON only (no explanations outside the JSON).
 *  4. Respect platform-specific character limits and conventions.
 */

const { OpenAI } = require('openai')
const { extractJson } = require('../utils/helpers')
const logger = require('../utils/logger')

const client = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
})

const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

// ─── Core LLM call ────────────────────────────────────────────────────────────

const chat = async (systemPrompt, userPrompt, options = {}) => {
  const { temperature = 0.85, maxTokens = 2048, timeoutMs = 90000 } = options
  const requestPromise = client.chat.completions.create({
    model: MODEL,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('DeepSeek request timed out after 90s')), timeoutMs)
  )
  const response = await Promise.race([requestPromise, timeoutPromise])
  return response.choices[0].message.content.trim()
}

// ─── Strip AI-looking punctuation from text fields ───────────────────────────

const stripAiPunctuation = (str) =>
  typeof str === 'string' ? str.replace(/—/g, ',').replace(/--/g, ',') : str

const cleanTextFields = (obj) => {
  if (typeof obj === 'string') return stripAiPunctuation(obj)
  if (Array.isArray(obj)) return obj.map(cleanTextFields)
  if (obj && typeof obj === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(obj)) out[k] = cleanTextFields(v)
    return out
  }
  return obj
}

// ─── Brand voice helper ───────────────────────────────────────────────────────

const buildVoiceContext = (voice) => {
  if (!voice || !voice.isGenerated) return ''
  const p = voice.voiceProfile || {}
  return `
BRAND VOICE PROFILE:
- Personality: ${(p.personalityAdjectives || []).join(', ')}
- Tone guidelines: ${p.toneGuidelines || 'Professional yet approachable'}
- Language to use: ${(p.languageToUse || []).join(', ')}
- Language to avoid: ${(p.languageToAvoid || []).join(', ')}
- Signature style: ${(p.signaturePhrases || []).join(', ')}
`.trim()
}

// ─── X (Twitter) post generation ─────────────────────────────────────────────

/**
 * Generate X posts.
 * @param {object} params
 * @param {string} params.topic - What the post is about
 * @param {string} params.postType - 'standard' | 'thread' | 'reply'
 * @param {number} params.count - Number of variations to generate
 * @param {object} [params.brandVoice] - BrandVoice document
 * @param {string} [params.format] - e.g. 'educational', 'promotional', 'storytelling'
 */
const generateXPosts = async ({ topic, postType = 'standard', count = 3, brandVoice, format }) => {
  const voiceCtx = buildVoiceContext(brandVoice)

  const systemPrompt = `
You are an expert X (Twitter) content writer who creates posts that go viral.
You understand the X algorithm: short punchy hooks, strong opinions, relatable takes,
and story-driven threads perform best. Your posts must feel written by a real human —
never robotic, never generic, never overly formal unless that matches the brand voice.

${voiceCtx}

CRITICAL RULES:
- Standard posts: STRICTLY under 280 characters (including hashtags)
- Threads: Each part under 280 characters. Default 3-5 parts. Use 6 only if content genuinely needs it. 7 is the absolute max, only for very complex topics.
- Include 1-2 hashtags max — overusing hashtags feels spammy
- Start with a hook that STOPS the scroll (question, bold claim, surprising stat, or strong opinion)
- Never use clichéd AI phrases like "In today's digital landscape", "Let's dive in", or "Game changer"
- NEVER use em dashes (—) or double hyphens (--) anywhere in the output text. Use commas or short sentences instead.
- Always return ONLY valid JSON, no markdown fences, no explanations
`.trim()

  const isThread = postType === 'thread'
  const userPrompt = isThread ? `
Generate ${count} Twitter THREAD variations about: "${topic}"

IMPORTANT: A thread is a series of connected tweets. Each tweet must be UNDER 280 characters.
The first tweet is the hook that makes people want to read on.

Return a JSON array where each element has:
{
  "content": "...",         // Tweet 1 — the hook (under 280 chars, no hashtags)
  "threadParts": ["...", "...", "..."],  // Tweets 2-N, each under 280 chars. Use 3-5 parts for most topics. Only use 6 if content is genuinely dense. 7 is the hard max and only for very complex topics — do NOT pad threads.
  "hashtags": [...],        // 1-2 hashtags without # symbol (add to the LAST tweet only)
  "flyerHeadline": "...",   // 3-6 word bold headline for a visual flyer — punchy, uppercase-friendly, no hashtags
  "flyerSubtext": "...",    // 1 short sentence (max 12 words) that supports the headline on the flyer
  "suggestedMediaAlt": "...",
  "engagementTip": "..."
}
`.trim() : `
Generate ${count} post variations about: "${topic}"
Post format: ${format || 'engaging and shareable'}

Return a JSON array where each element has:
{
  "content": "...",         // full post text (STRICTLY under 280 characters including hashtags)
  "threadParts": [],        // always empty for standard posts
  "hashtags": [...],        // 1-2 hashtags without # symbol
  "flyerHeadline": "...",   // 3-6 word bold headline for a visual flyer — punchy, uppercase-friendly, no hashtags
  "flyerSubtext": "...",    // 1 short sentence (max 12 words) that supports the headline on the flyer
  "suggestedMediaAlt": "...",
  "engagementTip": "..."
}
`.trim()

  const raw = await chat(systemPrompt, userPrompt)
  const parsed = extractJson(raw)
  if (!Array.isArray(parsed)) throw new Error('DeepSeek returned unexpected format for X posts')
  return cleanTextFields(parsed.slice(0, count))
}

// ─── LinkedIn post generation ─────────────────────────────────────────────────

const generateLinkedInPost = async ({ topic, authorRole, industry, count = 2, brandVoice, format }) => {
  const voiceCtx = buildVoiceContext(brandVoice)

  const systemPrompt = `
You are a LinkedIn content strategist who writes posts that generate genuine professional engagement.
The best LinkedIn posts tell a personal story, share a controversial or surprising insight,
or provide immediately actionable advice — they do NOT read like a press release.

${voiceCtx}

CRITICAL RULES:
- Open with a one-liner hook (NOT "I'm excited to announce")
- Use short paragraphs (1-3 sentences max). Add blank lines between paragraphs.
- Optimal length: 800–1300 characters (readers skim, stop at the "...see more" cutoff)
- End with a clear call-to-action or open-ended question to drive comments
- Include 3-5 relevant hashtags at the VERY END, on their own line
- Never use corporate buzzwords: "synergy", "leverage", "pivot", "circle back", "deep dive"
- NEVER use em dashes (—) or double hyphens (--) anywhere in the output text. Use commas or short sentences instead.
- Always return ONLY valid JSON, no markdown fences
`.trim()

  const userPrompt = `
Generate ${count} LinkedIn post variations about: "${topic}"
Author's role: ${authorRole || 'Content Creator'}
Industry: ${industry || 'General'}
Format: ${format || 'thought leadership'}

Return a JSON array where each element has:
{
  "content": "...",          // full post with line breaks as \\n
  "hashtags": [...],         // 3-5 hashtags without # symbol
  "callToAction": "...",     // extracted CTA sentence
  "estimatedReadTime": "...", // e.g. "45 seconds"
  "flyerHeadline": "...",    // 3-6 word bold headline for a visual flyer — punchy, uppercase-friendly, no hashtags
  "flyerSubtext": "..."      // 1 short sentence (max 12 words) that supports the headline on the flyer
}
`.trim()

  const raw = await chat(systemPrompt, userPrompt)
  const parsed = extractJson(raw)
  if (!Array.isArray(parsed)) throw new Error('Unexpected format for LinkedIn posts')
  return cleanTextFields(parsed.slice(0, count))
}

// ─── Instagram caption generation ─────────────────────────────────────────────

const generateInstagramCaption = async ({ topic, mediaDescription, count = 2, brandVoice, aesthetic }) => {
  const voiceCtx = buildVoiceContext(brandVoice)

  const systemPrompt = `
You are an Instagram content creator who writes captions that drive saves and shares.
Great Instagram captions tell micro-stories, ask relatable questions, or reveal
useful tips that make followers want to save the post for later.

${voiceCtx}

CRITICAL RULES:
- First line must hook the reader BEFORE the "more" cutoff (≤ 125 characters)
- Use 8-15 hashtags: mix popular (#Motivation - 200M+), medium (#EntrepreneurLife - 5M+), and niche tags
- Add emojis naturally throughout — they break up text and add personality
- End with a question or CTA to drive comments
- Vary sentence length for rhythm
- NEVER use em dashes (—) or double hyphens (--) anywhere in the output text. Use commas or short sentences instead.
- Always return ONLY valid JSON, no markdown fences
`.trim()

  const userPrompt = `
Generate ${count} Instagram caption variations for: "${topic}"
Visual context: ${mediaDescription || 'lifestyle photo'}
Aesthetic: ${aesthetic || 'clean and modern'}

Return a JSON array where each element has:
{
  "caption": "...",           // full caption with \\n line breaks and emojis
  "firstLine": "...",         // the hook (≤125 chars, shown before 'more')
  "hashtags": [...],          // 8-15 hashtag strings without # symbol
  "callToAction": "...",      // the closing CTA
  "suggestedEmojis": [...],   // 5-8 emojis that fit the post
  "flyerHeadline": "...",     // 3-6 word bold headline for a visual flyer — punchy, uppercase-friendly, no hashtags
  "flyerSubtext": "..."       // 1 short sentence (max 12 words) that supports the headline on the flyer
}
`.trim()

  const raw = await chat(systemPrompt, userPrompt)
  const parsed = extractJson(raw)
  if (!Array.isArray(parsed)) throw new Error('Unexpected format for Instagram captions')
  return cleanTextFields(parsed.slice(0, count))
}

// ─── Content ideas (video / reel) ─────────────────────────────────────────────

const generateContentIdeas = async ({ brandName, industry, platforms, goals, count = 8, brandVoice }) => {
  const voiceCtx = buildVoiceContext(brandVoice)

  const systemPrompt = `
You are a viral content strategist specialising in short-form video and social content.
You understand what performs on X, LinkedIn, and Instagram — the psychology of hooks,
pattern interrupts, storytelling arcs, and trending formats.

${voiceCtx}

NEVER use em dashes (—) or double hyphens (--) in any text fields. Use commas or short sentences instead.
Return ONLY valid JSON. No explanations, no markdown.
`.trim()

  const userPrompt = `
Generate ${count} unique content ideas for ${brandName || 'the brand'} in the ${industry || 'general'} space.
Platforms to cover: ${(platforms || ['x', 'instagram']).join(', ')}
Brand goals: ${goals || 'grow audience, build trust, drive sales'}

Each idea must be SPECIFIC and ACTIONABLE — not generic.
Return a JSON array where each element has:
{
  "title": "...",           // catchy video/post title
  "format": "...",          // Tutorial / BTS / Skit / Educational / Trending / Story-time / Reaction / Q&A / Day-in-the-life
  "platform": "...",        // best platform(s) for this
  "hook": "...",            // what to say/show in the first 3 seconds to stop the scroll
  "description": "...",     // what the content covers (2-3 sentences)
  "whyItWorks": "...",      // psychology or algorithm reason why this performs well
  "trendingTags": [...],    // relevant hashtags or sounds to use
  "difficulty": "..."       // Easy / Medium / Hard (production difficulty)
}
`.trim()

  const raw = await chat(systemPrompt, userPrompt, { temperature: 0.9, maxTokens: 3000 })
  const parsed = extractJson(raw)
  if (!Array.isArray(parsed)) throw new Error('Unexpected format for content ideas')
  return cleanTextFields(parsed.slice(0, count))
}

// ─── Post ideas (ready-to-use caption/copy ideas) ────────────────────────────

const generatePostIdeas = async ({ platform, topic, industry, count = 6, brandVoice }) => {
  const voiceCtx = buildVoiceContext(brandVoice)

  const systemPrompt = `
You create diverse post idea prompts — not full posts, but inspiring, specific brief descriptions
that a content creator can immediately write from. Each idea should be genuinely interesting
and distinct from the others.

${voiceCtx}

NEVER use em dashes (—) or double hyphens (--) in any text fields. Use commas or short sentences instead.
Return ONLY valid JSON.
`.trim()

  const userPrompt = `
Generate ${count} diverse post ideas for ${platform || 'social media'} about: "${topic || 'general content'}"
Industry: ${industry || 'general'}

Return a JSON array where each element has:
{
  "title": "...",           // catchy title for the idea (max 10 words)
  "description": "...",     // 2-3 sentence caption / copy brief the creator can post directly or adapt
  "hook": "...",            // the exact first sentence to open the post with (scroll-stopping)
  "tone": "...",            // educational | humorous | inspirational | controversial | personal | promotional
  "format": "...",          // e.g. Tutorial / Story / Listicle / Hot-take / Behind-the-scenes / Q&A
  "postType": "...",        // single | thread | carousel | story | text | image (best fit for the platform)
  "platform": "...",        // x | linkedin | instagram
  "hashtags": [...],        // 3-6 relevant hashtag strings without # symbol
  "difficulty": "...",      // easy | medium | hard (production effort)
  "whyItWorks": "...",      // 1-sentence psychology/algorithm reason this performs well
  "imagePrompt": "..."      // brief description of ideal image or visual to pair with this post
}
`.trim()

  const raw = await chat(systemPrompt, userPrompt)
  const parsed = extractJson(raw)
  if (!Array.isArray(parsed)) throw new Error('Unexpected format for post ideas')
  return cleanTextFields(parsed.slice(0, count))
}

// ─── Brand voice analysis ─────────────────────────────────────────────────────

const generateBrandVoiceProfile = async ({ brandName, industry, tagline, targetAudience, brandValues, toneKeywords, competitors, sampleContent, styleNotes }) => {
  const systemPrompt = `
You are a brand strategist who builds authentic brand voice guides.
Your guides are practical, specific, and immediately usable — not generic marketing fluff.
You analyse the provided inputs and craft a distinctive voice that stands out in the crowded ${industry || 'market'}.

NEVER use em dashes (—) or double hyphens (--) in any text fields. Use commas or short sentences instead.
Return ONLY valid JSON.
`.trim()

  const userPrompt = `
Create a comprehensive brand voice profile for:
- Brand: ${brandName || 'the brand'}
- Industry: ${industry || 'not specified'}
- Existing tagline: ${tagline || 'not specified'}
- Target audience: ${targetAudience || 'not specified'}
- Core brand values: ${brandValues || 'not specified'}
- Desired tone keywords: ${(toneKeywords || []).join(', ') || 'not specified'}
- Competitors to differentiate from: ${(competitors || []).join(', ') || 'none listed'}
- Sample existing content: ${sampleContent ? `"${sampleContent.slice(0, 500)}"` : 'none provided'}
- Existing style notes: ${styleNotes || 'not specified'}

Return a single JSON object with:
{
  "taglineSuggestion": "...",       // a short memorable tagline, max 10 words
  "aboutBrandSummary": "...",       // 2-4 sentences describing what the brand is/about
  "targetAudienceSummary": "...",   // a sharper, more specific audience summary
  "recommendedToneKeywords": [...], // 3-5 practical tone keywords
  "keyMessages": [...],             // 4-6 core messages the brand should repeat
  "styleNotes": "...",              // practical writing instructions tailored to the brand
  "personalityAdjectives": [...],    // exactly 5 adjectives that define the brand voice
  "toneGuidelines": "...",           // 2-3 sentences explaining HOW to write, not just what
  "languageToUse": [...],            // 8-10 specific words/phrases to actively use
  "languageToAvoid": [...],          // 8-10 words/phrases that clash with the brand
  "contentPillars": [...],           // 5 core content topics to focus on
  "emojiGuideline": "...",           // how to use (or not use) emojis
  "hashtagStrategy": "...",          // hashtag philosophy per platform
  "signaturePhrases": [...],         // 3-5 distinctive phrases or sentence structures to use
  "platformNotes": {
    "x": "...",                      // how the voice adapts specifically for X
    "linkedin": "...",               // how it adapts for LinkedIn
    "instagram": "..."               // how it adapts for Instagram
  }
}
`.trim()

  const raw = await chat(systemPrompt, userPrompt, { temperature: 0.75 })
  const parsed = extractJson(raw)
  if (!parsed || typeof parsed !== 'object') throw new Error('Unexpected format for brand voice profile')
  return cleanTextFields(parsed)
}

// ─── Marketing strategy ───────────────────────────────────────────────────────

const generateMarketingStrategy = async ({ businessName, industry, currentSituation, goals, budget, teamSize, platforms, timeline, businessStage, additionalContext, brandVoice }) => {
  const voiceCtx = buildVoiceContext(brandVoice)
  const systemPrompt = `
You are a senior social media marketing strategist with a track record of scaling brands from 0 to 100K followers.
You create practical, data-informed strategies with clear actions — not vague advice.
Your strategies are opinionated: you tell clients exactly what to do, when to do it, and why.
NEVER use em dashes (—) or double hyphens (--) in any text fields. Use commas or short sentences instead.
${voiceCtx}
Return ONLY valid JSON.
`.trim()

  const timelineLabel = timeline === '1-month' ? '30 days' : timeline === '3-months' ? '90 days' : timeline === '6-months' ? '6 months' : timeline === '1-year' ? '1 year' : '90 days'

  const userPrompt = `
Create a ${timelineLabel} social media marketing strategy.

Business: ${businessName || 'the business'} | Industry: ${industry || 'unspecified'} | Stage: ${businessStage || 'growing'}
Goals: ${goals || 'grow audience and drive engagement'} | Budget: ${budget || 'bootstrap'} | Platforms: ${(platforms || ['x', 'instagram']).join(', ')}${additionalContext ? `\nContext: ${additionalContext}` : ''}

Return JSON:
{
  "overview": "2-3 sentence actionable summary tailored to the business context",
  "contentPillars": [
    { "name": "...", "description": "...", "exampleFormats": ["...","...","..."], "postingFrequency": "X per week" }
  ],
  "growthTactics": [
    { "title": "...", "description": "...", "effort": "low|medium|high", "impact": "low|medium|high", "steps": ["..."], "expectedOutcome": "..." }
  ],
  "toolRecommendations": [
    { "name": "...", "category": "...", "description": "...", "pricing": "free|paid|freemium" }
  ],
  "kpis": [
    { "metric": "...", "target": "...", "timeframe": "...", "howToMeasure": "..." }
  ],
  "phases": [
    { "phase": "Phase 1 – Foundation", "timeframe": "...", "focus": "...", "actions": ["...","...","..."] },
    { "phase": "Phase 2 – Growth", "timeframe": "...", "focus": "...", "actions": ["...","...","..."] },
    { "phase": "Phase 3 – Scale", "timeframe": "...", "focus": "...", "actions": ["...","...","..."] }
  ],
  "quickWins": ["...", "...", "...", "...", "..."]
}

Return 4-5 content pillars, 4-5 growth tactics, 3-4 tools, 4-5 KPIs. Be specific and actionable.
`.trim()

  const raw = await chat(systemPrompt, userPrompt, { temperature: 0.75, maxTokens: 3000, timeoutMs: 90000 })
  const parsed = extractJson(raw)
  if (!parsed || typeof parsed !== 'object') throw new Error('Unexpected format for marketing strategy')
  return cleanTextFields(parsed)
}

// ─── Engagement copy ──────────────────────────────────────────────────────────

const generateEngagements = async ({ platform, topic, tone, engagementType, count = 4, brandVoice }) => {
  const voiceCtx = buildVoiceContext(brandVoice)
  const systemPrompt = `
You write short, authentic social-media engagement copy that sounds human.
Never use em dashes (—) in your writing. Use commas or short sentences instead.
${voiceCtx}
Return ONLY valid JSON.
`.trim()

  const userPrompt = `
Generate ${count} "${engagementType}" engagement texts for ${platform} about: "${topic}"
Tone: ${tone || 'professional'}

Each item must be under 220 characters, feel natural, and contain no em dashes (—).

Return JSON array:
[{ "text": "...", "type": "${engagementType}", "characterCount": 0 }]
`.trim()

  const raw = await chat(systemPrompt, userPrompt, { temperature: 0.9 })
  const parsed = extractJson(raw)
  return (Array.isArray(parsed) ? parsed : []).map((item, i) => {
    const text = (item.text || '').replace(/—/g, ',')
    return {
      id: `eng-${Date.now()}-${i}`,
      text,
      type: item.type || engagementType,
      characterCount: text.length,
    }
  })
}

// ─── Single contextual reply (used by automation layer) ──────────────────────

const generateContextualReply = async ({ tweetText, topic, tone = 'conversational', brandVoice, comments = [], platform = 'x' }) => {
  const voiceCtx = buildVoiceContext(brandVoice)

  const isInstagram = platform === 'instagram'
  const maxChars = isInstagram ? 150 : 220
  const platformLabel = isInstagram ? 'Instagram comment' : 'X/Twitter reply'

  const commentsCtx = comments.length
    ? `\nTop comments (most liked — these reflect what's resonating with the audience):\n${comments.slice(0, 5).map((c, i) => `${i + 1}. "${c}"`).join('\n')}`
    : ''

  const systemPrompt = `
You write ${platformLabel}s that sound like a real person — warm, specific, and conversational.
Rules:
- NEVER open with "Great post!", "Love this!", "So true!", "Amazing!", or any generic opener
- Reference something SPECIFIC from the post — a word, idea, or detail that shows you actually read it
- Sound human, not like a brand or bot
- No em dashes (—) anywhere — use commas or short sentences instead
${voiceCtx}
Return ONLY the comment text as a plain string. No quotes around it, no JSON, no labels.
`.trim()

  const commentBlendInstruction = comments.length
    ? `\n- Let about 20% of your reply's energy and vibe be shaped by the top comments above (match what's already resonating — their tone, curiosity, or enthusiasm) but bring 80% your own fresh angle on the post itself. Do not copy or repeat them.`
    : ''

  const userPrompt = `
Post you are replying to:
"${tweetText}"
${commentsCtx}

Tone: ${tone}

Write ONE ${platformLabel} (max ${maxChars} characters).
- Respond directly to what the post says — reference a specific word, phrase, or idea from it
- Do NOT reply generically about the topic in general — only respond to this specific post${commentBlendInstruction}${isInstagram ? '\n- Emojis welcome if they feel natural' : ''}
- No em dashes
`.trim()

  const reply = await chat(systemPrompt, userPrompt, { temperature: 0.95, maxTokens: 300 })
  return reply.replace(/^["']|["']$/g, '').replace(/—/g, ',').trim()
}

// ─── Reply copy ───────────────────────────────────────────────────────────────

const generateReply = async ({ originalPost, replyIntent, platform, brandVoice, topComments = [] }) => {
  const voiceCtx = buildVoiceContext(brandVoice)

  const platformCtx = platform === 'instagram'
    ? 'Instagram (conversational, emojis welcome, max 2200 chars — keep replies under 150 chars for comments)'
    : platform === 'x'
    ? 'X/Twitter (punchy and direct, max 280 chars)'
    : 'LinkedIn (professional but warm, 1–3 sentences)'

  const commentsCtx = topComments.length
    ? `\nTop comments on this post (highest engagement):\n${topComments.slice(0, 5).map((c, i) => `${i + 1}. "${c}"`).join('\n')}\n\nNote: don\'t repeat what the top comments already said — bring a fresh angle.`
    : ''

  const systemPrompt = `
You are a social media expert who writes replies that feel genuinely human and spark real conversation.

Hard rules:
- Never use em dashes (—)
- NEVER open with "Great post!", "Love this!", "So true!", "Amazing!", "This is so valid" or any generic opener
- You MUST reference something SPECIFIC from the post (a word, phrase, idea, or detail) — show you read it
- Each of the 3 replies must use a completely DIFFERENT engagement angle
- Sound like a real person texting, not a brand writing copy
${voiceCtx}
Return ONLY valid JSON — no markdown, no extra text.
`.trim()

  const userPrompt = `
Platform: ${platformCtx}
Post you are replying to:
"${originalPost}"
${commentsCtx}
Intent: ${replyIntent || 'engage positively and start a real conversation'}

Write exactly 3 replies. Each must use a DIFFERENT strategy:

Strategy 1 "agree_expand": Pick ONE specific point or phrase from the post, agree with it, then add your own insight, experience, or example that builds on it.
Strategy 2 "curious_question": Ask a genuinely curious follow-up question about something SPECIFIC in the post — something you actually wonder about after reading it. One question only, no filler.
Strategy 3 "value_add": Drop a relevant tip, counterpoint, stat, or real-world observation that adds something NEW the post didn't already say. Make it feel like a reply from someone in the know.

For Instagram: keep each reply under 120 characters if possible, emoji where natural.
For X: keep under 240 characters.

Return JSON:
[
  { "reply": "...", "tone": "agree_expand" },
  { "reply": "...", "tone": "curious_question" },
  { "reply": "...", "tone": "value_add" }
]
`.trim()

  const raw = await chat(systemPrompt, userPrompt, { temperature: 0.95 })
  const parsed = extractJson(raw)
  return Array.isArray(parsed)
    ? parsed.map((item) => ({ ...item, reply: (item.reply || '').replace(/—/g, ',') }))
    : []
}

// ─── Niche trending hashtag discovery ────────────────────────────────────────

const generateNicheTrendingHashtags = async ({ niche, platform = 'instagram', count = 5 }) => {
  const systemPrompt = `
You are a social media trend analyst who knows which hashtags are currently active and growing.
Rules:
- Return hashtags that have active posting communities — not dead or oversaturated ones
- Mix sizes: 1-2 mid-size (100k-1M posts), 2-3 niche-specific (10k-100k posts)
- No generic mega-tags like #love #instagood #viral — those are useless for discovery
- Return ONLY valid JSON, no markdown, no extra text.
`.trim()

  const userPrompt = `
Platform: ${platform}
Niche / industry: "${niche}"

List ${count} hashtags (without the # symbol) that someone in this niche should search right now to find today's most-engaged posts.
Pick hashtags that actual humans in this niche actively use and browse.

Return JSON array of strings:
["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"]
`.trim()

  const raw = await chat(systemPrompt, userPrompt, { temperature: 0.7, maxTokens: 256 })
  const parsed = extractJson(raw)
  if (Array.isArray(parsed)) return parsed.map(h => String(h).replace(/^#/, '').trim()).filter(Boolean)
  return []
}

// ─── Lead generation ──────────────────────────────────────────────────────────

/**
 * Expand a niche × location matrix into hashtags real businesses actually use.
 *
 * The mechanical combinations the discovery workflow builds (#bakerylagos) only
 * cover the obvious cases. This fills in local slang, plural forms, industry
 * shorthand, and the community tags a niche congregates around.
 */
const expandLeadQueries = async ({ niches = [], locations = [], count = 18 }) => {
  const systemPrompt = `
You are a local market researcher who knows exactly which Instagram hashtags small
businesses in a given industry and city actually put on their posts.

CRITICAL RULES:
- Return hashtags that real small businesses USE ON THEIR OWN POSTS, not tags customers browse
- Favour local and community tags over huge global ones. #lagosbakery beats #bread
- Include local slang and abbreviations where they exist
- Include both "nichecity" and "citynich" orderings when both are used in practice
- No spaces, no # symbol, lowercase only, letters and numbers only
- Always return ONLY valid JSON, no markdown fences, no explanations
`.trim()

  const userPrompt = `
Target industries: ${niches.join(', ') || 'any local business'}
Target locations: ${locations.join(', ') || 'anywhere'}

List ${count} Instagram hashtags that businesses in these industries and locations put on their own posts.

Return a JSON array of strings:
["hashtag1", "hashtag2"]
`.trim()

  const raw = await chat(systemPrompt, userPrompt, { temperature: 0.7, maxTokens: 512 })
  const parsed = extractJson(raw)
  if (!Array.isArray(parsed)) return []
  return parsed
    .map((h) => String(h).replace(/^#/, '').toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(Boolean)
    .slice(0, count)
}

/**
 * Judge whether one scraped business is actually worth pitching, and pick the
 * angle to open with.
 *
 * The deterministic scorer already checked the mechanical filters. This pass
 * reads the bio the way a human would: is this a real operating business, does
 * the offer genuinely fit, and what specifically about them is worth mentioning.
 */
const qualifyLead = async ({ lead, offer = {}, icp = '' }) => {
  // With no offer there is nothing to judge fit against. Asking anyway makes
  // the model invent criteria and reject real businesses, which surfaces as
  // "discovery found nothing". Pass them through for the human to judge.
  if (!offer.what || !offer.what.trim()) {
    return {
      fit: 'moderate',
      angle: '',
      reasoning: 'No offer described on the campaign, so fit was not assessed.',
    }
  }

  const systemPrompt = `
You are a B2B sales researcher who qualifies inbound prospect lists. You are
sceptical and specific. Most leads on a scraped list are a poor fit and you say so.

CRITICAL RULES:
- Judge fit against the offer, not against how nice the business looks
- "strong" means the offer solves a problem this business visibly has right now
- "unqualified" means do not contact: personal account, dormant, wrong industry, or a reseller
- The angle must reference something CONCRETE from their profile, never a generic compliment
- Never invent facts about the business that are not in the data given
- An empty bio means our scraper could not read it, NOT that the business is
  inactive or unqualified. Never cite a missing bio, missing contact details or
  a missing business-account flag as a reason to reject. Judge only on what is
  actually present.
- NEVER use em dashes (—) or double hyphens (--) anywhere in the output text
- Always return ONLY valid JSON, no markdown fences, no explanations
`.trim()

  const userPrompt = `
WHAT I SELL: ${offer.what || 'not specified'}
PROBLEM IT SOLVES: ${offer.painPoint || 'not specified'}
MY IDEAL CUSTOMER: ${icp || 'not specified'}

PROSPECT PROFILE:
- Username: @${lead.username}
- Name: ${lead.fullName || 'unknown'}
- Instagram category: ${lead.category || 'none listed'}
- Bio: ${lead.bio || '(empty bio)'}
- Followers: ${lead.followers} | Following: ${lead.following} | Posts: ${lead.postsCount}
- Website in bio: ${lead.hasWebsite ? 'yes' : 'NO WEBSITE'}
- Business account: ${lead.isBusinessAccount ? 'yes' : 'no'}
- Public contact: ${[lead.contact?.email, lead.contact?.phone].filter(Boolean).join(', ') || 'none'}
- Last posted: ${lead.lastPostAt ? new Date(lead.lastPostAt).toDateString() : 'unknown'}
- Found via: ${lead.discoveredVia?.query || 'search'}

Return a JSON object:
{
  "fit": "strong" | "moderate" | "weak" | "unqualified",
  "angle": "...",      // one specific observation about THIS business to open the DM with, max 20 words
  "reasoning": "..."   // why this fit rating, max 30 words
}
`.trim()

  const raw = await chat(systemPrompt, userPrompt, { temperature: 0.4, maxTokens: 400 })
  const parsed = extractJson(raw)
  if (!parsed || typeof parsed !== 'object') {
    return { fit: 'moderate', angle: '', reasoning: 'AI qualification unavailable' }
  }
  const fit = ['strong', 'moderate', 'weak', 'unqualified'].includes(parsed.fit) ? parsed.fit : 'moderate'
  return cleanTextFields({ fit, angle: parsed.angle || '', reasoning: parsed.reasoning || '' })
}

/**
 * Write the opening DM for one lead.
 *
 * Instagram DMs are read on a phone, usually mid-task, by someone who did not
 * ask to hear from you. Length is the single biggest driver of whether it gets
 * read, so the prompt is aggressive about brevity and about sounding like a
 * person who actually looked at their page.
 */
const draftLeadDm = async ({ lead, offer = {}, brandVoice, angle = '' }) => {
  const voiceCtx = buildVoiceContext(brandVoice)

  const systemPrompt = `
You write cold Instagram DMs that get replies from small business owners.

You understand the medium: the recipient is on their phone, did not ask to hear
from you, and will delete anything that smells like a template or a pitch deck.
Short, specific, and human wins. Every message must prove you looked at their page.

${voiceCtx}

CRITICAL RULES:
- STRICTLY under 400 characters total. Shorter is better. 2 to 4 short sentences.
- Open by referencing something SPECIFIC about their business, never "Hi, I hope you are well"
- Never open with "I came across your page" or "I love what you are doing"
- No emojis unless the brand voice explicitly uses them
- No links in a first message. Instagram suppresses DMs with links from strangers.
- End with ONE low-friction question. Never "let me know if interested"
- Do not claim results, clients, or numbers that were not given to you
- Never use the words "reach out", "circle back", "synergy", "leverage", or "game changer"
- NEVER use em dashes (—) or double hyphens (--) anywhere in the output text. Use commas or short sentences.
- Always return ONLY valid JSON, no markdown fences, no explanations
`.trim()

  const userPrompt = `
WHAT I SELL: ${offer.what || 'not specified'}
PROBLEM IT SOLVES: ${offer.painPoint || 'not specified'}
MY PROOF / CREDIBILITY: ${offer.proof || 'none given, do not invent any'}
DESIRED NEXT STEP: ${offer.callToAction || 'a short reply showing interest'}

WHO I AM MESSAGING:
- Handle: @${lead.username}
- Business name: ${lead.fullName || lead.username}
- Category: ${lead.category || 'unknown'}
- Bio: ${lead.bio || '(empty bio)'}
- Followers: ${lead.followers}
- Has a website: ${lead.hasWebsite ? 'yes' : 'NO, no website anywhere in their bio'}
- Location context: ${lead.location || 'unknown'}
${angle ? `- Angle to lead with: ${angle}` : ''}

Write the opening DM.

Return a JSON object:
{
  "message": "...",   // the DM text, under 400 characters, ready to send as-is
  "hook": "..."       // the specific detail about them the message opens on, max 12 words
}
`.trim()

  const raw = await chat(systemPrompt, userPrompt, { temperature: 0.85, maxTokens: 600 })
  const parsed = extractJson(raw)
  if (!parsed || !parsed.message) throw new Error('DeepSeek returned no DM message')

  const cleaned = cleanTextFields(parsed)
  // Hard cap regardless of what the model did, DMs over ~400 chars get ignored
  cleaned.message = String(cleaned.message).trim().slice(0, 900)
  return cleaned
}

/**
 * Write a phone / WhatsApp opener for a Google Maps lead.
 *
 * A call is not a DM. The recipient answers mid-task, has three seconds of
 * patience, and can hear a script being read. So this asks for something a
 * person would actually say out loud: short, concrete, no marketing register,
 * and a question early enough that it becomes a conversation rather than a
 * pitch.
 */
const draftCallScript = async ({ lead, offer = {}, channel = 'call' }) => {
  const isWhatsApp = channel === 'whatsapp'

  const systemPrompt = `
You write opening lines for ${isWhatsApp ? 'WhatsApp messages' : 'cold calls'} to small local business owners.

The person ${isWhatsApp ? 'is on their phone and did not ask to hear from you' : 'has picked up mid-shift and is busy'}.
You get one sentence to earn the next ten. Sound like a human who looked them up,
not like a script being read.

CRITICAL RULES:
- ${isWhatsApp ? 'Under 300 characters' : 'Under 55 spoken words'}. Shorter is better.
- Open with something SPECIFIC and verifiable about their business, never a greeting formula
- Never say "I hope you are well", "quick question", "how are you doing today"
- Reference the concrete gap: they are on Google with reviews but have no website
- Ask ONE question early so it becomes a conversation, not a monologue
- No jargon: never "solutions", "leverage", "digital presence", "online footprint"
- Do not invent results, clients or numbers that were not given to you
- NEVER use em dashes or double hyphens anywhere in the output text
- Always return ONLY valid JSON, no markdown fences, no explanations
`.trim()

  const userPrompt = `
WHAT I SELL: ${offer.what || 'not specified'}
PROBLEM IT SOLVES: ${offer.painPoint || 'not specified'}
MY PROOF: ${offer.proof || 'none given, do not invent any'}
DESIRED NEXT STEP: ${offer.callToAction || 'a short conversation'}

THE BUSINESS:
- Name: ${lead.fullName || lead.username}
- Category: ${lead.google?.primaryType || lead.category || 'unknown'}
- Address: ${lead.google?.formattedAddress || 'unknown'}
- Google rating: ${lead.google?.rating || 'none'} from ${lead.google?.reviewCount || 0} reviews
- Website: ${lead.hasWebsite ? 'has one' : 'NONE listed on Google'}
- Phone: ${lead.google?.phone || 'unknown'}

Write the ${isWhatsApp ? 'WhatsApp opener' : 'call opener'}.

Return a JSON object:
{
  "script": "...",      // what to ${isWhatsApp ? 'send' : 'say'}, ready to use as-is
  "hook": "...",        // the specific detail it opens on, max 12 words
  "objection": "..."    // the most likely first objection and a one-line answer
}
`.trim()

  const raw = await chat(systemPrompt, userPrompt, { temperature: 0.85, maxTokens: 600 })
  const parsed = extractJson(raw)
  if (!parsed || !parsed.script) throw new Error('DeepSeek returned no call script')
  return cleanTextFields(parsed)
}

/**
 * Write a follow-up message for a lead who did not reply.
 *
 * The hard part is not writing another message, it is writing one that earns a
 * reply the first did not. So the prompt is given every previous touch and told
 * to add something new rather than restate. A follow-up that repeats the
 * opener, or that opens with "just bumping this", performs worse than sending
 * nothing at all: it confirms you are running a sequence.
 *
 * Touch 2 is a light nudge with a fresh angle. Touch 3 is a close: short,
 * gives them an easy out, and does not ask again after.
 */
const draftFollowUp = async ({ lead, offer = {}, brandVoice, previousTouches = [], touchNumber = 2, channel = 'dm' }) => {
  const voiceCtx = buildVoiceContext(brandVoice)
  const isFinal = touchNumber >= 3
  const isWhatsApp = channel === 'whatsapp'

  const systemPrompt = `
You write follow-up messages to small business owners who did not reply to a
first ${isWhatsApp ? 'WhatsApp message' : 'cold DM'}.

Silence is not rejection, it is usually a missed notification or a busy week.
But a second message that repeats the first proves you are working a list, and
that is worse than staying quiet.

${voiceCtx}

CRITICAL RULES:
- STRICTLY shorter than the original message. Two sentences is ideal.
- Say something NEW. A different angle, a concrete example, or one specific
  observation about their business that the first message did not use.
- NEVER open with "just following up", "bumping this", "circling back",
  "did you see my message", or any apology for messaging again
- Do not restate the offer in the same words as the first message
- No guilt, no false urgency, no fake deadlines
${isFinal ? `- This is the LAST message. Give them a graceful way out, make clear you
  will not chase again, and keep the door open without asking a question that
  demands an answer.` : `- End with ONE easy question, lighter than the first message asked`}
- NEVER use em dashes or double hyphens anywhere in the output text
- Always return ONLY valid JSON, no markdown fences, no explanations

Return a JSON object:
{
  "message": "...",   // ready to send as-is
  "angle": "..."      // what is new in this one versus the previous, max 10 words
}
`.trim()

  const history = previousTouches
    .map((t, i) => `Touch ${i + 1} (${t.sentAt ? new Date(t.sentAt).toDateString() : 'earlier'}): ${t.text}`)
    .join('\n\n')

  const userPrompt = `
WHAT I SELL: ${offer.what || 'not specified'}
PROBLEM IT SOLVES: ${offer.painPoint || 'not specified'}
DESIRED NEXT STEP: ${offer.callToAction || 'a short reply'}

THE BUSINESS:
- Name: ${lead.fullName || lead.username}
- Category: ${lead.category || lead.google?.primaryType || 'unknown'}
- Bio or description: ${lead.bio || '(none)'}
- Has a website: ${lead.hasWebsite ? 'yes' : 'NO'}
${lead.google?.rating ? `- Google rating: ${lead.google.rating} from ${lead.google.reviewCount} reviews` : ''}

WHAT I ALREADY SENT THEM, and they did not reply to:

${history || '(no history recorded)'}

Write touch ${touchNumber}${isFinal ? ', the final message' : ''}.
`.trim()

  const raw = await chat(systemPrompt, userPrompt, { temperature: 0.9, maxTokens: 500 })
  const parsed = extractJson(raw)
  if (!parsed || !parsed.message) throw new Error('DeepSeek returned no follow-up message')

  const cleaned = cleanTextFields(parsed)
  cleaned.message = String(cleaned.message).trim().slice(0, 700)
  return cleaned
}

module.exports = {
  generateXPosts,
  generateLinkedInPost,
  generateInstagramCaption,
  generateContentIdeas,
  generatePostIdeas,
  generateBrandVoiceProfile,
  generateMarketingStrategy,
  generateEngagements,
  generateReply,
  generateContextualReply,
  generateNicheTrendingHashtags,
  expandLeadQueries,
  qualifyLead,
  draftLeadDm,
  draftCallScript,
  draftFollowUp,
}
