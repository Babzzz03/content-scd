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
export type PostStatus = "draft" | "scheduled" | "publishing" | "published" | "failed"

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
  imageFiles: File[]
  imagePreviewUrls: string[]
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
  /** All AI-generated variations (index 0 = the currently active one) */
  variations?: Omit<GeneratedPostContent, "variations">[]
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
  format?: string
  hook?: string
  whyItWorks?: string
  difficulty?: "easy" | "medium" | "hard"
  trendingTags?: string[]
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
  personalityAdjectives?: string[]
  languageToUse?: string[]
  languageToAvoid?: string[]
  emojiGuideline?: string
  hashtagStrategy?: string
  platformNotes?: Partial<Record<Platform, string>>
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
  topComments?: string[]
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
  sessionCookie?: string
  accountId?: string  // backend _id, used for disconnect/update calls
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
  format?: string
  hook?: string
  whyItWorks?: string
  difficulty?: "easy" | "medium" | "hard"
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

// ─── Lead Generation ──────────────────────────────────────────────────────────

export type LeadStatus =
  | "new"
  | "enriched"
  | "qualified"
  | "drafted"
  | "approved"
  | "queued"
  | "messaged"
  | "replied"
  | "skipped"
  | "failed"
  | "opted_out"
  | "to_call"
  | "contacted"
  | "callback"
  | "won"
  | "lost"

export type LeadFit = "strong" | "moderate" | "weak" | "unqualified" | null

export type LeadSource = "instagram" | "google_maps"

export type CallOutcome =
  | "interested"
  | "callback"
  | "not_interested"
  | "no_answer"
  | "wrong_number"

export interface GooglePlaceData {
  placeId: string
  formattedAddress: string
  phone: string
  rating: number
  reviewCount: number
  businessStatus: string
  primaryType: string
  mapsUri: string
}

export type CampaignStatus =
  | "draft"
  | "discovering"
  | "ready"
  | "sending"
  | "paused"
  | "completed"
  | "error"

export interface LeadContact {
  email?: string
  phone?: string
  whatsapp?: string
  address?: string
}

export interface Lead {
  _id: string
  campaign?: string
  source: LeadSource
  externalId: string
  google?: GooglePlaceData
  callScript: string
  contactedAt: string | null
  contactMethod: "call" | "whatsapp" | "email" | "dm" | null
  callOutcome: CallOutcome | null
  notes: string
  username: string
  fullName: string
  profileUrl: string
  profilePicUrl: string
  bio: string
  category: string
  externalLink: string
  followers: number
  following: number
  postsCount: number
  isBusinessAccount: boolean
  isVerified: boolean
  isPrivate: boolean
  hasWebsite: boolean
  contact: LeadContact
  lastPostAt: string | null
  niche: string
  location: string
  discoveredVia: { type: string; query: string }
  score: number
  scoreReasons: string[]
  aiFit: LeadFit
  aiAngle: string
  aiReasoning: string
  status: LeadStatus
  draftMessage: string
  approvedMessage: string
  messagedAt: string | null
  repliedAt: string | null
  replyPreview: string
  threadUrl: string
  sendAttempts: number
  sendError: string | null
  skipReason: string
  createdAt: string
}

export interface LeadFilters {
  requireNoWebsite: boolean
  requireBusinessAccount: boolean
  requireContactInfo: boolean
  excludeVerified: boolean
  excludePrivate: boolean
  minFollowers: number
  maxFollowers: number
  minPosts: number
  activeWithinDays: number
  bioKeywords: string[]
  excludeKeywords: string[]
}

export interface LeadOffer {
  what: string
  painPoint: string
  proof: string
  callToAction: string
}

export interface CampaignSendState {
  allowed: boolean
  reason: string
  capToday: number
  sentToday: number
}

export interface CampaignProgress {
  phase: "idle" | "planning" | "collecting" | "enriching" | "saving" | "drafting" | "done" | "error"
  message: string
  current: number
  total: number
  detail: string
  updatedAt: string | null
}

export interface LeadCampaign {
  _id: string
  name: string
  source: LeadSource
  region?: string
  platformAccountId: string
  status: CampaignStatus
  search: {
    niches: string[]
    locations: string[]
    extraHashtags: string[]
    generatedQueries: string[]
  }
  filters: LeadFilters
  targetLeadCount: number
  offer: LeadOffer
  icp: string
  messageSettings: {
    autoSend: boolean
    dailyCap: number
    sendWindow: { start: number; end: number }
    timezone: string
    useWarmup: boolean
  }
  stats: {
    discovered: number
    enriched: number
    qualified: number
    drafted: number
    approved: number
    sent: number
    replied: number
    skipped: number
    failed: number
  }
  sentToday: number
  firstSentAt: string | null
  lastDiscoveryAt: string | null
  lastError: string | null
  progress?: CampaignProgress
  sendState?: CampaignSendState
  /** When the next continuation batch is scheduled, if any */
  continuesAt?: string | null
  emptyRuns?: number
  createdAt: string
}

export interface LeadStats {
  total: number
  counts: Partial<Record<LeadStatus, number>>
  awaitingReview: number
  replyRate: number
}

/** Copy shown against each lead status in the UI. */
export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new:       "New",
  enriched:  "Enriched",
  qualified: "Qualified",
  drafted:   "Awaiting review",
  approved:  "Approved",
  queued:    "Sending",
  messaged:  "Messaged",
  replied:   "Replied",
  skipped:   "Skipped",
  failed:    "Failed",
  opted_out: "Opted out",
  to_call:   "To call",
  contacted: "Contacted",
  callback:  "Call back",
  won:       "Interested",
  lost:      "Not interested",
}

/** Call outcome labels for the Google call sheet. */
export const CALL_OUTCOME_LABEL: Record<CallOutcome, string> = {
  interested:     "Interested",
  callback:       "Call back later",
  not_interested: "Not interested",
  no_answer:      "No answer",
  wrong_number:   "Wrong number",
}
