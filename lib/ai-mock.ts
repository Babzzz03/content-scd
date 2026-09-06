/**
 * AI generation bridge — calls the PostFlow backend (DeepSeek).
 * Falls back to local mock if the backend is unreachable (e.g. dev without server).
 */

import { generateApi } from "@/lib/api/generate"
import { ApiError } from "@/lib/api/client"
import type {
  PostWizardState,
  GeneratedPostContent,
  FlyerContent,
  ContentIdeasInput,
  ContentIdea,
  ReplyComposerInput,
  GeneratedReply,
  EngageComposerInput,
  GeneratedEngagement,
  ContentIdeaType,
  MarketingStrategyInput,
  MarketingStrategy,
  AIProviderID,
  PostIdea,
  PostIdeasInput,
  ContentTone,
  Platform,
} from "@/lib/types"

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AnyObj = Record<string, unknown>

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function strArr(v: unknown): string[] {
  return arr(v).filter((x): x is string => typeof x === "string")
}

function normalizePlatform(v: unknown, fallback: Platform): Platform {
  const value = str(v).trim().toLowerCase()
  if (value === "x" || value === "twitter") return "x"
  if (value === "linkedin") return "linkedin"
  if (value === "instagram" || value === "ig") return "instagram"
  return fallback
}

function normalizePostType(v: unknown, platform: Platform): PostIdea["postType"] {
  const value = str(v).trim().toLowerCase()
  if (value === "thread") return "thread"
  if (value === "story") return "story"
  if (value === "carousel") return "carousel"
  if (value === "text") return "text"
  if (value === "image") return "image"
  if (platform === "x") return "single"
  if (platform === "linkedin") return "text"
  return "single"
}

function normalizeDifficulty(v: unknown): PostIdea["difficulty"] {
  const value = str(v).trim().toLowerCase()
  if (value === "easy" || value === "medium" || value === "hard") return value
  return undefined
}

function normalizeContentIdeaType(v: unknown, fallback: ContentIdeaType): ContentIdeaType {
  const value = str(v).trim().toLowerCase()
  if (value === "tutorial" || value === "educational") return "educational"
  if (value === "reaction") return "trending"
  if (value === "day-in-the-life") return "storytelling"
  if (value === "bts" || value === "behind the scenes" || value === "behind-the-scenes") return "behind-the-scenes"
  if (
    value === "skit" ||
    value === "comedy" ||
    value === "non-verbal" ||
    value === "verbal" ||
    value === "promotional" ||
    value === "testimonial" ||
    value === "trending" ||
    value === "storytelling"
  ) return value as ContentIdeaType
  return fallback
}

// ─── Post Content ─────────────────────────────────────────────────────────────

