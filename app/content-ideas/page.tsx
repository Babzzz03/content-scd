"use client"

import { useState } from "react"
import {
  Lightbulb,
  Sparkles,
  Loader2,
  RefreshCw,
  Bookmark,
  BookmarkCheck,
  SlidersHorizontal,
} from "lucide-react"
import { XIcon, LinkedInIcon, InstagramIcon } from "@/components/ui/platform-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { IdeaCard } from "@/components/content-ideas/idea-card"
import { ScheduleDatePicker } from "@/components/post-wizard/schedule-date-picker"
import { generateContentIdeas, generateVideoPrompt } from "@/lib/ai-mock"
import { DUMMY_CONTENT_IDEAS, DUMMY_BRAND_VOICE } from "@/lib/dummy-data"
import { usePostsContext } from "@/lib/posts-context"
import { useAIProvider } from "@/lib/ai-provider-context"
import type { Platform, ContentTone, ContentIdeaType, ContentIdea } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const CONTENT_TYPES: { value: ContentIdeaType; label: string; emoji: string }[] = [
  { value: "skit", label: "Skit", emoji: "🎭" },
  { value: "comedy", label: "Comedy", emoji: "😂" },
  { value: "non-verbal", label: "Non-Verbal", emoji: "👁️" },
  { value: "verbal", label: "Verbal", emoji: "🎙️" },
  { value: "educational", label: "Educational", emoji: "📚" },
  { value: "promotional", label: "Promotional", emoji: "📣" },
  { value: "behind-the-scenes", label: "BTS", emoji: "🎬" },
  { value: "testimonial", label: "Testimonial", emoji: "⭐" },
  { value: "trending", label: "Trending", emoji: "🔥" },
  { value: "storytelling", label: "Storytelling", emoji: "📖" },
]

const TONES: { value: ContentTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "humorous", label: "Humorous" },
  { value: "educational", label: "Educational" },
  { value: "inspirational", label: "Inspirational" },
  { value: "bold", label: "Bold" },
]

const PLATFORMS: { id: Platform; label: string; icon: React.ElementType }[] = [
  { id: "x", label: "X", icon: XIcon },
  { id: "linkedin", label: "LinkedIn", icon: LinkedInIcon },
  { id: "instagram", label: "Instagram", icon: InstagramIcon },
]

const COUNT_OPTIONS = [2, 4, 6]

