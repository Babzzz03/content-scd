// ─── Platforms ───────────────────────────────────────────────────────────────
export type Platform = "x" | "linkedin" | "instagram"

// ─── Post Types (platform-specific) ──────────────────────────────────────────
export type XPostType = "single" | "thread"
export type InstagramPostType = "single" | "carousel" | "story"
export type LinkedInPostType = "text" | "image" | "carousel"
export type PostType = XPostType | InstagramPostType | LinkedInPostType

// ─── Content ──────────────────────────────────────────────────────────────────
export type ContentTone =
  | "professional"
  | "casual"
  | "humorous"
  | "educational"
  | "inspirational"
  | "promotional"
  | "bold"
  | "empathetic"

export type ContentIdeaType =
  | "skit"
  | "comedy"
  | "non-verbal"
  | "verbal"
  | "educational"
  | "promotional"
  | "behind-the-scenes"
  | "testimonial"
  | "trending"
  | "storytelling"

// ─── Post Status ──────────────────────────────────────────────────────────────
export type PostStatus = "draft" | "scheduled" | "published" | "failed"

// ─── Flyer Template ───────────────────────────────────────────────────────────
export type FlyerLayout =
  | "breaking"
  | "color-pop"
  | "editorial"
  | "impact"
  | "dramatic"
  | "badge"
  | "gradient-text"
  | "story"

export interface FlyerTemplate {
  id: string
  name: string
  description: string
  hasImageSlot: boolean
  hasTextSlot: boolean
  imageSlotHint?: string
  style: "minimal" | "bold" | "gradient" | "dark" | "light" | "branded"
  aspectRatio: "1:1" | "4:5" | "9:16" | "16:9"
  previewBg: string // tailwind gradient class (kept for backward compat)
  // Visual canvas fields
  layout: FlyerLayout
  accentColor: string       // CSS color for highlights
  tintColor?: string        // colour-grade overlay for "dramatic" layout
  categoryLabel?: string    // preset tag shown on the flyer
  demoText?: string         // example headline shown in picker preview
  previewAnchor?: "top" | "center" | "bottom" // which part to show when clipping
}

// ─── Wizard State ─────────────────────────────────────────────────────────────
export interface PostWizardState {
  platform: Platform
  postType: PostType | null
  aiInput: {
    topic: string
    tone: ContentTone
    useBrandVoice: boolean
    additionalContext: string
    brandVoiceId?: string
  }
  selectedFlyer: FlyerTemplate | null
  imageFile: File | null
  imagePreviewUrl: string | null
  customFlyerFile: File | null       // user-uploaded flyer (bypasses template system)
  customFlyerPreviewUrl: string | null
  logoFile: File | null              // brand/channel logo shown on flyers
  logoPreviewUrl: string | null
  generatedContent: GeneratedPostContent | null
  scheduledAt: Date | null
  step: WizardStep
}

export type WizardStep =
  | "post-type"
  | "ai-input"
  | "flyer-select"
  | "image-upload"
  | "preview"

// ─── Flyer fonts ─────────────────────────────────────────────────────────────
export const FLYER_FONTS = [
  { id: "default",   name: "Default",   css: "system-ui,-apple-system,sans-serif" },
  { id: "impact",    name: "Impact",    css: "Impact,'Arial Black',sans-serif" },
  { id: "georgia",   name: "Georgia",   css: "Georgia,'Times New Roman',serif" },
  { id: "trebuchet", name: "Trebuchet", css: "'Trebuchet MS',Helvetica,sans-serif" },
  { id: "verdana",   name: "Verdana",   css: "Verdana,Geneva,sans-serif" },
  { id: "mono",      name: "Mono",      css: "'Courier New',Courier,monospace" },
] as const

