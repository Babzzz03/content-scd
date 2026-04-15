"use client"

import { useState } from "react"
import { Eye, EyeOff, CheckCircle2, Circle, Trash2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useAIProvider } from "@/lib/ai-provider-context"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { AIProviderID } from "@/lib/types"

const PROVIDER_META: Record<
  AIProviderID,
  {
    label: string
    description: string
    keyPrefix: string
    keyPlaceholder: string
    docsUrl: string
    gradient: string
    iconText: string
  }
> = {
  claude: {
    label: "Claude",
    description: "Anthropic's Claude — exceptional reasoning, nuanced writing, and long-context understanding.",
    keyPrefix: "sk-ant-",
    keyPlaceholder: "sk-ant-api03-...",
    docsUrl: "https://console.anthropic.com",
    gradient: "from-orange-500 to-amber-400",
    iconText: "A",
  },
  gemini: {
    label: "Gemini",
    description: "Google's Gemini — multimodal capabilities with deep integration across Google's ecosystem.",
    keyPrefix: "AIza",
    keyPlaceholder: "AIzaSy...",
    docsUrl: "https://aistudio.google.com",
    gradient: "from-blue-500 to-cyan-400",
    iconText: "G",
  },
  chatgpt: {
    label: "ChatGPT",
    description: "OpenAI's GPT-4 — versatile, widely supported, with a large ecosystem of plugins and tools.",
    keyPrefix: "sk-",
    keyPlaceholder: "sk-proj-...",
    docsUrl: "https://platform.openai.com",
    gradient: "from-emerald-500 to-teal-400",
    iconText: "O",
  },
}

function ProviderCard({ id }: { id: AIProviderID }) {
  const { providers, activeProvider, setApiKey, setActiveProvider, disableAll } =
    useAIProvider()
  const provider = providers.find((p) => p.id === id)!
  const meta = PROVIDER_META[id]

  const [draft, setDraft] = useState(provider.apiKey)
  const [showKey, setShowKey] = useState(false)
  const [dirty, setDirty] = useState(false)

  const isActive = provider.enabled
  const hasKey = provider.apiKey.trim().length > 0

  const handleSaveKey = () => {
    setApiKey(id, draft.trim())
    setDirty(false)
    toast.success(`${meta.label} API key saved`)
  }

  const handleClearKey = () => {
    setApiKey(id, "")
    setDraft("")
    setDirty(false)
    if (isActive) disableAll()
    toast.info(`${meta.label} API key removed`)
  }

  const handleToggleActive = () => {
    if (!hasKey) {
      toast.error("Add an API key first", {
        description: `Paste your ${meta.label} API key to enable this provider`,
      })
      return
    }
    if (isActive) {
      disableAll()
      toast.info(`${meta.label} disabled`)
    } else {
      setActiveProvider(id)
      toast.success(`${meta.label} is now your active AI provider`)
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-card transition-shadow",
        isActive && "border-primary shadow-sm ring-1 ring-primary/20"
      )}
    >
      {/* Card header */}
      <div className="flex items-start gap-4 p-5">
        {/* Icon */}
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white text-sm font-bold",
            meta.gradient
          )}
        >
          {meta.iconText}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{meta.label}</span>
            {isActive && (
              <Badge className="text-[10px] h-4 px-1.5 bg-primary/15 text-primary border-primary/30">
                Active
              </Badge>
            )}
            {hasKey && !isActive && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                Key saved
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {meta.description}
          </p>
        </div>

        {/* Enable/disable toggle */}
        <button
          onClick={handleToggleActive}
          className={cn(
            "shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
            isActive
              ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
              : "border-border bg-background hover:bg-accent text-muted-foreground"
          )}
        >
          {isActive ? (
            <CheckCircle2 className="size-3.5 text-primary" />
          ) : (
            <Circle className="size-3.5" />
          )}
          {isActive ? "Enabled" : "Enable"}
        </button>
      </div>

      {/* API key input */}
      <div className="px-5 pb-5 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            API Key
            {hasKey && (
              <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-normal">
                ✓ Saved
              </span>
            )}
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                placeholder={meta.keyPlaceholder}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value)
                  setDirty(e.target.value !== provider.apiKey)
                }}
                className="pr-9 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
            {hasKey && (
              <Button
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={handleClearKey}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <a
            href={meta.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Get API key from {meta.label} →
          </a>
          {dirty && (
            <Button size="sm" className="h-7 px-3 text-xs" onClick={handleSaveKey}>
              Save Key
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function AIProviders() {
  const { activeProvider } = useAIProvider()

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="size-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">AI Providers</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add your API keys and choose which AI powers your content generation
          </p>
        </div>
      </div>

      {/* Active provider notice */}
      {activeProvider ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 px-4 py-2.5 flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-xs text-emerald-700 dark:text-emerald-300">
            <span className="font-medium">
              {PROVIDER_META[activeProvider.id].label}
            </span>{" "}
            is your active AI provider — all generation features will use this model.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-2.5 flex items-center gap-2">
          <Sparkles className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            No AI provider enabled — the app will use built-in mock responses. Add a key
            and enable a provider to use real AI generation.
          </p>
        </div>
      )}

      {/* Provider cards */}
      <div className="space-y-3">
        {(["claude", "gemini", "chatgpt"] as AIProviderID[]).map((id) => (
          <ProviderCard key={id} id={id} />
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        API keys are stored in memory for this session only and are never sent to any
        server. Only one provider can be active at a time.
      </p>
    </div>
  )
}