export default function ContentIdeasPage() {
  const [topic, setTopic] = useState("")
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["instagram"])
  const [selectedTypes, setSelectedTypes] = useState<ContentIdeaType[]>([])
  const [tone, setTone] = useState<ContentTone>("casual")
  const [useBrandVoice, setUseBrandVoice] = useState(true)
  const [count, setCount] = useState(4)
  const [ideas, setIdeas] = useState<ContentIdea[]>(DUMMY_CONTENT_IDEAS)
  const [isGenerating, setIsGenerating] = useState(false)
  const [savedOnly, setSavedOnly] = useState(false)

  // Schedule state
  const [scheduleTarget, setScheduleTarget] = useState<ContentIdea | null>(null)
  const [mobileTab, setMobileTab] = useState<"settings" | "results">("settings")

  const { addScheduledPost } = usePostsContext()
  const { activeProvider } = useAIProvider()

  const togglePlatform = (p: Platform) =>
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )

  const toggleType = (t: ContentIdeaType) =>
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    )

  const handleGenerate = async () => {
    if (selectedPlatforms.length === 0) {
      toast.error("Select at least one platform")
      return
    }
    setIsGenerating(true)
    setSavedOnly(false)
    setMobileTab("results")
    try {
      const results = await generateContentIdeas({
        platforms: selectedPlatforms,
        contentTypes: selectedTypes,
        tone,
        useBrandVoice,
        count,
        topic: topic || undefined,
      })
      setIdeas(results)
      toast.success(`${results.length} content ideas generated!`)
    } catch {
      toast.error("Generation failed. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveIdea = (idea: ContentIdea) => {
    setIdeas((prev) => prev.map((i) => (i.id === idea.id ? idea : i)))
  }

  const handleScheduleIdea = (idea: ContentIdea) => {
    setScheduleTarget(idea)
  }

  const handleScheduleConfirm = (date: Date) => {
    if (!scheduleTarget) return
    const platform = scheduleTarget.platforms[0] ?? "instagram"
    addScheduledPost({
      platform,
      postType: "single",
      content: scheduleTarget.title,
      caption: scheduleTarget.suggestedCaption ?? scheduleTarget.description,
      scheduledAt: date,
      source: "content-idea",
      ideaData: scheduleTarget,
    })
    toast.success("Video idea scheduled!", {
      description: date.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    })
    setScheduleTarget(null)
  }

  const handleGenerateVideoPrompt = async (idea: ContentIdea): Promise<string> => {
    const prompt = await generateVideoPrompt(idea)
    setIdeas((prev) => prev.map((i) => (i.id === idea.id ? { ...i, videoPrompt: prompt } : i)))
    return prompt
  }

  const visibleIdeas = savedOnly ? ideas.filter((i) => i.saved) : ideas
  const savedCount = ideas.filter((i) => i.saved).length

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Page header */}
      <div data-tour="page-content-ideas" className="sticky top-0 z-10 bg-background flex items-center gap-3 px-4 py-4 sm:px-6 sm:py-5 border-b">
        <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Lightbulb className="size-4 sm:size-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-semibold leading-tight">Content Ideas</h1>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-none">
            AI-generated video briefs — hooks, scene breakdowns, scripts, and AI prompts for creators
          </p>
        </div>
      </div>

      {/* Mobile tab toggle */}
      <div className="flex lg:hidden border-b">
        <button
          onClick={() => setMobileTab("settings")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium border-b-2 transition-colors",
            mobileTab === "settings"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          )}
        >
          <SlidersHorizontal className="size-3.5" />
          Settings
        </button>
        <button
          onClick={() => setMobileTab("results")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium border-b-2 transition-colors",
            mobileTab === "results"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          )}
        >
          <Lightbulb className="size-3.5" />
          Ideas
        </button>
      </div>

      <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-8.5rem)]">
        {/* ── Left panel (settings) ── */}
        <div className={cn(
          "lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5",
          mobileTab !== "settings" && "hidden lg:block"
        )}>

          {/* Brand voice */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Brand Voice</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {DUMMY_BRAND_VOICE ? `Using: ${DUMMY_BRAND_VOICE.brandName}` : "Set up in Brand Voice page"}
              </p>
            </div>
            <Switch
              checked={useBrandVoice}
              onCheckedChange={setUseBrandVoice}
              disabled={!DUMMY_BRAND_VOICE}
            />
          </div>

          {/* Topic */}
          <div className="space-y-2">
            <Label htmlFor="idea-topic">
              Topic or theme{" "}
              <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="idea-topic"
              placeholder="e.g. productivity, fitness journey, launching a product…"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          {/* Platforms */}
          <div className="space-y-2">
            <Label>Target platforms</Label>
            <div className="flex gap-2 flex-wrap">
              {PLATFORMS.map((p) => {
                const PIcon = p.icon
                const selected = selectedPlatforms.includes(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-accent"
                    )}
                  >
                    <PIcon className="size-3" />
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Content types */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Content type</Label>
              <div className="flex gap-2">
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => setSelectedTypes(CONTENT_TYPES.map((t) => t.value))}
                >
                  All
                </button>
                <span className="text-xs text-muted-foreground">·</span>
                <button
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={() => setSelectedTypes([])}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => toggleType(t.value)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    selectedTypes.includes(t.value)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-accent"
                  )}
                >
                  <span>{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
            {selectedTypes.length === 0 && (
              <p className="text-xs text-muted-foreground">All types — AI chooses the best fit</p>
            )}
          </div>

          {/* Tone */}
          <div className="space-y-2">
            <Label>Tone</Label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTone(t.value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    tone === t.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-accent"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ideas per platform */}
          <div className="space-y-2">
            <Label>Ideas to generate</Label>
            <div className="flex gap-2">
              {COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    count === n
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-accent"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={isGenerating || selectedPlatforms.length === 0}
          >
            {isGenerating ? (
              <>
                <Loader2 className="size-3.5 mr-2 animate-spin" />
                Generating ideas…
              </>
            ) : (
              <>
                <Sparkles data-icon="inline-start" />
                Generate Video Ideas
                {activeProvider && (
                  <Badge variant="secondary" className="ml-2 text-[10px] h-4 px-1.5">
                    {activeProvider.id}
                  </Badge>
                )}
              </>
            )}
          </Button>
        </div>

        {/* ── Right panel (results) ── */}
        <div className={cn(
          "flex-1 overflow-y-auto p-5",
          mobileTab !== "results" && "hidden lg:block"
        )}>
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 className="size-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Generating video ideas…</p>
            </div>
          ) : ideas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                <Lightbulb className="size-8 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">No ideas yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Configure your brief and click Generate Video Ideas to get started
                </p>
              </div>
            </div>
          ) : (
            <div>
              {/* Results header with tabs */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-0.5">
                  <button
                    onClick={() => setSavedOnly(false)}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                      !savedOnly
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    All ({ideas.length})
                  </button>
                  <button
                    onClick={() => setSavedOnly(true)}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors",
                      savedOnly
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <BookmarkCheck className="size-3" />
                    Saved ({savedCount})
                  </button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  <RefreshCw data-icon="inline-start" />
                  Regenerate
                </Button>
              </div>

              {visibleIdeas.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
                  <Bookmark className="size-6 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No saved ideas yet</p>
                  <p className="text-xs text-muted-foreground">
                    Click <strong>Save</strong> on any idea to add it here
                  </p>
                  <button
                    onClick={() => setSavedOnly(false)}
                    className="text-xs text-primary hover:underline"
                  >
                    Back to all ideas
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {visibleIdeas.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      onSave={handleSaveIdea}
                      onSchedule={handleScheduleIdea}
                      onGenerateVideoPrompt={handleGenerateVideoPrompt}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Schedule date picker */}
      <ScheduleDatePicker
        open={scheduleTarget !== null}
        onClose={() => setScheduleTarget(null)}
        onConfirm={handleScheduleConfirm}
      />
    </div>
  )
}
