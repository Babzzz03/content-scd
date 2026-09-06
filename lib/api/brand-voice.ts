import { get, put } from "./client"
import type { BrandVoice, ContentTone } from "@/lib/types"

interface ApiBrandVoice {
  _id: string
  brandName?: string
  industry?: string
  tagline?: string
  targetAudience?: string
  brandValues?: string
  toneKeywords?: string[]
  competitorBrands?: string[]
  sampleContent?: string
  styleNotes?: string
  voiceProfile?: {
    taglineSuggestion?: string
    aboutBrandSummary?: string
    targetAudienceSummary?: string
    recommendedToneKeywords?: string[]
    keyMessages?: string[]
    styleNotes?: string
    personalityAdjectives?: string[]
    toneGuidelines?: string
    languageToUse?: string[]
    languageToAvoid?: string[]
    emojiGuideline?: string
    hashtagStrategy?: string
    contentPillars?: string[]
    signaturePhrases?: string[]
    platformNotes?: {
      x?: string
      linkedin?: string
      instagram?: string
    }
  }
  createdAt?: string
  updatedAt?: string
}

const VALID_TONES: ContentTone[] = [
  "professional",
  "casual",
  "humorous",
  "educational",
  "inspirational",
  "promotional",
  "bold",
  "empathetic",
]

function normalizeTones(values: string[] | undefined): ContentTone[] {
  return (values ?? []).filter((value): value is ContentTone =>
    VALID_TONES.includes(value as ContentTone)
  )
}

export function createEmptyBrandVoice(): BrandVoice {
  const now = new Date()
  return {
    id: "",
    brandName: "",
    industry: "",
    tagline: "",
    description: "",
    targetAudience: "",
    tone: [],
    keyMessages: [],
    competitors: [],
    styleNotes: "",
    primaryColor: "",
    secondaryColor: "",
    createdAt: now,
    updatedAt: now,
  }
}

function mapApiBrandVoice(doc: ApiBrandVoice | null): BrandVoice {
  if (!doc) return createEmptyBrandVoice()

  return {
    id: doc._id,
    brandName: doc.brandName ?? "",
    industry: doc.industry ?? "",
    tagline: doc.tagline ?? doc.voiceProfile?.taglineSuggestion ?? "",
    description: doc.sampleContent ?? doc.voiceProfile?.aboutBrandSummary ?? "",
    targetAudience: doc.targetAudience ?? doc.voiceProfile?.targetAudienceSummary ?? "",
    tone: normalizeTones(
      (doc.toneKeywords && doc.toneKeywords.length > 0)
        ? doc.toneKeywords
        : doc.voiceProfile?.recommendedToneKeywords
    ),
    keyMessages:
      doc.brandValues
        ? doc.brandValues.split("\n").map((line) => line.trim()).filter(Boolean)
        : (doc.voiceProfile?.keyMessages ?? doc.voiceProfile?.signaturePhrases ?? doc.voiceProfile?.contentPillars ?? []),
    competitors: doc.competitorBrands ?? [],
    styleNotes: doc.styleNotes ?? doc.voiceProfile?.styleNotes ?? doc.voiceProfile?.toneGuidelines ?? "",
    personalityAdjectives: doc.voiceProfile?.personalityAdjectives ?? [],
    languageToUse: doc.voiceProfile?.languageToUse ?? [],
    languageToAvoid: doc.voiceProfile?.languageToAvoid ?? [],
    emojiGuideline: doc.voiceProfile?.emojiGuideline ?? "",
    hashtagStrategy: doc.voiceProfile?.hashtagStrategy ?? "",
    platformNotes: doc.voiceProfile?.platformNotes ?? {},
    primaryColor: "",
    secondaryColor: "",
    createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
  }
}

function toApiPayload(brand: Partial<BrandVoice>) {
  return {
    brandName: brand.brandName ?? "",
    industry: brand.industry ?? "",
    tagline: brand.tagline ?? "",
    targetAudience: brand.targetAudience ?? "",
    brandValues: (brand.keyMessages ?? []).join("\n"),
    toneKeywords: brand.tone ?? [],
    competitorBrands: brand.competitors ?? [],
    sampleContent: brand.description ?? "",
    styleNotes: brand.styleNotes ?? "",
  }
}

export const brandVoiceApi = {
  get: async () => {
    const res = await get<{ data: { brandVoice: ApiBrandVoice | null } }>("/brand-voice")
    return mapApiBrandVoice(res.data.brandVoice)
  },

  save: async (brand: Partial<BrandVoice>) => {
    const res = await put<{ data: { brandVoice: ApiBrandVoice | null } }>(
      "/brand-voice",
      toApiPayload(brand)
    )
    return mapApiBrandVoice(res.data.brandVoice)
  },
}
