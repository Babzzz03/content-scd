"use client"

import { useState, useRef } from "react"
import {
  MessageCircleReply,
  Sparkles,
  Loader2,
  Copy,
  Check,
  RefreshCw,
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
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TargetSelector, describeTarget, type TargetConfig } from "./target-selector"
import { generateReplies } from "@/lib/ai-mock"
import { AutomationLog } from "@/components/automation/automation-log"
import { DUMMY_BRAND_VOICE } from "@/lib/dummy-data"
import { useAccounts } from "@/lib/accounts-context"
import { useAIProvider } from "@/lib/ai-provider-context"
import type {
  Platform,
  ContentTone,
  GeneratedReply,
  AutomationLogEntry,
  AutomationStatus,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const TONES: { value: ContentTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "humorous", label: "Humorous" },
  { value: "educational", label: "Educational" },
  { value: "bold", label: "Bold" },
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

interface ReplyComposerProps {
  platform: Platform
  open: boolean
  onClose: () => void
}

export function ReplyComposer({ platform, open, onClose }: ReplyComposerProps) {
  // Generate tab
  const [originalPost, setOriginalPost] = useState("")
  const [authorHandle, setAuthorHandle] = useState("")
  const [tone, setTone] = useState<ContentTone>("professional")
  const [useBrandVoice, setUseBrandVoice] = useState(true)
  const [replies, setReplies] = useState<GeneratedReply[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Automate tab
  const [target, setTarget] = useState<TargetConfig>({ type: "handle", value: "" })
  const [autoTone, setAutoTone] = useState<ContentTone>("professional")
  const [autoBrandVoice, setAutoBrandVoice] = useState(true)
  const [actionsPerRun, setActionsPerRun] = useState(3)
  const [delayMs, setDelayMs] = useState(15000)
  const [previewReplies, setPreviewReplies] = useState<GeneratedReply[]>([])
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

  // ── Generate tab ────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!originalPost.trim()) return
    setIsGenerating(true)
    try {
      const results = await generateReplies({
        platform,
        originalPost,
        authorHandle,
        tone,
        useBrandVoice,
        replyCount: 3,
      })
      setReplies(results)
      toast.success("Replies generated!")
    } catch {
      toast.error("Generation failed. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = (reply: GeneratedReply) => {
    navigator.clipboard.writeText(reply.text)
    setCopiedId(reply.id)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleUseReply = (reply: GeneratedReply) => {
    navigator.clipboard.writeText(reply.text)
    toast.success("Reply ready to post!", { description: "Copied and ready to paste" })
  }

  // ── Automate tab ────────────────────────────────────────────────────────────
  const handlePreviewReplies = async () => {
    if (!isTargetValid) return
    setIsPreviewLoading(true)
    try {
      const results = await generateReplies({
        platform,
        originalPost: `Preview for ${describeTarget(target)}`,
        tone: autoTone,
        useBrandVoice: autoBrandVoice,
        replyCount: 3,
      })
      setPreviewReplies(results)
      toast.success("Preview generated — review before starting automation")
    } catch {
      toast.error("Preview failed. Please try again.")
    } finally {
      setIsPreviewLoading(false)
    }
  }

  const addEntry = (entry: Omit<AutomationLogEntry, "id" | "timestamp">) => {
    const newEntry: AutomationLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
    }
    setLogEntries((prev) => [...prev, newEntry])
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

    addEntry({ status: "info", message: `Fetching ${targetDesc}…` })
    await sleep(1200)

    const postSnippets = [
      "Great insights on productivity this week…",
      "Why consistency beats motivation every time…",
      "The one habit that changed my workflow…",
      "Unpopular opinion: hustle culture is overrated…",
      "How I went from 0 to 10k followers in 90 days…",
    ]
    const usernames = ["@creator123", "@brandbuilder", "@growthhacker", "@foundermode", "@contentpro"]

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

      addEntry({ status: "info", message: `Found post: '${snippet}' by ${user}` })
      await sleep(800)

      addEntry({ status: "running", message: `Generating reply with ${providerLabel}…` })
      await sleep(1000)

      const replySnippets = [
        "Completely agree — the key is consistency over everything.",
        "This is such a valid point. Authenticity wins every time.",
        "Couldn't have said it better. The compounding effect is real.",
        "Love this perspective. What's worked for us is leaning into storytelling.",
        "100% this. The brands that show up daily are the ones that grow.",
      ]
      const replyText = replySnippets[i % replySnippets.length]

      addEntry({
        status: "success",
        message: `Posted reply: '${replyText}'`,
        detail: `Target: ${user} · ${snippet.slice(0, 40)}…`,
      })

      successCount++
      if (i < actionsPerRun - 1) await sleep(Math.min(delayMs, 1500))
    }

    if (!stopRef.current) {
      addEntry({
        status: "success",
        message: `Automation complete — ${successCount} ${successCount === 1 ? "reply" : "replies"} posted`,
      })
      setAutomationStatus("completed")
      toast.success(`Automation complete — ${successCount} replies posted`)
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
    setOriginalPost("")
    setAuthorHandle("")
    setReplies([])
    setPreviewReplies([])
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
            <MessageCircleReply className="size-4 text-emerald-600" />
            <DialogTitle className="text-base">Reply Composer</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Generate smart, on-brand replies with AI
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="generate" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-4 shrink-0 w-auto self-start">
            <TabsTrigger value="generate" className="text-xs">
              Generate Replies
            </TabsTrigger>
            <TabsTrigger value="automate" className="text-xs">
              <Bot className="size-3 mr-1.5" />
              Automate Replies
            </TabsTrigger>
          </TabsList>

          {/* ── Generate Tab ── */}
          <TabsContent
            value="generate"
            className="flex-1 overflow-y-auto px-6 py-5 space-y-4 mt-0"
          >
            <div className="space-y-2">
              <Label htmlFor="original-post">
                Post to reply to <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="original-post"
                placeholder="Paste the original post content here…"
                rows={4}
                value={originalPost}
                onChange={(e) => setOriginalPost(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="author-handle">
                Author handle{" "}
                <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                id="author-handle"
                placeholder="@username"
                value={authorHandle}
                onChange={(e) => setAuthorHandle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Reply tone</Label>
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

            <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-3">
              <p className="text-sm">Use Brand Voice</p>
              <Switch checked={useBrandVoice} onCheckedChange={setUseBrandVoice} />
            </div>

            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={!originalPost.trim() || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="size-3.5 mr-2 animate-spin" />
                  Generating replies…
                </>
              ) : (
                <>
                  <Sparkles data-icon="inline-start" />
                  Generate Replies
                </>
              )}
            </Button>

            {replies.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                      {replies.length} generated replies
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
                      {replies.map((reply) => (
                        <div key={reply.id} className="rounded-xl border bg-card p-4 space-y-3">
                          <p className="text-sm leading-relaxed">{reply.text}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {reply.tone}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {reply.characterCount} chars
                              </span>
                            </div>
                            <div className="flex gap-1.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() => handleCopy(reply)}
                              >
                                {copiedId === reply.id ? (
                                  <Check className="size-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="size-3.5" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleUseReply(reply)}
                              >
                                Use this
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
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
                  label="What to reply to"
                  required
                  value={target}
                  onChange={setTarget}
                />

                {/* Tone */}
                <div className="space-y-2">
                  <Label>Reply tone</Label>
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

                {/* Brand voice */}
                <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-3">
                  <p className="text-sm">Use Brand Voice</p>
                  <Switch checked={autoBrandVoice} onCheckedChange={setAutoBrandVoice} />
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
                  <Label>Delay between replies</Label>
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
                  onClick={handlePreviewReplies}
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
                      Preview Replies
                    </>
                  )}
                </Button>

                {previewReplies.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                      Sample replies — review before starting
                    </Label>
                    {previewReplies.map((reply) => (
                      <div key={reply.id} className="rounded-lg border bg-muted/30 px-3 py-2.5">
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          "{reply.text}"
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