export async function generatePostContent(
  state: PostWizardState,
  _provider: AIProviderID | null = null
): Promise<GeneratedPostContent> {
  try {
    const res = await generateApi.post({
      platform: state.platform,
      topic: state.aiInput.topic,
      postType: state.postType ?? "single",
      format: state.postType ?? undefined,
      useBrandVoice: state.aiInput.useBrandVoice,
      mediaDescription: state.aiInput.additionalContext || (state.imageFile
        ? `User has uploaded a custom image for this post`
        : undefined),
    })

    // The API client returns the full envelope: { success, message, data: { posts } }
    const rawData = res as AnyObj
    const innerData = rawData?.data as AnyObj | undefined
    const postsArray = arr(innerData?.posts ?? rawData?.posts)

    // Build a GeneratedPostContent from a single raw post object
    const buildVariation = (raw: AnyObj, idx: number): Omit<GeneratedPostContent, "variations"> => {
      const flyerHeadline = str(raw.flyerHeadline, state.aiInput.topic).toUpperCase()
      const flyerSubtext  = str(raw.flyerSubtext, "")

      if (state.platform === "x" && state.postType === "thread") {
        const threadParts = strArr(raw.threadParts)
        return {
          caption: str(raw.content, state.aiInput.topic),
          flyers: [{ id: `f${idx}-1`, text: flyerHeadline, subtext: flyerSubtext || "Thread — tap to read all posts" }],
          imageSuggestion: str(raw.suggestedMediaAlt, `Upload an image that represents ${state.aiInput.topic}`),
          hashtags: strArr(raw.hashtags),
          threadPosts: threadParts.length > 0 ? [str(raw.content), ...threadParts] : [str(raw.content)],
        }
      }
      if (state.platform === "instagram") {
        const caption = str(raw.caption ?? raw.content, state.aiInput.topic)
        const cta = str(raw.callToAction, "Swipe to see more")
        const flyers: FlyerContent[] = state.postType === "carousel"
          ? [
              { id: `f${idx}-1`, text: flyerHeadline, subtext: flyerSubtext || cta },
              { id: `f${idx}-2`, text: "SWIPE →", subtext: caption.slice(0, 80) },
              { id: `f${idx}-3`, text: "KEY TAKEAWAY", subtext: cta },
              { id: `f${idx}-4`, text: "SAVE THIS ↓", subtext: "Come back to this later" },
              { id: `f${idx}-5`, text: "FOLLOW FOR MORE", subtext: "We share content like this every week" },
            ]
          : [
              { id: `f${idx}-1`, text: flyerHeadline, subtext: flyerSubtext || cta },
              { id: `f${idx}-2`, text: "SAVE THIS ↓", subtext: caption.slice(0, 60) },
            ]
        return {
          caption,
          flyers,
          imageSuggestion: `Upload a warm, authentic image connecting to "${state.aiInput.topic}"`,
          hashtags: strArr(raw.hashtags),
        }
      }
      if (state.platform === "linkedin") {
        const content = str(raw.content, state.aiInput.topic)
        return {
          caption: content,
          flyers: [{ id: `f${idx}-1`, text: flyerHeadline, subtext: flyerSubtext || str(raw.callToAction, "Read the full post") }],
          imageSuggestion: `Upload a professional image that supports the "${state.aiInput.topic}" narrative`,
          hashtags: strArr(raw.hashtags),
        }
      }
      // X single (fallback)
      return {
        caption: str(raw.content, state.aiInput.topic),
        flyers: [{ id: `f${idx}-1`, text: flyerHeadline, subtext: flyerSubtext || "Read more below" }],
        imageSuggestion: `Upload an image related to "${state.aiInput.topic}"`,
        hashtags: strArr(raw.hashtags),
      }
    }

    const variations = postsArray.map((p, i) => buildVariation((p ?? {}) as AnyObj, i))
    const result: GeneratedPostContent = {
      ...variations[0],
      variations,
    }
    console.log("[GENERATE] variations count:", variations.length, "| first caption:", result.caption?.slice(0, 80))
    return result
  } catch (err) {
    // Re-throw API errors (quota, auth, etc.) so callers can show proper UI
    if (err instanceof ApiError) throw err
    // Only fall back to mock for network/offline failures
    console.error("[GENERATE] network error — falling back to mock:", err)
    return mockPostContent(state)
  }
}

// ─── Image Suggestion ─────────────────────────────────────────────────────────

export async function generateImageSuggestion(
  _caption: string,
  _flyerStyle: string,
  _provider: AIProviderID | null = null
): Promise<string> {
  const suggestions = [
    "Upload a high-energy action shot of a person confidently working at their desk",
    "Upload an image of modern tech gadgets arranged on a clean flat lay",
    "Upload a warm, natural-light portrait of a person smiling directly at the camera",
    "Upload a minimalist product shot on a white or neutral background",
    "Upload a dynamic outdoor lifestyle image with natural textures in the background",
  ]
  return suggestions[Math.floor(Math.random() * suggestions.length)]
}

// ─── Replies ──────────────────────────────────────────────────────────────────

export async function generateReplies(
  input: ReplyComposerInput,
  _provider: AIProviderID | null = null
): Promise<GeneratedReply[]> {
  try {
    const res = await generateApi.reply({
      originalPost: input.originalPost,
      platform: input.platform,
      replyIntent: input.tone,
      useBrandVoice: input.useBrandVoice,
      topComments: input.topComments,
    })
    return arr(res.data.replies).map((r, i) => {
      const obj = (r ?? {}) as AnyObj
      const text = str(obj.text ?? obj.reply ?? obj.content, "")
      return {
        id: `reply-${i + 1}`,
        text,
        tone: (str(obj.tone) || input.tone) as ContentTone,
        characterCount: text.length,
      }
    })
  } catch (err) {
    if (err instanceof ApiError) throw err
    return mockReplies()
  }
}