// ─── Per-flyer content ────────────────────────────────────────────────────────
export interface FlyerContent {
  id: string
  text: string              // main headline
  subtext?: string          // description line below headline
  categoryLabel?: string    // tag text — overrides template default
  fontFamily?: string       // CSS font-family string
  headlineColor?: string    // CSS color for the main headline (default white)
  accentColor?: string      // CSS color for accent/first-line (overrides template)
  imageUrl?: string | null  // per-flyer background image (overrides wizard global image)
  customImageUrl?: string | null // if set, this flyer is a plain uploaded image (no template)
  // Visibility toggles
  hideTag?: boolean         // hide the category badge/label
  hideHeadline?: boolean    // hide the main headline text
  hideSubtext?: boolean     // hide the description/subtext line
  hideLogo?: boolean        // hide the logo overlay
}

// ─── AI Generated Content ─────────────────────────────────────────────────────
export interface GeneratedPostContent {
  caption: string
  flyers: FlyerContent[]    // one or more flyers for this post
  imageSuggestion: string
  hashtags: string[]
  threadPosts?: string[]
  carouselSlides?: { text: string; subtext: string }[]
}

// ─── Scheduled Post ───────────────────────────────────────────────────────────
export interface ScheduledPost {
  id: string
  platform: Platform
  postType: PostType
  content: string
  caption?: string
  imageUrl?: string
  hashtags?: string[]
  scheduledAt: Date
  status: PostStatus
  createdAt: Date
  source?: "post" | "content-idea"
  ideaData?: ContentIdea
}

// ─── Content Idea ─────────────────────────────────────────────────────────────
export interface ContentIdea {
  id: string
  type: ContentIdeaType
  title: string
  description: string
  script?: string // for verbal content
  visualDirection?: string
  suggestedCaption?: string
  platforms: Platform[]
  estimatedDuration?: string
  callToAction?: string
  props?: string[] // items needed for the shoot
  saved?: boolean
  addedToCalendar?: boolean
  scheduledAt?: Date
  videoPrompt?: string          // AI video generation prompt (for tools like Sora, Runway, Pika)
  sceneBreakdown?: { scene: string; action: string; duration: string }[]
}

// ─── Content Ideas Generator Input ───────────────────────────────────────────
export interface ContentIdeasInput {
  platforms: Platform[]
  contentTypes: ContentIdeaType[]
  tone: ContentTone
  useBrandVoice: boolean
  count: number // ideas per type
  topic?: string
}

// ─── Brand Voice ─────────────────────────────────────────────────────────────
export interface BrandVoice {
  id: string
  brandName: string
  industry: string
  tagline?: string
  description?: string // what the brand does, its story, products/services
  targetAudience: string
  tone: ContentTone[]
  keyMessages: string[]
  competitors?: string[]
  styleNotes?: string
  primaryColor?: string
  secondaryColor?: string
  createdAt: Date
  updatedAt: Date
}

// ─── Reply Composer ───────────────────────────────────────────────────────────
export interface ReplyComposerInput {
  platform: Platform
  originalPost: string
  authorHandle?: string
  tone: ContentTone
  useBrandVoice: boolean
  replyCount: number
}

export interface GeneratedReply {
  id: string
  text: string
  tone: ContentTone
  characterCount: number
}

// ─── Engage Composer ─────────────────────────────────────────────────────────
export interface EngageComposerInput {
  platform: Platform
  topic: string
  tone: ContentTone
  engagementType: "comment" | "conversation-starter" | "question" | "insight"
  count: number
}

export interface GeneratedEngagement {
  id: string
  text: string
  type: "comment" | "conversation-starter" | "question" | "insight"
  characterCount: number
}

// ─── AI Providers ────────────────────────────────────────────────────────────
export type AIProviderID = "claude" | "gemini" | "chatgpt"

export interface AIProviderConfig {
  id: AIProviderID
  apiKey: string
  enabled: boolean // true = this is the active provider
}

// ─── Connected Account ───────────────────────────────────────────────────────
export interface ConnectedAccount {
  platform: Platform
  connected: boolean
  username?: string
  displayName?: string
  profileImageUrl?: string
  connectedAt?: Date
  sessionCookie?: string // raw session cookie value used for automation
}

// ─── Marketing Strategy ───────────────────────────────────────────────────────
export type MarketingGoal =
  | "grow-followers"
  | "increase-engagement"
  | "drive-traffic"
  | "product-launch"
  | "brand-awareness"
  | "lead-generation"

