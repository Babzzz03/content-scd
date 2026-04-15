"use client"

import {
  Link2,
  AtSign,
  Hash,
  Search,
  TrendingUp,
  Clock,
  ChevronDown,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export type TargetType =
  | "post-url"
  | "handle"
  | "hashtag"
  | "topic"
  | "trending"
  | "recent"

export interface TargetConfig {
  type: TargetType
  value: string // URL / handle / hashtag / topic keyword — empty for trending/recent
}

const TARGET_OPTIONS: {
  type: TargetType
  label: string
  icon: React.ElementType
  description: string
  placeholder?: string
  hasInput: boolean
}[] = [
  {
    type: "post-url",
    label: "Specific Post",
    icon: Link2,
    description: "Target a single post by URL",
    placeholder: "https://x.com/user/status/...",
    hasInput: true,
  },
  {
    type: "handle",
    label: "Account",
    icon: AtSign,
    description: "All recent posts from a @handle",
    placeholder: "@username",
    hasInput: true,
  },
  {
    type: "hashtag",
    label: "Hashtag",
    icon: Hash,
    description: "Posts using a specific hashtag",
    placeholder: "#contentmarketing",
    hasInput: true,
  },
  {
    type: "topic",
    label: "Topic / Keyword",
    icon: Search,
    description: "Posts matching a keyword or topic",
    placeholder: "e.g. SaaS growth, fitness coaching…",
    hasInput: true,
  },
  {
    type: "trending",
    label: "Trending Posts",
    icon: TrendingUp,
    description: "Currently trending content on this platform",
    hasInput: false,
  },
  {
    type: "recent",
    label: "Recent Feed",
    icon: Clock,
    description: "Most recent posts from people you follow",
    hasInput: false,
  },
]

interface TargetSelectorProps {
  value: TargetConfig
  onChange: (config: TargetConfig) => void
  label?: string
  required?: boolean
}

export function TargetSelector({
  value,
  onChange,
  label = "Target",
  required = false,
}: TargetSelectorProps) {
  const selected = TARGET_OPTIONS.find((o) => o.type === value.type)!

  const handleTypeChange = (type: TargetType) => {
    onChange({ type, value: "" })
  }

  return (
    <div className="space-y-3">
      <Label>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>

      {/* Type grid */}
      <div className="grid grid-cols-3 gap-2">
        {TARGET_OPTIONS.map((opt) => {
          const Icon = opt.icon
          const isSelected = value.type === opt.type
          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => handleTypeChange(opt.type)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border-2 px-3 py-2.5 text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background hover:bg-accent"
              )}
            >
              <Icon
                className={cn(
                  "size-3.5 shrink-0",
                  isSelected ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-[11px] font-medium leading-tight",
                  isSelected ? "text-primary" : "text-foreground"
                )}
              >
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground">{selected.description}</p>

      {/* Input (only for types that need one) */}
      {selected.hasInput && (
        <Input
          placeholder={selected.placeholder}
          value={value.value}
          onChange={(e) => onChange({ type: value.type, value: e.target.value })}
        />
      )}
    </div>
  )
}

/** Returns a human-readable summary for use in log messages */
export function describeTarget(config: TargetConfig): string {
  switch (config.type) {
    case "post-url":
      return `post ${config.value || "(URL)"}`
    case "handle":
      return `posts by ${config.value.startsWith("@") ? config.value : "@" + config.value}`
    case "hashtag":
      return `posts tagged ${config.value.startsWith("#") ? config.value : "#" + config.value}`
    case "topic":
      return `posts about "${config.value}"`
    case "trending":
      return "trending posts"
    case "recent":
      return "recent feed posts"
  }
}