// ─── Engagements ──────────────────────────────────────────────────────────────

export async function generateEngagements(
  input: EngageComposerInput,
  _provider: AIProviderID | null = null
): Promise<GeneratedEngagement[]> {
  try {
    const res = await generateApi.engagements({
      platform: input.platform,
      topic: input.topic,
      tone: input.tone,
      engagementType: input.engagementType,
      count: input.count ?? 4,
    })
    const items = arr(res.data.engagements)
    if (items.length) {
      return items.map((item, i) => {
        const obj = (item ?? {}) as AnyObj
        return {
          id: `eng-${i}`,
          text: str(obj.text),
          type: str(obj.type, input.engagementType ?? 'comment') as GeneratedEngagement['type'],
          characterCount: str(obj.text).length,
        }
      })
    }
  } catch {
    // fall through to mock
  }
  return mockEngagements()
}

// ─── Content Ideas ────────────────────────────────────────────────────────────

export async function generateContentIdeas(
  input: ContentIdeasInput,
  _provider: AIProviderID | null = null
): Promise<ContentIdea[]> {
  const res = await generateApi.contentIdeas({
    count: input.count * input.contentTypes.length || input.count,
    platforms: input.platforms,
    goals: input.topic,
    useBrandVoice: input.useBrandVoice,
  })
  const topic = input.topic || "your niche"
  return arr(res.data.ideas).map((idea, i) => {
    const obj = (idea ?? {}) as AnyObj
    const platform = normalizePlatform(obj.platform, input.platforms[0] ?? "instagram")
    const fallbackType = input.contentTypes[i % input.contentTypes.length] || "educational"
    const format = str(obj.format)
    const hook = str(obj.hook)
    const whyItWorks = str(obj.whyItWorks)
    const description = str(obj.description ?? obj.hook, "")
    return {
      id: `gen-idea-${i}`,
      type: normalizeContentIdeaType(obj.format ?? obj.type, fallbackType),
      title: str(obj.title, `Content Idea ${i + 1}`),
      description,
      format,
      hook,
      whyItWorks,
      difficulty: normalizeDifficulty(obj.difficulty),
      trendingTags: strArr(obj.trendingTags).map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)),
      suggestedCaption: hook,
      platforms: [platform],
      estimatedDuration: "30–60 seconds",
      callToAction: "Save for later",
      videoPrompt: str(obj.videoPrompt, `Cinematic ${format || "short-form"} video about ${topic}`),
    }
  })
}

// ─── Marketing Strategy ───────────────────────────────────────────────────────

