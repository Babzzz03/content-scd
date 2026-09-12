"use client"

import { useEffect, useState } from "react"
import { Plus, Loader2, Radar, MapPin, Check, AlertTriangle, Pause, MoreVertical, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { LeadCampaign } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * Campaign picker.
 *
 * Replaces a Select dropdown, which hid every campaign behind a click and gave
 * no way to tell two similarly named runs apart. A persistent list can show
 * each campaign's state and yield at a glance, which is what you actually pick
 * on.
 */

const STATUS_META: Record<string, { label: string; icon: typeof Check; tone: string }> = {
  draft:       { label: "Draft",     icon: Radar,         tone: "text-muted-foreground" },
  discovering: { label: "Searching", icon: Loader2,       tone: "text-blue-500" },
  ready:       { label: "Ready",     icon: Check,         tone: "text-emerald-500" },
  sending:     { label: "Sending",   icon: Loader2,       tone: "text-blue-500" },
  paused:      { label: "Paused",    icon: Pause,         tone: "text-amber-500" },
  completed:   { label: "Done",      icon: Check,         tone: "text-emerald-500" },
  error:       { label: "Error",     icon: AlertTriangle, tone: "text-destructive" },
}

interface CampaignListProps {
  campaigns: LeadCampaign[]
  activeId: string
  onSelect: (id: string) => void
  onNew: () => void
  onEdit?: (campaign: LeadCampaign) => void
  onDelete?: (campaign: LeadCampaign) => void
  newLabel?: string
  className?: string
}

export function CampaignList({
  campaigns, activeId, onSelect, onNew, onEdit, onDelete,
  newLabel = "New campaign", className,
}: CampaignListProps) {
  const [confirmDelete, setConfirmDelete] = useState<LeadCampaign | null>(null)
  // Clock kept in state rather than read during render: React treats Date.now()
  // in render as impure, since it can differ between renders of the same state.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium text-muted-foreground">
          {campaigns.length} {campaigns.length === 1 ? "search" : "searches"}
        </span>
        <Button variant="ghost" size="xs" onClick={onNew}>
          <Plus className="size-3" /> New
        </Button>
      </div>

      <ScrollArea className="max-h-[60vh]">
        <div className="flex flex-col gap-1 pr-2">
          {campaigns.map((c) => {
            const meta = STATUS_META[c.status] ?? STATUS_META.draft
            const Icon = meta.icon
            const spinning = c.status === "discovering" || c.status === "sending"
            const active = c._id === activeId

            // A queued continuation means work is still happening between batches
            const pending = Boolean(
              c.continuesAt && new Date(c.continuesAt).getTime() > now
            )

            const target = c.targetLeadCount || 0
            const found = c.stats?.qualified ?? 0
            const pct = target > 0 ? Math.min(100, (found / target) * 100) : 0

            return (
              <div
                key={c._id}
                className={cn(
                  "group relative rounded-md border transition-colors",
                  active
                    ? "border-border bg-muted"
                    : "border-transparent hover:border-border hover:bg-muted/50"
                )}
              >
                {(onEdit || onDelete) && (
                  <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs" aria-label={`Options for ${c.name}`}>
                          <MoreVertical className="size-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(c)}>
                            <Pencil className="size-3.5" /> Edit
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(c)}>
                            <Trash2 className="size-3.5" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}

                <button
                  onClick={() => onSelect(c._id)}
                  className="w-full px-2.5 py-2 text-left"
                >
                <div className="flex items-start gap-2">
                  {c.source === "google_maps"
                    ? <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    : <Radar className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}

                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm", active && "font-medium")}>{c.name}</p>

                    {/* The niches disambiguate two runs sharing a name */}
                    {c.search?.niches?.length > 0 && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {c.search.niches.join(", ")}
                        {c.search.locations?.length > 0 && ` · ${c.search.locations.join(", ")}`}
                      </p>
                    )}

                    <div className="mt-1 flex items-center gap-1.5">
                      <Icon className={cn("size-3", meta.tone, spinning && "animate-spin")} />
                      <span className="text-[11px] text-muted-foreground">
                        {pending && !spinning ? "Queued" : meta.label}
                      </span>
                      {target > 0 && (
                        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                          {found}/{target}
                        </span>
                      )}
                    </div>

                    {target > 0 && (
                      <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-border">
                        <div
                          className={cn("h-full rounded-full transition-all",
                            found >= target ? "bg-emerald-500" : "bg-foreground/40")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                </button>
              </div>
            )
          })}

          {campaigns.length === 0 && (
            <button
              onClick={onNew}
              className="rounded-md border border-dashed border-border px-2.5 py-4 text-center text-xs text-muted-foreground hover:text-foreground"
            >
              {newLabel}
            </button>
          )}
        </div>
      </ScrollArea>

      <AlertDialog open={Boolean(confirmDelete)} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{confirmDelete?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              The leads it found are kept, so a business you already contacted can never be
              contacted again by another campaign. Only the search itself is removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete && onDelete) onDelete(confirmDelete)
                setConfirmDelete(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
