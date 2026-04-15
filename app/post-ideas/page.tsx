"use client"

import { useState } from "react"
import {
  Newspaper,
  Sparkles,
  Loader2,
  Bookmark,
  BookmarkCheck,
  CalendarPlus,
  Zap,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  SlidersHorizontal,
} from "lucide-react"
import { XIcon, LinkedInIcon, InstagramIcon } from "@/components/ui/platform-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { PostWizard } from "@/components/post-wizard/post-wizard"
import { generatePostIdeas } from "@/lib/ai-mock"
import { DUMMY_BRAND_VOICE } from "@/lib/dummy-data"
import { useAIProvider } from "@/lib/ai-provider-context"
import type { Platform, ContentTone, PostIdea, PostType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const TONES: { value: ContentTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "bold", label: "Bold" },
  { value: "educational", label: "Educational" },
  { value: "inspirational", label: "Inspirational" },
  { value: "humorous", label: "Humorous" },
]

const PLATFORMS: { id: Platform; label: string; icon: React.ElementType }[] = [
  { id: "x", label: "X", icon: XIcon },
  { id: "linkedin", label: "LinkedIn", icon: LinkedInIcon },
  { id: "instagram", label: "Instagram", icon: InstagramIcon },
]

const COUNT_OPTIONS = [3, 5, 10]

const PLATFORM_ICONS: Record<Platform, React.ElementType> = {
  x: XIcon,
  linkedin: LinkedInIcon,
  instagram: InstagramIcon,
}

const PLATFORM_LABELS: Record<Platform, string> = {
  x: "X",
  linkedin: "LinkedIn",
  instagram: "Instagram",
}

const POST_TYPE_LABELS: Record<PostType, string> = {
  single: "Single",
  thread: "Thread",
  text: "Text",
  image: "Image",
  carousel: "Carousel",
  story: "Story",
}

// ── PostIdeaCard ──────────────────────────────────────────────────────────────
interface PostIdeaCardProps {
  idea: PostIdea
  onSchedule: (idea: PostIdea) => void
  onPostNow: (idea: PostIdea) => void
  onToggleSave: (idea: PostIdea) => void
}