export async function generateMarketingStrategy(
  input: MarketingStrategyInput,
  _provider: AIProviderID | null = null
): Promise<MarketingStrategy> {
  try {
    const res = await generateApi.strategy({
      goals: input.goals.join(", "),
      budget: input.budget,
      platforms: input.platforms,
      useBrandVoice: input.useBrandVoice,
      timeline: input.timeline,
      businessStage: input.businessStage,
      additionalContext: input.additionalContext,
    })
    const s = (res.data.strategy ?? {}) as AnyObj
    const timelineLabel =
      input.timeline === "1-month"
        ? "30 days"
        : input.timeline === "3-months"
          ? "90 days"
          : input.timeline === "6-months"
            ? "6 months"
            : "1 year"

    return {
      id: `strategy-${Date.now()}`,
      overview: str(
        s.overview ?? s.summary ?? s.executiveSummary,
        "Your personalised marketing strategy is ready."
      ),
      contentPillars: arr(s.contentPillars).map((p) => {
        const obj = (p ?? {}) as AnyObj
        const exampleTopics = strArr(obj.exampleTopics)
        return {
          name: str(obj.name ?? obj.pillar, "Content Pillar"),
          description: str(obj.description ?? obj.rationale, ""),
          exampleFormats: strArr(obj.exampleFormats).length > 0 ? strArr(obj.exampleFormats) : exampleTopics,
          postingFrequency: str(
            obj.postingFrequency ??
              ((s.postingSchedule as AnyObj)?.[input.platforms[0] ?? "x"] as AnyObj)?.frequency ??
              `Planned across ${timelineLabel}`,
            "2–3× per week"
          ),
        }
      }),
      growthTactics: arr(s.growthTactics).map((t) => {
        const obj = (t ?? {}) as AnyObj
        const steps = strArr(obj.steps)
        const expectedOutcome = str(obj.expectedOutcome)
        const details = [steps.length ? `Steps: ${steps.join(" | ")}` : "", expectedOutcome ? `Outcome: ${expectedOutcome}` : ""]
          .filter(Boolean)
          .join("\n\n")
        return {
          title: str(obj.title ?? obj.tactic, "Growth Tactic"),
          description: str(obj.description, details),
          effort: (str(obj.effort) || "medium") as "low" | "medium" | "high",
          impact: (str(obj.impact) || "medium") as "low" | "medium" | "high",
        }
      }),
      toolRecommendations: arr(s.toolRecommendations ?? s.tools).map((t) => {
        const obj = (t ?? {}) as AnyObj
        return {
          name: str(obj.name ?? obj.tool, "Tool"),
          category: str(obj.category ?? obj.purpose, ""),
          description: str(obj.description ?? obj.purpose, ""),
          pricing: str(obj.pricing ?? obj.cost, ""),
        }
      }),
      kpis: arr(s.kpis).map((k) => {
        const obj = (k ?? {}) as AnyObj
        const targetParts = [
          obj.target,
          obj.target30d ? `30d: ${obj.target30d}` : "",
          obj.target60d ? `60d: ${obj.target60d}` : "",
          obj.target90d ? `90d: ${obj.target90d}` : "",
        ].filter(Boolean)
        return {
          metric: str(obj.metric, "KPI"),
          target: str(targetParts.join(" | "), ""),
          timeframe: str(obj.timeframe, timelineLabel),
          howToMeasure: str(
            obj.howToMeasure,
            "Track progress in your platform analytics and compare against these milestone targets."
          ),
        }
      }),
      roadmap:
        arr(s.roadmap ?? s.phases).length > 0
          ? arr(s.roadmap ?? s.phases).map((r) => {
              const obj = (r ?? {}) as AnyObj
              return {
                phase: str(obj.phase ?? obj.title, "Phase"),
                timeframe: str(obj.timeframe, ""),
                focus: str(obj.focus ?? obj.description, ""),
                actions: strArr(obj.actions),
              }
            })
          : [
              {
                phase: "Phase 1 - Foundation",
                timeframe: "Days 1-30",
                focus: "Profile setup, first content system, and initial visibility",
                actions: strArr(s.quickWins),
              },
              {
                phase: "Phase 2 - Traction",
                timeframe: "Days 31-60",
                focus: "Double down on winning content pillars and repeatable engagement",
                actions: arr(s.growthTactics)
                  .slice(0, 3)
                  .map((t) => str((t as AnyObj).tactic ?? (t as AnyObj).title))
                  .filter(Boolean),
              },
              {
                phase: "Phase 3 - Scale",
                timeframe: "Days 61-90",
                focus: "Partnerships, optimization, and stronger conversion from profile visits",
                actions: arr(s.growthTactics)
                  .slice(3)
                  .map((t) => str((t as AnyObj).tactic ?? (t as AnyObj).title))
                  .filter(Boolean),
              },
            ],
      generatedAt: new Date(),
    }
  } catch (err) {
    if (err instanceof ApiError) throw err
    return mockMarketingStrategy(input)
  }
}

// ─── Post Ideas ───────────────────────────────────────────────────────────────

export async function generatePostIdeas(
  input: PostIdeasInput,
  _provider: AIProviderID | null = null
): Promise<PostIdea[]> {
  try {
    const res = await generateApi.postIdeas({
      platform: input.platforms[0],
      topic: input.topic,
      count: input.count,
      useBrandVoice: input.useBrandVoice,
    })
    return arr(res.data.ideas).map((idea, i) => {
      const obj = (idea ?? {}) as AnyObj
      const platform = normalizePlatform(obj.platform, input.platforms[0] ?? "instagram")
      const hook = str(obj.hook)
      const description = str(obj.description ?? obj.caption ?? obj.content ?? obj.contentBrief, "")
      const whyItWorks = str(obj.whyItWorks ?? obj.angle)
      const format = str(obj.format)

      return {
        id: `post-idea-${platform}-${i}`,
        platform,
        postType: normalizePostType(obj.postType ?? obj.format, platform),
        title: str(obj.title, `Post Idea ${i + 1}`),
        caption: [hook, description].filter(Boolean).join("\n\n"),
        hashtags: strArr(obj.hashtags ?? obj.trendingTags).map((tag) =>
          tag.startsWith("#") ? tag : `#${tag}`
        ),
        tone: (str(obj.tone) || input.tone) as ContentTone,
        format,
        hook,
        whyItWorks,
        difficulty: normalizeDifficulty(obj.difficulty),
        imagePrompt: str(obj.imagePrompt, whyItWorks),
        saved: false,
      }
    })
  } catch (err) {
    if (err instanceof ApiError) throw err
    return mockPostIdeas(input)
  }
}

