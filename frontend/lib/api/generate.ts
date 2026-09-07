import { post } from './client'

export const generateApi = {
  /** Generate post variations for a specific platform */
  post: (params: {
    platform: string
    topic: string
    postType?: string
    count?: number
    format?: string
    mediaDescription?: string
    useBrandVoice?: boolean
  }) => post<{ data: { posts: unknown[] } }>('/generate/post', params),

  /** Generate video / reel content ideas */
  contentIdeas: (params: {
    count?: number
    platforms?: string[]
    goals?: string
    useBrandVoice?: boolean
  }) => post<{ data: { ideas: unknown[] } }>('/generate/ideas', params),

  /** Generate ready-to-use post idea briefs */
  postIdeas: (params: {
    platform?: string
    topic?: string
    count?: number
    useBrandVoice?: boolean
  }) => post<{ data: { ideas: unknown[] } }>('/generate/post-ideas', params),

  /** Generate AI brand voice profile from inputs */
  brandVoice: (params: {
    brandName?: string
    industry?: string
    tagline?: string
    targetAudience?: string
    brandValues?: string
    toneKeywords?: string[]
    competitors?: string[]
    sampleContent?: string
    styleNotes?: string
  }) => post<{ data: { brandVoice: unknown } }>('/generate/brand-voice', params),

  /** Generate full 90-day marketing strategy */
  strategy: (params: {
    businessName?: string
    industry?: string
    currentSituation?: string
    goals?: string
    budget?: string
    teamSize?: string
    platforms?: string[]
    useBrandVoice?: boolean
    timeline?: string
    businessStage?: string
    additionalContext?: string
  }) => post<{ data: { strategy: unknown } }>('/generate/strategy', params),

  /** Generate reply options for a given post */
  reply: (params: {
    originalPost: string
    replyIntent?: string
    platform?: string
    useBrandVoice?: boolean
    topComments?: string[]
  }) => post<{ data: { replies: unknown[] } }>('/generate/reply', params),

  /** Generate engagement comments / questions / insights */
  engagements: (params: {
    platform: string
    topic: string
    tone?: string
    engagementType?: string
    count?: number
    useBrandVoice?: boolean
  }) => post<{ data: { engagements: unknown[] } }>('/generate/engagements', params),
}
