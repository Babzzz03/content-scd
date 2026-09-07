"use client"

import { useState } from "react"
import {
  Phone, MessageCircle, Star, MapPin, Globe, Loader2, Sparkles,
  Check, X, Clock, PhoneOff, ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { leadsApi } from "@/lib/api/leads"
import { CALL_OUTCOME_LABEL, type CallOutcome, type Lead } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const OUTCOME_ICON: Record<CallOutcome, typeof Check> = {
  interested:     Check,
  callback:       Clock,
  not_interested: X,
  no_answer:      PhoneOff,
  wrong_number:   PhoneOff,
}

/** Strip spaces and local-zero so tel:/wa.me links work. */
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`
const waHref = (phone: string) => {
  let digits = phone.replace(/[^\d]/g, "")
  // Nigerian local format 0803... becomes 234803...
  if (digits.startsWith("0")) digits = `234${digits.slice(1)}`
  return `https://wa.me/${digits}`
}

const scoreTone = (s: number) =>
  s >= 70 ? "text-emerald-600 dark:text-emerald-400"
  : s >= 40 ? "text-amber-600 dark:text-amber-500"
  : "text-muted-foreground"

interface CallCardProps {
  lead: Lead
  onUpdated: (lead: Lead) => void
}

export function CallCard({ lead, onUpdated }: CallCardProps) {
  const [script, setScript] = useState(lead.callScript || "")
  const [notes, setNotes] = useState(lead.notes || "")
  const [busy, setBusy] = useState<null | "script" | "outcome">(null)
  const [open, setOpen] = useState(false)

  const phone = lead.google?.phone || lead.contact?.phone || ""
  const done = ["won", "lost", "contacted"].includes(lead.status)

  const handleScript = async (channel: "call" | "whatsapp") => {
    setBusy("script")
    try {
      const res = await leadsApi.generateScript(lead._id, channel)
      setScript(res.script)
      setNotes(res.objection ? `Likely objection: ${res.objection}` : notes)
      onUpdated(res.lead)
      setOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not write a script")
    } finally {
      setBusy(null)
    }
  }

  const handleOutcome = async (outcome: CallOutcome) => {
    setBusy("outcome")
    try {
      const updated = await leadsApi.recordOutcome(lead._id, { outcome, notes })
      onUpdated(updated)
      toast.success(CALL_OUTCOME_LABEL[outcome])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save")
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className={cn(done && "opacity-60")}>
      <CardContent className="space-y-3 p-3">
        {/* ── Business ────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{lead.fullName}</span>
              {lead.google?.mapsUri && (
                <a href={lead.google.mapsUri} target="_blank" rel="noopener noreferrer"
                   className="shrink-0 text-muted-foreground hover:text-foreground"
                   aria-label="Open in Google Maps">
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {lead.category && <span>{lead.category}</span>}
              {(lead.google?.reviewCount ?? 0) > 0 && (
                <span className="flex items-center gap-0.5">
                  <Star className="size-3 fill-current" />
                  {lead.google?.rating} ({lead.google?.reviewCount})
                </span>
              )}
              {lead.hasWebsite ? (
                <a
                  href={lead.externalLink || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Globe className="size-3" />
                  <span className="max-w-40 truncate">
                    {(lead.externalLink || "").replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </span>
                </a>
              ) : (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Globe className="size-3" /> No website
                </span>
              )}
            </div>

            {lead.google?.formattedAddress && (
              <p className="mt-1 flex items-start gap-1 text-[11px] text-muted-foreground">
                <MapPin className="mt-0.5 size-3 shrink-0" />
                <span className="line-clamp-1">{lead.google.formattedAddress}</span>
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className={cn("text-sm font-semibold tabular-nums", scoreTone(lead.score))}>
              {lead.score}
            </span>
            {lead.callOutcome ? (
              <Badge variant="ghost" className="text-[10px]">
                {CALL_OUTCOME_LABEL[lead.callOutcome]}
              </Badge>
            ) : lead.status === "skipped" && lead.skipReason ? (
              <Badge variant="outline" className="text-[10px] font-normal">
                {lead.skipReason}
              </Badge>
            ) : null}
          </div>
        </div>

        {/* ── Contact actions ─────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1.5">
          {phone ? (
            <>
              <Button size="sm" asChild>
                <a href={telHref(phone)}><Phone className="size-3.5" /> {phone}</a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={waHref(phone)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-3.5" /> WhatsApp
                </a>
              </Button>
            </>
          ) : (
            <Badge variant="outline" className="text-[11px]">No phone listed</Badge>
          )}

          <Button variant="ghost" size="sm" onClick={() => handleScript("call")} disabled={busy !== null}>
            {busy === "script"
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Sparkles className="size-3.5" />}
            {script ? "Rewrite" : "Write opener"}
          </Button>
        </div>

        {/* ── Script ──────────────────────────────────────────────────── */}
        {script && (
          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-2.5">
            <p className="text-sm leading-relaxed">{script}</p>
            <button
              onClick={() => { navigator.clipboard.writeText(script); toast.success("Copied") }}
              className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            >
              Copy
            </button>
          </div>
        )}

        {/* ── Outcome ─────────────────────────────────────────────────── */}
        {open || script ? (
          <div className="space-y-2">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes from the call"
              className="text-xs"
            />
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(CALL_OUTCOME_LABEL) as CallOutcome[]).map((o) => {
                const Icon = OUTCOME_ICON[o]
                return (
                  <Button
                    key={o}
                    variant={lead.callOutcome === o ? "default" : "outline"}
                    size="xs"
                    onClick={() => handleOutcome(o)}
                    disabled={busy !== null}
                  >
                    <Icon className="size-3" /> {CALL_OUTCOME_LABEL[o]}
                  </Button>
                )
              })}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
