"use client"

import { useState } from "react"
import {
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Film,
  MessageSquare,
  Lightbulb,
  Laugh,
  Eye,
  Mic,
  TrendingUp,
  Users,
  Megaphone,
  BookOpen,
  Star,
  Wand2,
  Copy,
  Check,
  Loader2,
  Clapperboard,
  CalendarPlus,
  Zap,
  ListChecks,
} from "lucide-react"
import { XIcon, LinkedInIcon, InstagramIcon } from "@/components/ui/platform-icons"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { ContentIdea, ContentIdeaType, Platform } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── Type metadata ─────────────────────────────────────────────────────────────

const TYPE_META: Record<
  ContentIdeaType,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  skit: { label: "Skit", icon: Film, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30" },
  comedy: { label: "Comedy", icon: Laugh, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/30" },
  "non-verbal": { label: "Non-Verbal", icon: Eye, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30" },
  verbal: { label: "Verbal", icon: Mic, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/30" },
  educational: { label: "Educational", icon: BookOpen, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  promotional: { label: "Promotional", icon: Megaphone, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30" },
  "behind-the-scenes": { label: "BTS", icon: Users, color: "text-sky-600", bg: "bg-sky-50 dark:bg-sky-950/30" },
  testimonial: { label: "Testimonial", icon: Star, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
  trending: { label: "Trending", icon: TrendingUp, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30" },
  storytelling: { label: "Storytelling", icon: MessageSquare, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/30" },
}

const PLATFORM_ICONS: Record<Platform, React.ElementType> = {
  x: XIcon,
  linkedin: LinkedInIcon,
  instagram: InstagramIcon,
}

// ── Copy brief helper ─────────────────────────────────────────────────────────

function buildBrief(idea: ContentIdea, videoPrompt?: string): string {
  const lines: string[] = []
  lines.push(`# ${idea.title}`)
  lines.push(`Type: ${TYPE_META[idea.type].label} | Duration: ${idea.estimatedDuration ?? "—"} | Platform: ${idea.platforms.join(", ")}`)
  lines.push("")

  if ((idea as any).hook) {
    lines.push("## Hook")
    lines.push((idea as any).hook)
    lines.push("")
  }

  lines.push("## Description")
  lines.push(idea.description)
  lines.push("")

  if (idea.sceneBreakdown && idea.sceneBreakdown.length > 0) {
    lines.push("## Scene Breakdown")
    idea.sceneBreakdown.forEach((s, i) => {
      lines.push(`${i + 1}. **${s.scene}** (${s.duration}) — ${s.action}`)
    })
    lines.push("")
  }

  if (idea.script) {
    lines.push("## Script / Direction")
    lines.push(idea.script)
    lines.push("")
  }

  if (idea.visualDirection) {
    lines.push("## Visual Direction")
    lines.push(idea.visualDirection)
    lines.push("")
  }

  if (idea.props && idea.props.length > 0) {
    lines.push("## Props / Requirements")
    idea.props.forEach((p) => lines.push(`- ${p}`))
    lines.push("")
  }

  const prompt = videoPrompt ?? idea.videoPrompt
  if (prompt) {
    lines.push("## AI Video Prompt")
    lines.push(prompt)
    lines.push("")
  }

  if (idea.suggestedCaption) {
    lines.push("## Suggested Caption")
    lines.push(`"${idea.suggestedCaption}"`)
  }

  return lines.join("\n")
}

// ── IdeaCard ──────────────────────────────────────────────────────────────────

interface IdeaCardProps {
  idea: ContentIdea
  onSave: (idea: ContentIdea) => void
  onSchedule: (idea: ContentIdea) => void
  onGenerateVideoPrompt?: (idea: ContentIdea) => Promise<string>
}

export function IdeaCard({ idea, onSave, onSchedule, onGenerateVideoPrompt }: IdeaCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [saved, setSaved] = useState(idea.saved ?? false)
  const [confirmUnsave, setConfirmUnsave] = useState(false)
  const [videoPrompt, setVideoPrompt] = useState(idea.videoPrompt)
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [copiedBrief, setCopiedBrief] = useState(false)

  const meta = TYPE_META[idea.type]
  const Icon = meta.icon
  const hook = (idea as any).hook as string | undefined

  const hasBreakdown = !!(idea.script || idea.visualDirection || idea.props?.length || idea.sceneBreakdown?.length)
  const sceneCount = idea.sceneBreakdown?.length ?? 0

  const handleSave = () => {
    if (saved) {
      setConfirmUnsave(true)
    } else {
      setSaved(true)
      toast.success("Idea saved!")
      onSave({ ...idea, saved: true })
    }
  }

  const handleConfirmUnsave = () => {
    setSaved(false)
    toast.success("Removed from saved")
    onSave({ ...idea, saved: false })
    setConfirmUnsave(false)
  }

  const handleGenerateVideoPrompt = async () => {
    if (!onGenerateVideoPrompt) return
    setIsGeneratingPrompt(true)
    try {
      const prompt = await onGenerateVideoPrompt(idea)
      setVideoPrompt(prompt)
      toast.success("AI video prompt generated!")
    } catch {
      toast.error("Failed to generate video prompt.")
    } finally {
      setIsGeneratingPrompt(false)
    }
  }

  const handleCopyPrompt = () => {
    if (!videoPrompt) return
    navigator.clipboard.writeText(videoPrompt)
    setCopiedPrompt(true)
    toast.success("Video prompt copied — paste into Runway, Sora, or Pika")
    setTimeout(() => setCopiedPrompt(false), 2000)
  }

  const handleCopyBrief = () => {
    const brief = buildBrief(idea, videoPrompt)
    navigator.clipboard.writeText(brief)
    setCopiedBrief(true)
    toast.success("Brief copied!", { description: "Paste into Notion, Google Docs, or your notes app" })
    setTimeout(() => setCopiedBrief(false), 2000)
  }

  return (
    <>
    <AlertDialog open={confirmUnsave} onOpenChange={setConfirmUnsave}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove from saved?</AlertDialogTitle>
          <AlertDialogDescription>
            "{idea.title}" will be removed from your saved ideas. You can always save it again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep saved</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmUnsave}>
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Card className="overflow-hidden flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", meta.bg)}>
            <Icon className={cn("size-4", meta.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <Badge variant="outline" className={cn("text-[10px] py-0 h-4 px-1.5 font-medium", meta.color)}>
                {meta.label}
              </Badge>
              {idea.estimatedDuration && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="size-2.5" />
                  {idea.estimatedDuration}
                </span>
              )}
              {sceneCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clapperboard className="size-2.5" />
                  {sceneCount} scenes
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold leading-snug">{idea.title}</h3>
          </div>
          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={handleSave}>
            {saved ? (
              <BookmarkCheck className="size-4 text-primary" />
            ) : (
              <Bookmark className="size-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0 flex-1 flex flex-col">
        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{idea.description}</p>

        {/* Hook callout */}
        {hook && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-0.5">
              🎣 Hook
            </p>
            <p className="text-xs text-amber-900 dark:text-amber-200 italic leading-relaxed">
              "{hook}"
            </p>
          </div>
        )}

        {/* Expandable breakdown */}
        {hasBreakdown && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-primary hover:underline self-start"
            >
              {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              {expanded ? "Hide breakdown" : "Full breakdown"}
            </button>

            {expanded && (
              <div className="space-y-3 rounded-lg bg-muted/50 p-3">
                {idea.script && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Script / Direction
                    </p>
                    <p className="text-xs leading-relaxed whitespace-pre-line">{idea.script}</p>
                  </div>
                )}

                {idea.sceneBreakdown && idea.sceneBreakdown.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                      <Clapperboard className="size-3" />
                      Scene Breakdown
                    </p>
                    <div className="space-y-2">
                      {idea.sceneBreakdown.map((scene, idx) => (
                        <div key={idx} className="flex items-start gap-2.5">
                          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-semibold">{scene.scene}</span>
                              <Badge variant="outline" className="text-[9px] h-3.5 px-1 py-0">
                                {scene.duration}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{scene.action}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {idea.visualDirection && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Visual Direction
                    </p>
                    <p className="text-xs leading-relaxed">{idea.visualDirection}</p>
                  </div>
                )}

                {idea.props && idea.props.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                      <ListChecks className="size-3" />
                      Props / Requirements
                    </p>
                    <ul className="space-y-0.5">
                      {idea.props.map((prop) => (
                        <li key={prop} className="text-xs flex items-center gap-1.5">
                          <span className="size-1 rounded-full bg-muted-foreground/50 shrink-0" />
                          {prop}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* AI Video Prompt — always accessible */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Wand2 className="size-3" />
              AI Video Prompt
            </p>
            {videoPrompt && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[10px] px-1.5 gap-1"
                onClick={handleCopyPrompt}
              >
                {copiedPrompt ? (
                  <Check className="size-2.5 text-emerald-600" />
                ) : (
                  <Copy className="size-2.5" />
                )}
                {copiedPrompt ? "Copied" : "Copy"}
              </Button>
            )}
          </div>

          {videoPrompt ? (
            <div className="rounded bg-zinc-950 dark:bg-zinc-900 border border-zinc-800 px-3 py-2">
              <p className="text-[10px] font-mono leading-relaxed text-zinc-300 line-clamp-3">
                {videoPrompt}
              </p>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs h-7"
              onClick={handleGenerateVideoPrompt}
              disabled={isGeneratingPrompt || !onGenerateVideoPrompt}
            >
              {isGeneratingPrompt ? (
                <>
                  <Loader2 className="size-3 mr-1.5 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Zap className="size-3 mr-1.5" />
                  Generate for Runway / Sora / Pika
                </>
              )}
            </Button>
          )}
        </div>

        {/* Suggested caption */}
        {idea.suggestedCaption && (
          <div className="rounded-lg border bg-card px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Caption
            </p>
            <p className="text-xs italic text-muted-foreground line-clamp-2">
              "{idea.suggestedCaption}"
            </p>
          </div>
        )}

        {/* Platform tags */}
        <div className="flex items-center gap-1.5 mt-auto">
          <span className="text-[10px] text-muted-foreground">Works for:</span>
          {idea.platforms.map((p) => {
            const PIcon = PLATFORM_ICONS[p]
            return <PIcon key={p} className="size-3 text-muted-foreground" />
          })}
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={saved ? "default" : "outline"}
            className="flex-1 text-xs h-7 gap-1"
            onClick={handleSave}
          >
            {saved ? (
              <BookmarkCheck className="size-3" />
            ) : (
              <Bookmark className="size-3" />
            )}
            {saved ? "Saved" : "Save"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs h-7 gap-1"
            onClick={() => onSchedule(idea)}
          >
            <CalendarPlus className="size-3" />
            Schedule
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs h-7 px-2 shrink-0"
            onClick={handleCopyBrief}
            title="Copy full brief"
          >
            {copiedBrief ? (
              <Check className="size-3 text-emerald-600" />
            ) : (
              <Copy className="size-3" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
    </>
  )
}
