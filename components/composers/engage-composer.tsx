"use client"

import { useState, useRef } from "react"
import {
  Heart,
  Sparkles,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  MessageSquare,
  Lightbulb,
  HelpCircle,
  TrendingUp,
  Bot,
  AlertTriangle,
  Play,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TargetSelector, describeTarget, type TargetConfig } from "./target-selector"
import { generateEngagements } from "@/lib/ai-mock"
import { AutomationLog } from "@/components/automation/automation-log"
import { useAccounts } from "@/lib/accounts-context"
import { useAIProvider } from "@/lib/ai-provider-context"
import type {
  Platform,
  ContentTone,
  GeneratedEngagement,
  AutomationLogEntry,
  AutomationStatus,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const TONES: { value: ContentTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "bold", label: "Bold" },
  { value: "inspirational", label: "Inspirational" },
]

const ENGAGEMENT_TYPES = [
  {
    value: "comment" as const,
    label: "Comment",
    description: "A thoughtful comment on a post",
    icon: MessageSquare,
  },
  {
    value: "conversation-starter" as const,
    label: "Conversation Starter",
    description: "A post to spark discussion",
    icon: TrendingUp,
  },
  {
    value: "question" as const,
    label: "Question",
    description: "An engaging question to your audience",
    icon: HelpCircle,
  },
  {
    value: "insight" as const,
    label: "Insight",
    description: "A valuable observation or take",
    icon: Lightbulb,
  },
]

const ACTIONS_OPTIONS = [1, 3, 5, 10]
const DELAY_OPTIONS = [
  { label: "5s", value: 5000 },
  { label: "15s", value: 15000 },
  { label: "30s", value: 30000 },
  { label: "60s", value: 60000 },
]

const PLATFORM_LABELS: Record<Platform, string> = {
  x: "X",
  linkedin: "LinkedIn",
  instagram: "Instagram",
}

type EngagementType = "comment" | "conversation-starter" | "question" | "insight"

interface EngageComposerProps {
  platform: Platform
  open: boolean
  onClose: () => void
}