function PostIdeaCard({ idea, onSchedule, onPostNow, onToggleSave }: PostIdeaCardProps) {
  const [showImagePrompt, setShowImagePrompt] = useState(false)
  const [saved, setSaved] = useState(idea.saved ?? false)

  const PlatformIcon = PLATFORM_ICONS[idea.platform]

  const handleToggleSave = () => {
    setSaved(!saved)
    toast.success(saved ? "Removed from saved" : "Post idea saved!")
    onToggleSave({ ...idea, saved: !saved })
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <PlatformIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {PLATFORM_LABELS[idea.platform]}
            </Badge>
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
              {POST_TYPE_LABELS[idea.postType] ?? idea.postType}
            </Badge>
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">
              {idea.tone}
            </Badge>
          </div>
          <h3 className="text-sm font-semibold leading-snug">{idea.title}</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={handleToggleSave}
        >
          {saved ? (
            <BookmarkCheck className="size-4 text-primary" />
          ) : (
            <Bookmark className="size-4" />
          )}
        </Button>
      </div>

      {/* Caption */}
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
        {idea.caption}
      </p>

      {/* Hashtags */}
      {idea.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {idea.hashtags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] text-primary bg-primary/10 rounded-full px-2 py-0.5 font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Image prompt (collapsible) */}
      {idea.imagePrompt && (
        <div>
          <button
            onClick={() => setShowImagePrompt(!showImagePrompt)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ImageIcon className="size-3" />
            Image prompt
            {showImagePrompt ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
          </button>
          {showImagePrompt && (
            <div className="mt-2 rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                {idea.imagePrompt}
              </p>
            </div>
          )}
        </div>
      )}

      <Separator />

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 text-xs h-7"
          onClick={() => onSchedule(idea)}
        >
          <CalendarPlus className="size-3 mr-1.5" />
          Schedule
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs h-7"
          onClick={() => onPostNow(idea)}
        >
          <Zap className="size-3 mr-1.5" />
          Post Now
        </Button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PostIdeasPage() {
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["instagram"])
  const [tone, setTone] = useState<ContentTone>("casual")
  const [topic, setTopic] = useState("")
  const [count, setCount] = useState(5)
  const [useBrandVoice, setUseBrandVoice] = useState(true)
  const [ideas, setIdeas] = useState<PostIdea[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [mobileTab, setMobileTab] = useState<"settings" | "results">("settings")

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardKey, setWizardKey] = useState(0)
  const [wizardPlatform, setWizardPlatform] = useState<Platform>("instagram")
  const [wizardPrefill, setWizardPrefill] = useState<{
    platform: Platform
    postType: PostType
    topic: string
    tone: ContentTone
    caption: string
    hashtags: string[]
    imagePrompt?: string
    postNow?: boolean
  } | null>(null)

  const { activeProvider } = useAIProvider()

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  const handleGenerate = async () => {
    if (selectedPlatforms.length === 0) {
      toast.error("Select at least one platform")
      return
    }
    setIsGenerating(true)
    setMobileTab("results")
    try {
      const results = await generatePostIdeas(
        {
          platforms: selectedPlatforms,
          tone,
          topic: topic || undefined,
          count,
          useBrandVoice,
        },
        activeProvider?.id ?? null
      )
      setIdeas(results)
      toast.success(`${results.length} post ideas generated!`)
    } catch {
      toast.error("Generation failed. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleToggleSave = (idea: PostIdea) => {
    setIdeas((prev) => prev.map((i) => (i.id === idea.id ? idea : i)))
  }

  const openWizard = (idea: PostIdea, postNow = false) => {
    setWizardPlatform(idea.platform)
    setWizardPrefill({
      platform: idea.platform,
      postType: idea.postType,
      topic: idea.title,
      tone: idea.tone,
      caption: idea.caption,
      hashtags: idea.hashtags,
      imagePrompt: idea.imagePrompt,
      postNow,
    })
    setWizardKey((k) => k + 1) // force PostWizard to remount with fresh state
    setWizardOpen(true)
  }

  const handleSchedule = (idea: PostIdea) => openWizard(idea, false)
  const handlePostNow = (idea: PostIdea) => openWizard(idea, true)

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Page header */}
      <div data-tour="page-post-ideas" className="sticky top-0 z-10 bg-background flex items-center gap-3 px-4 py-4 sm:px-6 sm:py-5 border-b">
        <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Newspaper className="size-4 sm:size-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-semibold leading-tight">Post Ideas</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI-generated post ideas ready to schedule or publish
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
          <Newspaper className="size-3.5" />
          Ideas
        </button>
      </div>

      <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-8.5rem)]">
        {/* ── Left panel (inputs) ── */}
        <div className={cn(
          "lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5",
          mobileTab !== "settings" && "hidden lg:block"
        )}>
          {/* Brand Voice */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Brand Voice</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {DUMMY_BRAND_VOICE
                  ? `Using: ${DUMMY_BRAND_VOICE.brandName}`
                  : "Set up in Brand Voice page"}
              </p>
            </div>
            <Switch
              checked={useBrandVoice}
              onCheckedChange={setUseBrandVoice}
              disabled={!DUMMY_BRAND_VOICE}
            />
          </div>

          {/* Platforms */}
          <div className="space-y-2">
            <Label>Platforms</Label>
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

          {/* Topic */}
          <div className="space-y-2">
            <Label htmlFor="post-ideas-topic">
              Topic{" "}
              <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="post-ideas-topic"
              placeholder="e.g. productivity, launching a product..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          {/* Count */}
          <div className="space-y-2">
            <Label>Ideas per platform</Label>
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
                Generating ideas...
              </>
            ) : (
              <>
                <Sparkles data-icon="inline-start" />
                Generate Post Ideas
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
              <p className="text-sm text-muted-foreground">Generating post ideas...</p>
            </div>
          ) : ideas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                <Newspaper className="size-8 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">No ideas yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Configure your settings and click Generate Post Ideas to get started
                </p>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium">{ideas.length} post ideas generated</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  <Sparkles data-icon="inline-start" />
                  Regenerate
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {ideas.map((idea) => (
                  <PostIdeaCard
                    key={idea.id}
                    idea={idea}
                    onSchedule={handleSchedule}
                    onPostNow={handlePostNow}
                    onToggleSave={handleToggleSave}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Post Wizard — key changes on every new idea so state reinitialises */}
      <PostWizard
        key={wizardKey}
        platform={wizardPlatform}
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false)
          setWizardPrefill(null)
        }}
        prefill={wizardPrefill ?? undefined}
      />
    </div>
  )
}
