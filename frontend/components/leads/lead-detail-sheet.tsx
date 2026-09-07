"use client"

import { useEffect, useState } from "react"
import {
  ExternalLink, Loader2, RefreshCw, Check, X, Send, Mail, Phone,
  Globe, MapPin, Users, Calendar, AlertTriangle,
} from "lucide-react"
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { leadsApi } from "@/lib/api/leads"
import { LEAD_STATUS_LABEL, type Lead } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const FIT_STYLE: Record<string, string> = {
  strong:      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  moderate:    "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  weak:        "bg-muted text-muted-foreground",
  unqualified: "bg-destructive/10 text-destructive",
}

const formatCount = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(1)}K`
  : String(n)

interface LeadDetailSheetProps {
  lead: Lead | null
  open: boolean
  onClose: () => void
  onUpdated: (lead: Lead) => void
}

export function LeadDetailSheet({ lead, open, onClose, onUpdated }: LeadDetailSheetProps) {
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState<null | "approve" | "skip" | "redraft" | "send">(null)

  // Reset the editor whenever a different lead is opened
  useEffect(() => {
    if (lead) setMessage(lead.approvedMessage || lead.draftMessage || "")
  }, [lead])

  if (!lead) return null

  const isClosed = ["messaged", "replied", "opted_out"].includes(lead.status)

  const run = async (key: typeof busy, fn: () => Promise<Lead>) => {
    setBusy(key)
    try {
      const updated = await fn()
      onUpdated(updated)
      return updated
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
      return null
    } finally {
      setBusy(null)
    }
  }

  const handleApprove = async () => {
    const updated = await run("approve", () => leadsApi.approve(lead._id, message))
    if (updated) { toast.success("Approved. It will send inside your campaign window."); onClose() }
  }

  const handleSkip = async () => {
    const updated = await run("skip", () => leadsApi.skip(lead._id))
    if (updated) { toast.success("Lead skipped"); onClose() }
  }

  const handleRedraft = async () => {
    const updated = await run("redraft", () => leadsApi.redraft(lead._id))
    if (updated) {
      setMessage(updated.draftMessage || "")
      toast.success("New draft ready")
    }
  }

  const handleSendNow = async () => {
    setBusy("send")
    try {
      const res = await leadsApi.sendNow(lead._id, { message })
      onUpdated(res.data.lead)
      if (res.data.result.sent) { toast.success("Message sent"); onClose() }
      else toast.warning(res.message || "Message was not sent")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border p-4">
          <div className="flex items-start gap-3">
            <Avatar className="size-11">
              <AvatarImage src={lead.profilePicUrl} alt={lead.username} />
              <AvatarFallback>{lead.username.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-base">{lead.fullName || lead.username}</SheetTitle>
              <SheetDescription className="truncate">@{lead.username}</SheetDescription>
            </div>
            <Button variant="ghost" size="icon-sm" asChild>
              <a href={lead.profileUrl} target="_blank" rel="noopener noreferrer" aria-label="Open on Instagram">
                <ExternalLink className="size-4" />
              </a>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Badge variant="outline">{LEAD_STATUS_LABEL[lead.status]}</Badge>
            <Badge variant="secondary">Score {lead.score}</Badge>
            {lead.aiFit && (
              <Badge variant="ghost" className={cn("capitalize", FIT_STYLE[lead.aiFit])}>
                {lead.aiFit} fit
              </Badge>
            )}
            {!lead.hasWebsite && (
              <Badge variant="ghost" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                No website
              </Badge>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-4">
            {/* ── Profile facts ─────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { icon: Users, label: "Followers", value: formatCount(lead.followers) },
                { icon: Calendar, label: "Posts", value: formatCount(lead.postsCount) },
                {
                  icon: Globe,
                  label: "Website",
                  value: lead.hasWebsite ? "Yes" : "None",
                },
              ].map((stat) => (
                <div key={stat.label} className="rounded-md border border-border p-2">
                  <stat.icon className="mx-auto size-3.5 text-muted-foreground" />
                  <p className="mt-1 text-sm font-medium">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            {lead.bio && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Bio</Label>
                <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-sm">{lead.bio}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              {lead.category && <span className="flex items-center gap-1"><MapPin className="size-3" />{lead.category}</span>}
              {lead.contact?.email && <span className="flex items-center gap-1"><Mail className="size-3" />{lead.contact.email}</span>}
              {lead.contact?.phone && <span className="flex items-center gap-1"><Phone className="size-3" />{lead.contact.phone}</span>}
              {lead.discoveredVia?.query && <span>Found via {lead.discoveredVia.query}</span>}
            </div>

            {/* ── AI judgement ──────────────────────────────────────────── */}
            {lead.aiReasoning && (
              <div className="space-y-1 rounded-md border border-border p-3">
                <Label className="text-xs text-muted-foreground">Why this lead</Label>
                <p className="text-sm">{lead.aiReasoning}</p>
                {lead.aiAngle && (
                  <p className="pt-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Angle: </span>{lead.aiAngle}
                  </p>
                )}
              </div>
            )}

            {lead.scoreReasons?.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Score breakdown</Label>
                <div className="flex flex-wrap gap-1">
                  {lead.scoreReasons.map((r) => (
                    <Badge key={r} variant="outline" className="font-normal text-[11px]">{r}</Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* ── Reply, if any ─────────────────────────────────────────── */}
            {lead.replyPreview && (
              <div className={cn(
                "space-y-1 rounded-md border p-3",
                lead.status === "opted_out" ? "border-destructive/40 bg-destructive/5" : "border-emerald-500/40 bg-emerald-500/5"
              )}>
                <Label className="flex items-center gap-1.5 text-xs">
                  {lead.status === "opted_out" && <AlertTriangle className="size-3 text-destructive" />}
                  {lead.status === "opted_out" ? "They asked not to be contacted" : "They replied"}
                </Label>
                <p className="text-sm">{lead.replyPreview}</p>
              </div>
            )}

            {/* ── Message editor ────────────────────────────────────────── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="dm-message">
                  {isClosed ? "Message sent" : "Message to send"}
                </Label>
                <span className={cn(
                  "text-xs",
                  message.length > 400 ? "text-amber-600 dark:text-amber-500" : "text-muted-foreground"
                )}>
                  {message.length} chars
                </span>
              </div>
              <Textarea
                id="dm-message"
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isClosed}
                placeholder="No draft yet. Use Regenerate to write one."
              />
              {message.length > 400 && !isClosed && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Over 400 characters. Short DMs get read, long ones get deleted.
                </p>
              )}
            </div>

            {lead.skipReason && (
              <p className="text-xs text-muted-foreground">Skipped: {lead.skipReason}</p>
            )}
            {lead.sendError && (
              <p className="text-xs text-destructive">Last error: {lead.sendError}</p>
            )}
          </div>
        </ScrollArea>

        {/* ── Actions ─────────────────────────────────────────────────── */}
        {!isClosed && (
          <div className="border-t border-border p-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleApprove} disabled={!message.trim() || busy !== null} className="flex-1">
                {busy === "approve" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                Approve
              </Button>
              <Button variant="outline" onClick={handleSendNow} disabled={!message.trim() || busy !== null}>
                {busy === "send" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                Send now
              </Button>
              <Button variant="outline" size="icon" onClick={handleRedraft} disabled={busy !== null}
                aria-label="Regenerate draft">
                {busy === "redraft" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSkip} disabled={busy !== null}
                aria-label="Skip this lead">
                {busy === "skip" ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
              </Button>
            </div>
            <p className="pt-2 text-[11px] text-muted-foreground">
              Approve queues it for the drip. Send now delivers immediately, still inside your daily cap.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
