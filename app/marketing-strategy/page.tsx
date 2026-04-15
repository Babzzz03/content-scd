"use client"

import { useState } from "react"
import {
  TrendingUp,
  Sparkles,
  Loader2,
  Target,
  Layers,
  Rocket,
  Wrench,
  BarChart2,
  Map,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ArrowRight,
  Mic2,
  RefreshCw,
  Bookmark,
  BookmarkCheck,
  Trash2,
  Clock,
  SlidersHorizontal,
} from "lucide-react"
import { XIcon, LinkedInIcon, InstagramIcon } from "@/components/ui/platform-icons"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { generateMarketingStrategy } from "@/lib/ai-mock"
import { DUMMY_BRAND_VOICE } from "@/lib/dummy-data"
import { useAIProvider } from "@/lib/ai-provider-context"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type {
  MarketingGoal,
  BusinessStage,
  BudgetRange,
  StrategyTimeline,
  MarketingStrategyInput,
  MarketingStrategy,
  Platform,
  StrategyTactic,
} from "@/lib/types"

// ─── Config ───────────────────────────────────────────────────────────────────

const GOALS: { id: MarketingGoal; label: string; emoji: string }[] = [
  { id: "grow-followers", label: "Grow Followers", emoji: "📈" },
  { id: "increase-engagement", label: "Boost Engagement", emoji: "💬" },
  { id: "drive-traffic", label: "Drive Website Traffic", emoji: "🔗" },
  { id: "product-launch", label: "Product Launch", emoji: "🚀" },
  { id: "brand-awareness", label: "Brand Awareness", emoji: "📣" },
  { id: "lead-generation", label: "Lead Generation", emoji: "🎯" },
]

const STAGES: { id: BusinessStage; label: string; description: string }[] = [
  { id: "startup", label: "Startup", description: "Building from scratch" },
  { id: "growing", label: "Growing", description: "Gaining traction" },
  { id: "established", label: "Established", description: "Steady presence" },
  { id: "scaling", label: "Scaling", description: "Expanding rapidly" },
]

const BUDGETS: { id: BudgetRange; label: string; description: string }[] = [
  { id: "bootstrap", label: "Bootstrap", description: "Free tools only" },
  { id: "low", label: "Low", description: "Under $100/mo" },
  { id: "medium", label: "Medium", description: "$100–$500/mo" },
  { id: "enterprise", label: "Enterprise", description: "$500+/mo" },
]

const TIMELINES: { id: StrategyTimeline; label: string }[] = [
  { id: "1-month", label: "1 Month" },
  { id: "3-months", label: "3 Months" },
  { id: "6-months", label: "6 Months" },
  { id: "1-year", label: "1 Year" },
]

const PLATFORMS: { id: Platform; label: string; icon: React.ElementType; color: string }[] = [
  { id: "x", label: "X", icon: XIcon, color: "text-sky-500" },
  { id: "linkedin", label: "LinkedIn", icon: LinkedInIcon, color: "text-blue-600" },
  { id: "instagram", label: "Instagram", icon: InstagramIcon, color: "text-pink-500" },
]

const EFFORT_COLORS = {
  low: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  medium: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  high: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
}

const IMPACT_COLORS = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  medium: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  high: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="size-3.5 text-primary" />
      </div>
      <h2 className="text-sm font-semibold">{title}</h2>
    </div>
  )
}

function TacticCard({ tactic }: { tactic: StrategyTactic }) {
  const [expanded, setExpanded] = useState(false)
  const PIcon = tactic.platform ? PLATFORMS.find((p) => p.id === tactic.platform)?.icon : null
  const platformColor = tactic.platform
    ? PLATFORMS.find((p) => p.id === tactic.platform)?.color
    : null

  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {PIcon && (
            <PIcon className={cn("size-4 mt-0.5 shrink-0", platformColor)} />
          )}
          <p className="text-sm font-medium leading-snug">{tactic.title}</p>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </div>

      {expanded && (
        <p className="text-xs text-muted-foreground leading-relaxed pl-0">
          {tactic.description}
        </p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
            EFFORT_COLORS[tactic.effort]
          )}
        >
          Effort: {tactic.effort}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
            IMPACT_COLORS[tactic.impact]
          )}
        >
          Impact: {tactic.impact}
        </span>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const INITIAL_INPUT: MarketingStrategyInput = {
  goals: ["grow-followers", "increase-engagement"],
  platforms: ["x", "instagram"],
  timeline: "3-months",
  budget: "bootstrap",
  businessStage: "growing",
  useBrandVoice: true,
  additionalContext: "",
}

