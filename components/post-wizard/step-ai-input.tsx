"use client"

import { Sparkles, Mic2, Info, CheckCircle2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { DUMMY_BRAND_VOICE } from "@/lib/dummy-data"
import type { ContentTone, Platform, PostType, PostWizardState } from "@/lib/types"
import { cn } from "@/lib/utils"

const TONES: { value: ContentTone; label: string; emoji: string }[] = [
  { value: "professional", label: "Professional", emoji: "💼" },
  { value: "casual", label: "Casual", emoji: "😊" },
  { value: "humorous", label: "Humorous", emoji: "😂" },
  { value: "educational", label: "Educational", emoji: "📚" },
  { value: "inspirational", label: "Inspirational", emoji: "🌟" },
  { value: "promotional", label: "Promotional", emoji: "📣" },
  { value: "bold", label: "Bold", emoji: "🔥" },
  { value: "empathetic", label: "Empathetic", emoji: "💛" },
]

// What the AI will generate for each platform + post type
const PLATFORM_GENERATION_HINTS: Record<string, string> = {
  "x/single":            "A tweet up to 280 chars — punchy, hook-first, 1–2 hashtags embedded + a flyer headline",
  "x/thread":            "A 6-tweet thread — each ≤280 chars, with a hook, key points, and a closing CTA",
  "instagram/single":    "A 500–800 char caption with a strong hook in the first 125 chars + 8 hashtags + 2 flyer variations",
  "instagram/carousel":  "7 swipeable carousel slides with title & body per slide + a teaser caption",
  "instagram/story":     "Very short overlay text (≤25 chars) for a 9:16 story flyer — minimal hashtags",
  "linkedin/text":       "A 600–1200 char professional storytelling post with 4 hashtags + 2 flyer variations",
  "linkedin/image":      "A professional post that frames the attached image + up to 3,000 chars + 4 hashtags",
  "linkedin/carousel":   "7 document-carousel slides (title + body per slide) + a teaser post to share with the document",
}

interface StepAIInputProps {
  platform: Platform
  postType: PostType | null
  aiInput: PostWizardState["aiInput"]
  hasBrandVoice: boolean
  onChange: (updates: Partial<PostWizardState["aiInput"]>) => void
}

export function StepAIInput({ platform, postType, aiInput, hasBrandVoice, onChange }: StepAIInputProps) {
  const usingBrandVoice = aiInput.useBrandVoice && hasBrandVoice
  const generationHintKey = postType ? `${platform}/${postType}` : platform
  const generationHint = PLATFORM_GENERATION_HINTS[generationHintKey]
    ?? "Platform-optimised caption, flyer text, hashtags, and an image suggestion"

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold">Tell the AI what to create</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {usingBrandVoice
            ? "Brand Voice is active — the AI will generate from your brand profile"
            : "The more context you give, the better the output"}
        </p>
      </div>

      {/* Brand Voice toggle */}
      {hasBrandVoice ? (
        <div
          className={cn(
            "rounded-xl border p-4 transition-colors",
            usingBrandVoice
              ? "border-primary/40 bg-primary/5"
              : "border-border bg-muted/50"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-md transition-colors",
                  usingBrandVoice ? "bg-primary/15" : "bg-muted"
                )}
              >
                <Mic2 className={cn("size-4", usingBrandVoice ? "text-primary" : "text-muted-foreground")} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Use Brand Voice</p>
                  {usingBrandVoice && (
                    <Badge variant="secondary" className="text-[10px] py-0 h-4">Active</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {usingBrandVoice
                    ? `AI will use "${DUMMY_BRAND_VOICE.brandName}" — topic becomes optional`
                    : "AI will tailor output to match your brand's tone and messaging"}
                </p>
              </div>
            </div>
            <Switch
              checked={aiInput.useBrandVoice}
              onCheckedChange={(checked) => onChange({ useBrandVoice: checked })}
            />
          </div>

          {usingBrandVoice && (
            <div className="mt-3 pt-3 border-t border-primary/20 grid grid-cols-2 gap-2">
              {[
                { label: "Brand", value: DUMMY_BRAND_VOICE.brandName },
                { label: "Industry", value: DUMMY_BRAND_VOICE.industry },
                { label: "Tone", value: DUMMY_BRAND_VOICE.tone.slice(0, 2).join(", ") },
                { label: "Audience", value: DUMMY_BRAND_VOICE.targetAudience.substring(0, 40) + "…" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                  <p className="text-xs font-medium leading-snug">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <Alert>
          <Info className="size-4" />
          <AlertDescription className="text-xs">
            <span className="font-medium">No Brand Voice set up.</span>{" "}
            Add your brand profile in{" "}
            <a href="/brand-voice" className="underline text-primary">Brand Voice</a>{" "}
            for AI to generate without needing a topic.
          </AlertDescription>
        </Alert>
      )}

      {/* Topic */}
      <div className="space-y-2">
        <Label htmlFor="topic">
          What is this post about?{" "}
          {usingBrandVoice ? (
            <span className="text-muted-foreground text-xs font-normal">(optional — AI will use your brand profile)</span>
          ) : (
            <span className="text-destructive">*</span>
          )}
        </Label>
        <Input
          id="topic"
          placeholder={
            usingBrandVoice
              ? "Leave blank to let the AI decide, or narrow it down…"
              : "e.g. The benefits of morning journaling for entrepreneurs"
          }
          value={aiInput.topic}
          onChange={(e) => onChange({ topic: e.target.value })}
          className={cn(usingBrandVoice && !aiInput.topic && "border-dashed")}
        />
        {!usingBrandVoice && (
          <p className="text-xs text-muted-foreground">
            Be specific — mention your product, service, or topic angle
          </p>
        )}
      </div>

      {/* Tone */}
      <div className="space-y-2">
        <Label>Tone of voice</Label>
        <div className="flex flex-wrap gap-2">
          {TONES.map((tone) => (
            <button
              key={tone.value}
              onClick={() => onChange({ tone: tone.value })}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                aiInput.tone === tone.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-accent"
              }`}
            >
              <span>{tone.emoji}</span>
              {tone.label}
            </button>
          ))}
        </div>
      </div>

      {/* Additional context */}
      <div className="space-y-2">
        <Label htmlFor="context">
          Additional context{" "}
          <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <Textarea
          id="context"
          placeholder="Any specific points to include, CTAs, links to mention, or audience details..."
          rows={3}
          value={aiInput.additionalContext}
          onChange={(e) => onChange({ additionalContext: e.target.value })}
        />
      </div>

      {/* Platform-aware AI hint */}
      <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3">
        <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">What the AI will generate</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {usingBrandVoice
              ? "The AI will read your full brand profile — description, tone, key messages, and audience — to generate content that sounds like you, even without a specific topic."
              : generationHint}
          </p>
        </div>
      </div>
    </div>
  )
}
