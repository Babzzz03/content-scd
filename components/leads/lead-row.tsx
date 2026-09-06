"use client"

import { Globe, Mail, Phone, MessageSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LEAD_STATUS_LABEL, type Lead } from "@/lib/types"
import { cn } from "@/lib/utils"

const STATUS_STYLE: Partial<Record<Lead["status"], string>> = {
  enriched:  "bg-muted text-muted-foreground",
  qualified: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  drafted:   "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  approved:  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  messaged:  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  replied:   "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  opted_out: "bg-destructive/10 text-destructive",
  failed:    "bg-destructive/10 text-destructive",
  skipped:   "bg-muted text-muted-foreground",
}

const formatCount = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(1)}K`
  : String(n)

/** Green above 70, amber above 40, muted below. Mirrors the scoring bands. */
const scoreTone = (score: number) =>
  score >= 70 ? "text-emerald-600 dark:text-emerald-400"
  : score >= 40 ? "text-amber-600 dark:text-amber-500"
  : "text-muted-foreground"

interface LeadRowProps {
  lead: Lead
  selected: boolean
  onSelect: (checked: boolean) => void
  onOpen: () => void
}

export function LeadRow({ lead, selected, onSelect, onOpen }: LeadRowProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 border-b border-border p-3 transition-colors last:border-b-0",
        selected ? "bg-muted/60" : "hover:bg-muted/40"
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={(v) => onSelect(Boolean(v))}
        className="mt-1"
        aria-label={`Select ${lead.username}`}
      />

      <button onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-left">
        <Avatar className="size-9 shrink-0">
          <AvatarImage src={lead.profilePicUrl} alt={lead.username} />
          <AvatarFallback className="text-xs">{lead.username.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{lead.fullName || lead.username}</span>
            <span className="truncate text-xs text-muted-foreground">@{lead.username}</span>
          </div>

          {lead.bio && (
            <p className="line-clamp-1 text-xs text-muted-foreground">{lead.bio}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>{formatCount(lead.followers)} followers</span>
            {lead.category && <span>{lead.category}</span>}
            {!lead.hasWebsite && (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Globe className="size-3" /> No website
              </span>
            )}
            {lead.contact?.email && <Mail className="size-3" />}
            {lead.contact?.phone && <Phone className="size-3" />}
            {lead.replyPreview && (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <MessageSquare className="size-3" /> Replied
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={cn("text-sm font-semibold tabular-nums", scoreTone(lead.score))}>
            {lead.score}
          </span>
          <Badge variant="ghost" className={cn("text-[10px]", STATUS_STYLE[lead.status])}>
            {LEAD_STATUS_LABEL[lead.status]}
          </Badge>
        </div>
      </button>
    </div>
  )
}