// ─── Video Prompt ─────────────────────────────────────────────────────────────

export async function generateVideoPrompt(
  idea: ContentIdea,
  _provider: AIProviderID | null = null
): Promise<string> {
  if (idea.videoPrompt) return idea.videoPrompt
  return `Cinematic close-up of hands typing on a laptop in a modern coworking space, warm golden-hour light streaming through floor-to-ceiling windows. Quick cuts between team collaboration moments. Text overlay: '${idea.title}'. Aspect ratio 9:16.`
}

// ─── Brand Voice Analyzer ─────────────────────────────────────────────────────

export async function analyzeBrandVoice(
  input: {
    brandName?: string
    industry?: string
    targetAudience?: string
    keyMessages?: string[]
    tone?: string[]
    competitors?: string[]
    description?: string
    tagline?: string
    styleNotes?: string
  },
  _provider: AIProviderID | null = null
) {
  const res = await generateApi.brandVoice({
    brandName: input.brandName,
    industry: input.industry,
    tagline: input.tagline,
    targetAudience: input.targetAudience,
    brandValues: (input.keyMessages ?? []).join(", "),
    toneKeywords: input.tone,
    competitors: input.competitors,
    sampleContent: input.description || input.tagline || input.brandName,
    styleNotes: input.styleNotes,
  })
  const brandVoice = (res.data.brandVoice ?? {}) as AnyObj
  const profile = ((brandVoice.voiceProfile ?? {}) as AnyObj)
  const signaturePhrases = strArr(profile.signaturePhrases)
  const contentPillars = strArr(profile.contentPillars)
  const personalityAdjectives = strArr(profile.personalityAdjectives)
  const languageToUse = strArr(profile.languageToUse)
  const languageToAvoid = strArr(profile.languageToAvoid)
  const styleBlocks = [
    str(brandVoice.styleNotes ?? profile.styleNotes ?? profile.toneGuidelines),
    languageToUse.length ? `Use: ${languageToUse.join(", ")}` : "",
    languageToAvoid.length ? `Avoid: ${languageToAvoid.join(", ")}` : "",
    str(profile.emojiGuideline) ? `Emoji usage: ${str(profile.emojiGuideline)}` : "",
    str(profile.hashtagStrategy) ? `Hashtag strategy: ${str(profile.hashtagStrategy)}` : "",
  ].filter(Boolean)

  return {
    brandName: str(brandVoice.brandName ?? input.brandName),
    industry: str(brandVoice.industry ?? input.industry),
    targetAudience: str(brandVoice.targetAudience ?? profile.targetAudienceSummary ?? input.targetAudience),
    tagline: str(brandVoice.tagline ?? profile.taglineSuggestion ?? input.tagline),
    description: str(brandVoice.sampleContent ?? profile.aboutBrandSummary ?? input.description),
    suggestedTones: strArr(brandVoice.toneKeywords).length > 0 ? strArr(brandVoice.toneKeywords) : strArr(profile.recommendedToneKeywords ?? profile.personalityAdjectives),
    suggestedMessages: strArr(profile.keyMessages).length > 0 ? strArr(profile.keyMessages) : (signaturePhrases.length > 0 ? signaturePhrases : contentPillars),
    styleNotes: styleBlocks.join("\n\n") || "Speak authentically and with purpose.",
    personalityAdjectives,
    languageToUse,
    languageToAvoid,
    emojiGuideline: str(profile.emojiGuideline),
    hashtagStrategy: str(profile.hashtagStrategy),
    platformNotes: (profile.platformNotes ?? {}) as Record<string, string>,
  }
}