export function EngageComposer({ platform, open, onClose }: EngageComposerProps) {
  // Generate tab
  const [topic, setTopic] = useState("")
  const [tone, setTone] = useState<ContentTone>("professional")
  const [engagementType, setEngagementType] = useState<EngagementType>("comment")
  const [engagements, setEngagements] = useState<GeneratedEngagement[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Automate tab
  const [target, setTarget] = useState<TargetConfig>({ type: "hashtag", value: "" })
  const [autoEngagementType, setAutoEngagementType] = useState<EngagementType>("comment")
  const [autoTone, setAutoTone] = useState<ContentTone>("professional")
  const [actionsPerRun, setActionsPerRun] = useState(3)
  const [delayMs, setDelayMs] = useState(15000)
  const [previewEngagements, setPreviewEngagements] = useState<GeneratedEngagement[]>([])
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus>("idle")
  const [logEntries, setLogEntries] = useState<AutomationLogEntry[]>([])
  const [isAutomating, setIsAutomating] = useState(false)
  const stopRef = useRef(false)

  const { getAccount } = useAccounts()
  const { activeProvider } = useAIProvider()
  const account = getAccount(platform)

  const isTargetValid =
    target.type === "trending" || target.type === "recent" || target.value.trim().length > 0

  const TYPE_ICON_MAP: Record<string, React.ElementType> = {
    comment: MessageSquare,
    "conversation-starter": TrendingUp,
    question: HelpCircle,
    insight: Lightbulb,
  }

  // ── Generate tab ────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!topic.trim()) return
    setIsGenerating(true)
    try {
      const results = await generateEngagements({
        platform,
        topic,
        tone,
        engagementType,
        count: 4,
      })
      setEngagements(results)
      toast.success("Engagement content generated!")
    } catch {
      toast.error("Generation failed. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = (item: GeneratedEngagement) => {
    navigator.clipboard.writeText(item.text)
    setCopiedId(item.id)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleUse = (item: GeneratedEngagement) => {
    navigator.clipboard.writeText(item.text)
    toast.success("Engagement text copied!", { description: "Ready to paste where needed" })
  }

  // ── Automate tab ────────────────────────────────────────────────────────────
  const handlePreviewEngagements = async () => {
    if (!isTargetValid) return
    setIsPreviewLoading(true)
    try {
      const topicStr =
        target.type === "trending"
          ? "trending"
          : target.type === "recent"
          ? "recent feed"
          : target.value.replace(/^[#@]/, "")
      const results = await generateEngagements({
        platform,
        topic: topicStr,
        tone: autoTone,
        engagementType: autoEngagementType,
        count: 3,
      })
      setPreviewEngagements(results)
      toast.success("Preview generated — review before starting automation")
    } catch {
      toast.error("Preview failed. Please try again.")
    } finally {
      setIsPreviewLoading(false)
    }
  }

  const addEntry = (entry: Omit<AutomationLogEntry, "id" | "timestamp">) => {
    setLogEntries((prev) => [
      ...prev,
      { ...entry, id: `log-${Date.now()}-${Math.random()}`, timestamp: new Date() },
    ])
  }

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, Math.min(ms, 2000)))

  const handleStartAutomation = async () => {
    if (!isTargetValid || !account.connected) return
    stopRef.current = false
    setIsAutomating(true)
    setAutomationStatus("running")
    setLogEntries([])

    const targetDesc = describeTarget(target)
    const providerLabel = activeProvider ? activeProvider.id : "mock"

    addEntry({ status: "info", message: `Searching ${targetDesc}…` })
    await sleep(1200)

    const postSnippets = [
      "Consistency is everything when building in public…",
      "The real reason most startups fail is not the product…",
      "Three things I wish I knew before launching my brand…",
      "Hot take: your content strategy is broken if…",
      "Here's what actually moves the needle on LinkedIn…",
    ]
    const usernames = [
      "@contentcreator",
      "@brandbuilder",
      "@foundermind",
      "@growthhacker",
      "@bizstrategist",
    ]

    const found = Math.min(actionsPerRun + 2, 8)
    addEntry({ status: "info", message: `Found ${found} posts in ${targetDesc}` })
    await sleep(600)

    let successCount = 0
    for (let i = 0; i < actionsPerRun; i++) {
      if (stopRef.current) {
        addEntry({ status: "warning", message: "Automation stopped by user" })
        break
      }

      const snippet = postSnippets[i % postSnippets.length]
      const user = usernames[i % usernames.length]

      addEntry({ status: "info", message: `Engaging with post by ${user}…`, detail: snippet })
      await sleep(800)

      addEntry({
        status: "running",
        message: `Generating ${autoEngagementType} with ${providerLabel}…`,
      })
      await sleep(1000)

      const engagementSnippets = [
        "This is exactly the mindset shift most people miss.",
        "Brilliant take — the compounding effect here is underrated.",
        "What's your take on how this scales for smaller teams?",
        "Hot take: the brands that win long-term do exactly this.",
        "Saved this. The part about consistency hit differently.",
      ]
      const text = engagementSnippets[i % engagementSnippets.length]

      addEntry({
        status: "success",
        message: `Posted ${autoEngagementType}: '${text}'`,
        detail: `On post by ${user}`,
      })

      successCount++
      if (i < actionsPerRun - 1) await sleep(Math.min(delayMs, 1500))
    }

    if (!stopRef.current) {
      addEntry({
        status: "success",
        message: `Automation complete — ${successCount} engagement${successCount !== 1 ? "s" : ""} posted`,
      })
      setAutomationStatus("completed")
      toast.success(`Automation complete — ${successCount} engagements posted`)
    } else {
      setAutomationStatus("idle")
    }

    setIsAutomating(false)
  }

  const handleStop = () => {
    stopRef.current = true
    setAutomationStatus("completed")
    setIsAutomating(false)
  }

  const handleClose = () => {
    setTopic("")
    setEngagements([])
    setPreviewEngagements([])
    setLogEntries([])
    setAutomationStatus("idle")
    setIsAutomating(false)
    stopRef.current = false
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg sm:max-w-xl lg:max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Heart className="size-4 text-rose-500" />
            <DialogTitle className="text-base">Engage & Comment</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            AI-generated comments, questions, and engagement prompts
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="generate" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-4 shrink-0 w-auto self-start">
            <TabsTrigger value="generate" className="text-xs">
              Generate
            </TabsTrigger>
            <TabsTrigger value="automate" className="text-xs">
              <Bot className="size-3 mr-1.5" />
              Automate
            </TabsTrigger>
          </TabsList>

          {/* ── Generate Tab ── */}
          <TabsContent
            value="generate"
            className="flex-1 overflow-y-auto px-6 py-5 space-y-4 mt-0"
          >
            <div className="space-y-2">
              <Label htmlFor="engage-topic">
                Topic or niche <span className="text-destructive">*</span>
              </Label>
              <Input
                id="engage-topic"
                placeholder="e.g. SaaS growth, fitness coaching, personal finance…"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Engagement type</Label>
              <div className="grid grid-cols-2 gap-2">
                {ENGAGEMENT_TYPES.map((type) => {
                  const TypeIcon = type.icon
                  const isSelected = engagementType === type.value
                  return (
                    <button
                      key={type.value}
                      onClick={() => setEngagementType(type.value)}
                      className={cn(
                        "flex items-start gap-2.5 rounded-lg border-2 p-3 text-left transition-all",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:bg-accent"
                      )}
                    >
                      <TypeIcon
                        className={cn(
                          "size-4 mt-0.5 shrink-0",
                          isSelected ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <div>
                        <p className="text-xs font-medium leading-none">{type.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                          {type.description}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

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

            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={!topic.trim() || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="size-3.5 mr-2 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles data-icon="inline-start" />
                  Generate Engagement
                </>
              )}
            </Button>

            {engagements.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                      {engagements.length} results
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs gap-1"
                      onClick={handleGenerate}
                      disabled={isGenerating}
                    >
                      <RefreshCw className="size-3" />
                      Regenerate
                    </Button>
                  </div>
                  <ScrollArea className="max-h-64">
                    <div className="space-y-3">
                      {engagements.map((item) => {
                        const ItemIcon = TYPE_ICON_MAP[item.type] || MessageSquare
                        return (
                          <div key={item.id} className="rounded-xl border bg-card p-4 space-y-3">
                            <div className="flex items-center gap-1.5">
                              <ItemIcon className="size-3.5 text-muted-foreground" />
                              <Badge variant="outline" className="text-[10px] py-0 h-4 px-1.5">
                                {item.type}
                              </Badge>
                            </div>
                            <p className="text-sm leading-relaxed">{item.text}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {item.characterCount} chars
                              </span>
                              <div className="flex gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7"
                                  onClick={() => handleCopy(item)}
                                >
                                  {copiedId === item.id ? (
                                    <Check className="size-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="size-3.5" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => handleUse(item)}
                                >
                                  Use this
                                </Button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}
          </TabsContent>

          {/* ── Automate Tab ── */}
          <TabsContent value="automate" className="flex-1 overflow-y-auto px-6 py-5 mt-0">
            {automationStatus === "running" || automationStatus === "completed" ? (
              <div className="space-y-4">
                <AutomationLog
                  entries={logEntries}
                  status={automationStatus}
                  platform={platform}
                  onStop={handleStop}
                />
                {automationStatus === "completed" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setAutomationStatus("idle")
                      setLogEntries([])
                    }}
                  >
                    Start New Automation
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Connection warning */}
                {!account.connected && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3">
                    <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Connect your {PLATFORM_LABELS[platform]} account in Settings first
                    </p>
                  </div>
                )}

                {/* Target selector */}
                <TargetSelector
                  label="What to engage with"
                  required
                  value={target}
                  onChange={setTarget}
                />

                {/* Engagement type */}
                <div className="space-y-2">
                  <Label>Engagement type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {ENGAGEMENT_TYPES.map((type) => {
                      const TypeIcon = type.icon
                      const isSelected = autoEngagementType === type.value
                      return (
                        <button
                          key={type.value}
                          onClick={() => setAutoEngagementType(type.value)}
                          className={cn(
                            "flex items-start gap-2.5 rounded-lg border-2 p-3 text-left transition-all",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border bg-background hover:bg-accent"
                          )}
                        >
                          <TypeIcon
                            className={cn(
                              "size-4 mt-0.5 shrink-0",
                              isSelected ? "text-primary" : "text-muted-foreground"
                            )}
                          />
                          <div>
                            <p className="text-xs font-medium leading-none">{type.label}</p>
                            <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                              {type.description}
                            </p>
                          </div>
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
                        onClick={() => setAutoTone(t.value)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          autoTone === t.value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-accent"
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions per run */}
                <div className="space-y-2">
                  <Label>Actions per run</Label>
                  <div className="flex gap-2">
                    {ACTIONS_OPTIONS.map((n) => (
                      <button
                        key={n}
                        onClick={() => setActionsPerRun(n)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                          actionsPerRun === n
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-accent"
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Delay */}
                <div className="space-y-2">
                  <Label>Delay between engagements</Label>
                  <div className="flex gap-2">
                    {DELAY_OPTIONS.map((d) => (
                      <button
                        key={d.value}
                        onClick={() => setDelayMs(d.value)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                          delayMs === d.value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-accent"
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handlePreviewEngagements}
                  disabled={!isTargetValid || isPreviewLoading}
                >
                  {isPreviewLoading ? (
                    <>
                      <Loader2 className="size-3.5 mr-2 animate-spin" />
                      Generating preview…
                    </>
                  ) : (
                    <>
                      <Sparkles data-icon="inline-start" />
                      Preview Engagements
                    </>
                  )}
                </Button>

                {previewEngagements.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                      Sample engagements — review before starting
                    </Label>
                    {previewEngagements.map((item) => (
                      <div key={item.id} className="rounded-lg border bg-muted/30 px-3 py-2.5">
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          "{item.text}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <Separator />

                <Button
                  className="w-full"
                  onClick={handleStartAutomation}
                  disabled={!isTargetValid || !account.connected || isAutomating}
                >
                  <Play className="size-3.5 mr-2" />
                  Start Automation
                  {activeProvider && (
                    <Badge variant="secondary" className="ml-2 text-[10px] h-4 px-1.5">
                      {activeProvider.id}
                    </Badge>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