export type BusinessStage = "startup" | "growing" | "established" | "scaling"

export type BudgetRange = "bootstrap" | "low" | "medium" | "enterprise"

export type StrategyTimeline = "1-month" | "3-months" | "6-months" | "1-year"

export interface MarketingStrategyInput {
  goals: MarketingGoal[]
  platforms: Platform[]
  timeline: StrategyTimeline
  budget: BudgetRange
  businessStage: BusinessStage
  useBrandVoice: boolean
  additionalContext: string
}

export interface StrategyTactic {
  title: string
  description: string
  platform?: Platform
  effort: "low" | "medium" | "high"
  impact: "low" | "medium" | "high"
}

export interface ToolRecommendation {
  name: string
  category: string
  description: string
  pricing: string
  url?: string
}

export interface ContentPillar {
  name: string
  description: string
  exampleFormats: string[]
  postingFrequency: string
}

export interface StrategyKPI {
  metric: string
  target: string
  timeframe: string
  howToMeasure: string
}

export interface RoadmapPhase {
  phase: string
  timeframe: string
  focus: string
  actions: string[]
}

export interface MarketingStrategy {
  id: string
  overview: string
  contentPillars: ContentPillar[]
  growthTactics: StrategyTactic[]
  toolRecommendations: ToolRecommendation[]
  kpis: StrategyKPI[]
  roadmap: RoadmapPhase[]
  generatedAt: Date
  saved?: boolean
  savedAt?: Date
  label?: string // user-assigned name for the saved strategy
  inputSnapshot?: MarketingStrategyInput // what was used to generate it
}

// ─── Automation ───────────────────────────────────────────────────────────────
export type AutomationStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error'

export interface AutomationLogEntry {
  id: string
  timestamp: Date
  status: 'running' | 'success' | 'error' | 'info' | 'warning'
  message: string
  detail?: string
}

export interface AutomationConfig {
  platform: Platform
  type: 'reply' | 'engage'
  targetUrl?: string
  targetHashtag?: string
  tone: ContentTone
  useBrandVoice: boolean
  actionsPerRun: number        // how many replies/comments to post
  delayBetweenMs: number       // delay between each action in ms
}

// ─── Post Ideas ───────────────────────────────────────────────────────────────
export interface PostIdea {
  id: string
  platform: Platform
  postType: PostType
  title: string
  caption: string
  hashtags: string[]
  tone: ContentTone
  imagePrompt?: string
  saved?: boolean
}

export interface PostIdeasInput {
  platforms: Platform[]
  tone: ContentTone
  topic?: string
  count: number
  useBrandVoice: boolean
}

// ─── Platform Config ─────────────────────────────────────────────────────────
export interface PlatformConfig {
  charLimit: number
  hashtagRange: [number, number]   // [min, max] recommended
  imageMax: number
  captionLabel: string             // "Tweet" | "Caption" | "Post"
  captionHint: string              // limit / fold reminder shown in preview
  seoFold: number | null           // chars shown before "more" / "See more"; null = no fold
}

export const PLATFORM_CONFIG: Record<Platform, PlatformConfig> = {
  x: {
    charLimit: 280,
    hashtagRange: [1, 3],
    imageMax: 4,
    captionLabel: "Tweet",
    captionHint: "280 character limit",
    seoFold: null,
  },
  instagram: {
    charLimit: 2200,
    hashtagRange: [3, 10],
    imageMax: 10,
    captionLabel: "Caption",
    captionHint: 'First 125 chars visible before "more" — lead with your hook',
    seoFold: 125,
  },
  linkedin: {
    charLimit: 3000,
    hashtagRange: [3, 5],
    imageMax: 9,
    captionLabel: "Post",
    captionHint: 'First 210 chars visible before "See more" — make your opening line count',
    seoFold: 210,
  },
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export interface PlatformStats {
  platform: Platform
  scheduledCount: number
  draftCount: number
  publishedThisWeek: number
  engagementRate?: string
}