// ─── Local fallbacks (used when backend is unreachable) ───────────────────────

function mockPostContent(state: PostWizardState): GeneratedPostContent {
  const topic = state.aiInput.topic || "your topic"
  return {
    caption: `${topic} just changed the game. Here's what nobody's saying about it. Your move 👇`,
    flyers: [{ id: "f1", text: topic.toUpperCase(), subtext: "The unlock most people miss" }],
    imageSuggestion: `Upload an image related to "${topic}"`,
    hashtags: [`#${topic.replace(/\s+/g, "")}`, "#ContentStrategy"],
  }
}

function mockReplies(): GeneratedReply[] {
  return [
    { id: "reply-1", text: "This is such a valid point. Authenticity always wins.", tone: "professional", characterCount: 55 },
    { id: "reply-2", text: "Completely agree 👊 The brands winning right now are the most consistent.", tone: "casual", characterCount: 72 },
    { id: "reply-3", text: "Great perspective. Worth A/B testing your hypothesis with real data.", tone: "educational", characterCount: 67 },
  ]
}

function mockEngagements(): GeneratedEngagement[] {
  return [
    { id: "engage-1", text: "The shift from broadcast to conversation is the most underrated growth lever right now.", type: "insight", characterCount: 86 },
    { id: "engage-2", text: "What's the one thing your audience consistently asks for that you haven't built yet?", type: "question", characterCount: 85 },
    { id: "engage-3", text: "Hot take: brands with the clearest voice will outperform big players in the next 18 months.", type: "conversation-starter", characterCount: 91 },
    { id: "engage-4", text: "The intentionality behind every post is immediately visible — it makes a difference.", type: "comment", characterCount: 83 },
  ]
}

function mockMarketingStrategy(input: MarketingStrategyInput): MarketingStrategy {
  return {
    id: `strategy-${Date.now()}`,
    overview: `A targeted growth strategy focused on ${input.goals.join(", ")} across ${input.platforms.join(", ")}.`,
    contentPillars: [
      { name: "Authority & Expertise", description: "Demonstrate deep knowledge.", exampleFormats: ["How-to carousels", "Threads"], postingFrequency: "2–3× per week" },
      { name: "Behind the Brand", description: "Humanise your brand.", exampleFormats: ["BTS videos", "Day-in-the-life"], postingFrequency: "1× per week" },
    ],
    growthTactics: [
      { title: "Consistency Over Volume", description: "Post on a fixed schedule.", effort: "medium", impact: "high" },
      { title: "First-Hour Engagement", description: "Be active in comments right after posting.", effort: "low", impact: "high" },
    ],
    toolRecommendations: [
      { name: "PostFlow", category: "Content Scheduling", description: "AI post generator + scheduler.", pricing: "Your current plan" },
    ],
    kpis: [
      { metric: "Follower Growth Rate", target: "5–10% MoM", timeframe: "Monthly", howToMeasure: "(New - Lost) / Start × 100" },
      { metric: "Engagement Rate", target: "3–6%", timeframe: "Per post", howToMeasure: "(Likes + Comments + Saves) / Reach × 100" },
    ],
    roadmap: [
      { phase: "Phase 1 — Foundation", timeframe: "Month 1", focus: "Set up systems", actions: ["Complete brand voice profile", "Set posting schedule"] },
      { phase: "Phase 2 — Growth", timeframe: "Month 2–3", focus: "Build momentum", actions: ["Launch all content pillars", "Engage in niche communities daily"] },
    ],
    generatedAt: new Date(),
  }
}

function mockPostIdeas(input: PostIdeasInput): PostIdea[] {
  const topic = input.topic || "your brand"
  return input.platforms.flatMap((platform) =>
    Array.from({ length: Math.min(input.count, 3) }, (_, i) => ({
      id: `mock-post-idea-${platform}-${i}`,
      platform,
      postType: "single" as PostIdea["postType"],
      title: `Post Idea #${i + 1}: ${topic}`,
      caption: `Here's something worth knowing about ${topic}. Your audience will love this.`,
      hashtags: [`#${topic.replace(/\s+/g, "")}`, "#ContentMarketing"],
      tone: input.tone,
      saved: false,
    }))
  )
}
