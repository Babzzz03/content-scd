"use client"

import { useState, type KeyboardEvent } from "react"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface TagInputProps {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  /** Suggestions offered as one-click chips below the field */
  suggestions?: string[]
  className?: string
  max?: number
}

/**
 * Comma or Enter commits a tag. Backspace on an empty field removes the last
 * one, which is the behaviour people expect from every tag field they have
 * used before.
 */
export function TagInput({ value, onChange, placeholder, suggestions = [], className, max = 12 }: TagInputProps) {
  const [draft, setDraft] = useState("")

  const commit = (raw: string) => {
    const tag = raw.trim().replace(/^#/, "")
    if (!tag) return
    if (value.length >= max) return
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) return
    onChange([...value, tag])
    setDraft("")
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      commit(draft)
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  const unusedSuggestions = suggestions.filter(
    (s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())
  )

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-transparent p-2 focus-within:ring-1 focus-within:ring-ring">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== tag))}
              className="rounded-sm opacity-60 hover:opacity-100"
              aria-label={`Remove ${tag}`}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => commit(draft)}
          placeholder={value.length ? "" : placeholder}
          className="h-6 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 min-w-24"
        />
      </div>

      {unusedSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {unusedSuggestions.slice(0, 6).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => commit(s)}
              className="rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-solid hover:text-foreground"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