export default function MarketingStrategyPage() {
  const [input, setInput] = useState<MarketingStrategyInput>(INITIAL_INPUT)
  const [strategy, setStrategy] = useState<MarketingStrategy | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const { activeProvider } = useAIProvider()
  const [activeTab, setActiveTab] = useState<
    "overview" | "pillars" | "tactics" | "tools" | "kpis" | "roadmap"
  >("overview")
  const [savedStrategies, setSavedStrategies] = useState<MarketingStrategy[]>([])
  const [viewMode, setViewMode] = useState<"current" | "saved">("current")
  const [savedViewStrategy, setSavedViewStrategy] = useState<MarketingStrategy | null>(null)
  const [mobileTab, setMobileTab] = useState<"settings" | "results">("settings")

  const toggleGoal = (goal: MarketingGoal) => {
    setInput((prev) => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter((g) => g !== goal)
        : [...prev.goals, goal],
    }))
  }

  const togglePlatform = (platform: Platform) => {
    setInput((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform],
    }))
  }

  const canGenerate = input.goals.length > 0 && input.platforms.length > 0

  const handleGenerate = async () => {
    if (!canGenerate) return
    setIsGenerating(true)
    setStrategy(null)
    setViewMode("current")
    setSavedViewStrategy(null)
    setMobileTab("results")
    try {
      const result = await generateMarketingStrategy(input, activeProvider?.id ?? null)
      const withSnapshot: MarketingStrategy = { ...result, inputSnapshot: input }
      setStrategy(withSnapshot)
      setActiveTab("overview")
      const providerLabel = activeProvider ? ` · ${activeProvider.id}` : ""
      toast.success("Strategy generated!", {
        description: `Your personalised marketing strategy is ready${providerLabel}`,
      })
    } catch {
      toast.error("Generation failed", { description: "Please try again" })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveStrategy = (s: MarketingStrategy) => {
    const already = savedStrategies.find((x) => x.id === s.id)
    if (already) {
      setSavedStrategies((prev) => prev.filter((x) => x.id !== s.id))
      if (strategy?.id === s.id) setStrategy({ ...s, saved: false, savedAt: undefined })
      toast.success("Strategy removed from saved")
    } else {
      const saved: MarketingStrategy = { ...s, saved: true, savedAt: new Date() }
      setSavedStrategies((prev) => [saved, ...prev])
      if (strategy?.id === s.id) setStrategy(saved)
      toast.success("Strategy saved!", { description: "Find it in the Saved tab" })
    }
  }

  const handleDeleteSaved = (id: string) => {
    setSavedStrategies((prev) => prev.filter((x) => x.id !== id))
    if (strategy?.id === id) setStrategy((prev) => prev ? { ...prev, saved: false, savedAt: undefined } : null)
    if (savedViewStrategy?.id === id) setSavedViewStrategy(null)
    toast.success("Strategy removed from saved")
  }

  const activeStrategy = viewMode === "saved" && savedViewStrategy ? savedViewStrategy : strategy
  const isStrategySaved = (s: MarketingStrategy) => savedStrategies.some((x) => x.id === s.id)

  const tabs = [
    { id: "overview", label: "Overview", icon: Target },
    { id: "pillars", label: "Content Pillars", icon: Layers },
    { id: "tactics", label: "Growth Tactics", icon: Rocket },
    { id: "tools", label: "Tools", icon: Wrench },
    { id: "kpis", label: "KPIs", icon: BarChart2 },
    { id: "roadmap", label: "Roadmap", icon: Map },
  ] as const

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Page header */}
      <div data-tour="page-marketing-strategy" className="sticky top-0 z-10 bg-background flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5 border-b">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <TrendingUp className="size-4 sm:size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-semibold leading-tight">Marketing Strategy</h1>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-none">
              AI-powered strategy tailored to your brand and goals
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Saved tab toggle */}
          <div className="flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5">
            <button
              onClick={() => setViewMode("current")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                viewMode === "current"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Current
            </button>
            <button
              onClick={() => setViewMode("saved")}
              className={cn(
                "flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors",
                viewMode === "saved"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BookmarkCheck className="size-3" />
              Saved ({savedStrategies.length})
            </button>
          </div>
          {strategy && viewMode === "current" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSaveStrategy(strategy)}
              >
                {isStrategySaved(strategy) ? (
                  <><BookmarkCheck className="size-3.5 mr-1.5 text-primary" />Saved</>
                ) : (
                  <><Bookmark className="size-3.5 mr-1.5" />Save</>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                <RefreshCw className="size-3.5 mr-1.5" />
                Regenerate
              </Button>
            </>
          )}
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
          Configure
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
          <TrendingUp className="size-3.5" />
          Strategy
        </button>
      </div>

      <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-start">
        {/* Left: Input panel */}
        <div className={cn(
          "w-full lg:w-80 shrink-0 space-y-5",
          mobileTab !== "settings" && "hidden lg:block"
        )}>
          {/* Brand Voice toggle */}
          <div
            className={cn(
              "rounded-xl border p-4 cursor-pointer transition-colors select-none",
              input.useBrandVoice
                ? "border-primary/40 bg-primary/5"
                : "hover:bg-accent/40"
            )}
            onClick={() =>
              setInput((prev) => ({ ...prev, useBrandVoice: !prev.useBrandVoice }))
            }
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic2 className="size-4 text-primary" />
                <span className="text-sm font-medium">Use Brand Voice</span>
              </div>
              <div
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                  input.useBrandVoice ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "inline-block size-3.5 rounded-full bg-white shadow transition-transform",
                    input.useBrandVoice ? "translate-x-4" : "translate-x-0.5"
                  )}
                />
              </div>
            </div>
            {input.useBrandVoice && DUMMY_BRAND_VOICE && (
              <div className="mt-2 pt-2 border-t border-primary/20">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {DUMMY_BRAND_VOICE.brandName}
                  </span>{" "}
                  · {DUMMY_BRAND_VOICE.industry} · {DUMMY_BRAND_VOICE.targetAudience}
                </p>
              </div>
            )}
          </div>

          {/* Goals */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
              Marketing Goals
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map((goal) => {
                const selected = input.goals.includes(goal.id)
                return (
                  <button
                    key={goal.id}
                    onClick={() => toggleGoal(goal.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors",
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background hover:bg-accent"
                    )}
                  >
                    <span>{goal.emoji}</span>
                    <span>{goal.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Platforms */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
              Platforms
            </Label>
            <div className="flex gap-2">
              {PLATFORMS.map((p) => {
                const selected = input.platforms.includes(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background hover:bg-accent"
                    )}
                  >
                    <p.icon className={cn("size-3.5", selected ? "text-primary" : p.color)} />
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Business Stage */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
              Business Stage
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {STAGES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setInput((prev) => ({ ...prev, businessStage: s.id }))}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition-colors",
                    input.businessStage === s.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:bg-accent"
                  )}
                >
                  <p
                    className={cn(
                      "text-xs font-medium",
                      input.businessStage === s.id ? "text-primary" : "text-foreground"
                    )}
                  >
                    {s.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
              Budget Range
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {BUDGETS.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setInput((prev) => ({ ...prev, budget: b.id }))}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition-colors",
                    input.budget === b.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:bg-accent"
                  )}
                >
                  <p
                    className={cn(
                      "text-xs font-medium",
                      input.budget === b.id ? "text-primary" : "text-foreground"
                    )}
                  >
                    {b.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{b.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
              Timeline
            </Label>
            <div className="flex gap-2 flex-wrap">
              {TIMELINES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setInput((prev) => ({ ...prev, timeline: t.id }))}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    input.timeline === t.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-accent"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Additional context */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
              Additional Context{" "}
              <span className="normal-case font-normal">(optional)</span>
            </Label>
            <Textarea
              placeholder="Describe your brand, product, current challenges, or anything else the AI should know..."
              value={input.additionalContext}
              onChange={(e) =>
                setInput((prev) => ({ ...prev, additionalContext: e.target.value }))
              }
              className="min-h-24 resize-none text-sm"
            />
          </div>

          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                Building Strategy...
              </>
            ) : (
              <>
                <Sparkles className="size-3.5 mr-1.5" />
                Generate Strategy
                {activeProvider && (
                  <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-medium capitalize">
                    {activeProvider.id}
                  </span>
                )}
              </>
            )}
          </Button>
        </div>

        {/* Right: Results */}
        <div className={cn(
          "flex-1 min-w-0",
          mobileTab !== "results" && "hidden lg:block"
        )}>
          {/* Saved strategies list */}
          {viewMode === "saved" && !savedViewStrategy && (
            savedStrategies.length === 0 ? (
              <div className="rounded-xl border border-dashed p-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-xl bg-muted mx-auto mb-3">
                  <Bookmark className="size-6 text-muted-foreground/60" />
                </div>
                <h3 className="text-base font-semibold mb-1">No saved strategies yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Generate a strategy and click <strong>Save</strong> to store it here for future reference.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setViewMode("current")}
                >
                  Go to Current
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground mb-3">
                  {savedStrategies.length} saved {savedStrategies.length === 1 ? "strategy" : "strategies"}
                </p>
                {savedStrategies.map((s) => {
                  const snap = s.inputSnapshot
                  return (
                    <div
                      key={s.id}
                      className="rounded-xl border bg-card p-4 hover:bg-accent/30 transition-colors cursor-pointer"
                      onClick={() => setSavedViewStrategy(s)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            {snap?.goals.slice(0, 2).map((g) => {
                              const goal = GOALS.find((x) => x.id === g)
                              return goal ? (
                                <span key={g} className="text-[10px] flex items-center gap-0.5 rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
                                  {goal.emoji} {goal.label}
                                </span>
                              ) : null
                            })}
                            {snap && snap.goals.length > 2 && (
                              <span className="text-[10px] text-muted-foreground">+{snap.goals.length - 2} more</span>
                            )}
                          </div>
                          <p className="text-sm leading-relaxed line-clamp-2 text-muted-foreground">
                            {s.overview}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                            {snap && (
                              <>
                                <span className="capitalize">{snap.timeline.replace("-", " ")}</span>
                                <span>·</span>
                                <span className="capitalize">{snap.businessStage}</span>
                                <span>·</span>
                                <span className="capitalize">{snap.budget}</span>
                              </>
                            )}
                            {s.savedAt && (
                              <>
                                <span>·</span>
                                <span suppressHydrationWarning className="flex items-center gap-1">
                                  <Clock className="size-2.5" />
                                  {s.savedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleDeleteSaved(s.id) }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* Viewing a saved strategy */}
          {viewMode === "saved" && savedViewStrategy && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSavedViewStrategy(null)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowRight className="size-3 rotate-180" />
                  Back to saved
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDeleteSaved(savedViewStrategy.id)}
                >
                  <Trash2 className="size-3.5 mr-1.5" />
                  Remove
                </Button>
              </div>
            </div>
          )}

          {viewMode === "current" && !strategy && !isGenerating && (
            <div className="rounded-xl border border-dashed p-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 mx-auto mb-3">
                <TrendingUp className="size-6 text-primary" />
              </div>
              <h3 className="text-base font-semibold mb-1">Ready to build your strategy</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Configure your goals, platforms, and context on the left, then generate a
                personalised marketing strategy with actionable advice.
              </p>
              <div className="flex items-center justify-center gap-4 mt-6 text-xs text-muted-foreground">
                {["Content Pillars", "Growth Tactics", "Tool Picks", "KPIs", "Roadmap"].map(
                  (item, i, arr) => (
                    <span key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="size-3 text-primary" />
                      {item}
                      {i < arr.length - 1 && <ArrowRight className="size-3 opacity-30" />}
                    </span>
                  )
                )}
              </div>
            </div>
          )}

          {viewMode === "current" && isGenerating && (
            <div className="rounded-xl border p-12 text-center">
              <Loader2 className="size-8 text-primary animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium">Building your personalised strategy...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Analysing your goals, brand voice, and platform data
              </p>
            </div>
          )}

          {((viewMode === "current" && strategy) || (viewMode === "saved" && savedViewStrategy)) && (
            <div className="space-y-4">
              {/* Tab nav */}
              <div className="flex gap-1 flex-wrap border rounded-xl p-1 bg-muted/30">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      activeTab === tab.id
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <tab.icon className="size-3" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <ScrollArea className="max-h-[calc(100vh-14rem)]">
                <div className="pr-2 space-y-4">
                  {/* Overview */}
                  {activeTab === "overview" && (
                    <div className="space-y-4">
                      <SectionHeader icon={Target} title="Strategy Overview" />
                      <div className="rounded-xl border bg-card p-5">
                        <p className="text-sm leading-relaxed text-foreground">
                          {activeStrategy!.overview}
                        </p>
                      </div>
                      {/* Summary chips */}
                      {(() => {
                        const snap = activeStrategy!.inputSnapshot ?? input
                        return (
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {[
                              { label: "Goals", value: snap.goals.length.toString() },
                              { label: "Platforms", value: snap.platforms.length.toString() },
                              { label: "Timeline", value: TIMELINES.find((t) => t.id === snap.timeline)?.label ?? "" },
                              { label: "Stage", value: STAGES.find((s) => s.id === snap.businessStage)?.label ?? "" },
                            ].map((item) => (
                              <div
                                key={item.label}
                                className="rounded-xl border bg-card p-3 text-center"
                              >
                                <p className="text-lg font-bold">{item.value}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                  {item.label}
                                </p>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {/* Content Pillars */}
                  {activeTab === "pillars" && (
                    <div className="space-y-4">
                      <SectionHeader icon={Layers} title="Content Pillars" />
                      {activeStrategy!.contentPillars.map((pillar, i) => (
                        <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold">{pillar.name}</h3>
                            <Badge variant="secondary" className="text-[10px]">
                              {pillar.postingFrequency}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {pillar.description}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {pillar.exampleFormats.map((fmt) => (
                              <span
                                key={fmt}
                                className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
                              >
                                {fmt}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Growth Tactics */}
                  {activeTab === "tactics" && (
                    <div className="space-y-3">
                      <SectionHeader icon={Rocket} title="Growth Tactics" />
                      <p className="text-xs text-muted-foreground -mt-2 mb-3">
                        Click any tactic to expand the full description.
                      </p>
                      {activeStrategy!.growthTactics.map((tactic, i) => (
                        <TacticCard key={i} tactic={tactic} />
                      ))}
                    </div>
                  )}

                  {/* Tools */}
                  {activeTab === "tools" && (
                    <div className="space-y-4">
                      <SectionHeader icon={Wrench} title="Recommended Tools" />
                      {activeStrategy!.toolRecommendations.map((tool, i) => (
                        <div key={i} className="rounded-xl border bg-card p-5 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold">{tool.name}</h3>
                              <span className="text-[10px] text-muted-foreground">
                                {tool.category}
                              </span>
                            </div>
                            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                              {tool.pricing}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {tool.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* KPIs */}
                  {activeTab === "kpis" && (
                    <div className="space-y-4">
                      <SectionHeader icon={BarChart2} title="KPIs & Metrics" />
                      <div className="rounded-xl border overflow-hidden">
                        {activeStrategy!.kpis.map((kpi, i) => (
                          <div
                            key={i}
                            className={cn(
                              "p-4 space-y-1",
                              i < activeStrategy!.kpis.length - 1 && "border-b"
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium">{kpi.metric}</p>
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {kpi.timeframe}
                              </Badge>
                            </div>
                            <p className="text-xs font-semibold text-primary">{kpi.target}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {kpi.howToMeasure}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Roadmap */}
                  {activeTab === "roadmap" && (
                    <div className="space-y-4">
                      <SectionHeader icon={Map} title="Execution Roadmap" />
                      {activeStrategy!.roadmap.map((phase, i) => (
                        <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold">{phase.phase}</h3>
                              <p className="text-xs text-primary font-medium mt-0.5">
                                {phase.timeframe}
                              </p>
                            </div>
                            <Badge
                              variant="secondary"
                              className="text-[10px] shrink-0 mt-0.5"
                            >
                              {phase.focus}
                            </Badge>
                          </div>
                          <Separator />
                          <ul className="space-y-2">
                            {phase.actions.map((action, j) => (
                              <li key={j} className="flex items-start gap-2 text-xs">
                                <CheckCircle2 className="size-3.5 mt-0.5 shrink-0 text-primary" />
                                <span className="text-muted-foreground">{action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
