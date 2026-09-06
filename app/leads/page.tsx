"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Plus, Search, Loader2, RefreshCw, Download, Play, Pause,
  Check, X, Inbox, Users, MessageSquare, AlertTriangle, Radar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { CampaignDialog } from "@/components/leads/campaign-dialog"
import { LeadDetailSheet } from "@/components/leads/lead-detail-sheet"
import { LeadRow } from "@/components/leads/lead-row"
import { leadsApi, type ListLeadsParams } from "@/lib/api/leads"
import type { Lead, LeadCampaign, LeadStats, LeadStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

/** Review queue first — that is where the work is. */
const STATUS_TABS: { value: string; label: string; statuses?: LeadStatus[] }[] = [
  // Anything awaiting a human decision, not just finished drafts. Leads sit in
  // "enriched" until the drafting job runs, and showing only "drafted" made
  // freshly found leads invisible in the default tab.
  { value: "review",   label: "To review", statuses: ["drafted", "qualified", "enriched"] },
  { value: "approved", label: "Approved",  statuses: ["approved", "queued"] },
  { value: "sent",     label: "Sent",      statuses: ["messaged"] },
  { value: "replied",  label: "Replied",   statuses: ["replied"] },
  { value: "all",      label: "All" },
]

export default function LeadsPage() {
  const [campaigns, setCampaigns] = useState<LeadCampaign[]>([])
  const [activeCampaign, setActiveCampaign] = useState<string>("")
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<LeadStats | null>(null)

  const [tab, setTab] = useState("review")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<ListLeadsParams["sort"]>("score")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailLead, setDetailLead] = useState<Lead | null>(null)

  const campaign = campaigns.find((c) => c._id === activeCampaign)

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadCampaigns = useCallback(async () => {
    try {
      const list = await leadsApi.listCampaigns()
      setCampaigns(list)
      setActiveCampaign((prev) => prev || list[0]?._id || "")
      return list
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load campaigns")
      return []
    }
  }, [])

  const loadLeads = useCallback(async () => {
    if (!activeCampaign) { setLeads([]); setStats(null); return }
    setLoading(true)
    try {
      const activeTab = STATUS_TABS.find((t) => t.value === tab)
      const [res, statsRes] = await Promise.all([
        leadsApi.listLeads({
          campaign: activeCampaign,
          status: activeTab?.statuses,
          search: search || undefined,
          sort,
          limit: 100,
        }),
        leadsApi.getStats(activeCampaign),
      ])
      setLeads(res.leads)
      setStats(statsRes)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load leads")
    } finally {
      setLoading(false)
    }
  }, [activeCampaign, tab, search, sort])

  useEffect(() => { loadCampaigns().finally(() => setLoading(false)) }, [loadCampaigns])
  useEffect(() => { loadLeads() }, [loadLeads])
  useEffect(() => { setSelected(new Set()) }, [tab, activeCampaign])

  // Discovery runs in the background, so poll while it is going
  useEffect(() => {
    if (campaign?.status !== "discovering") return
    // 3s rather than 15s: the progress bar is the only signal that a
    // multi-minute run is alive, so it needs to visibly move.
    const timer = setInterval(async () => {
      const list = await loadCampaigns()
      const fresh = list.find((c) => c._id === activeCampaign)
      if (fresh && fresh.status !== "discovering") loadLeads()
    }, 3000)
    return () => clearInterval(timer)
  }, [campaign?.status, activeCampaign, loadCampaigns, loadLeads])

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleDiscover = async () => {
    if (!campaign) return
    setBusy(true)
    try {
      const res = await leadsApi.startDiscovery(campaign._id)
      toast.success(res.message || "Discovery started")
      await loadCampaigns()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start discovery")
    } finally {
      setBusy(false)
    }
  }

  const handleTogglePause = async () => {
    if (!campaign) return
    setBusy(true)
    try {
      if (campaign.status === "paused") await leadsApi.resumeCampaign(campaign._id)
      else await leadsApi.pauseCampaign(campaign._id)
      await loadCampaigns()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change campaign state")
    } finally {
      setBusy(false)
    }
  }

  const handleSyncReplies = async () => {
    if (!campaign) return
    setBusy(true)
    try {
      await leadsApi.syncReplies(campaign._id)
      toast.success("Checking your inbox. Replies will appear shortly.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not check replies")
    } finally {
      setBusy(false)
    }
  }

  const handleBulk = async (action: "approve" | "skip") => {
    if (!selected.size) return
    setBusy(true)
    try {
      const res = await leadsApi.bulk([...selected], action)
      toast.success(res.message)
      setSelected(new Set())
      await loadLeads()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk action failed")
    } finally {
      setBusy(false)
    }
  }

  const handleExport = async () => {
    try {
      const blob = await leadsApi.downloadCsv({ campaign: activeCampaign })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `leads-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Export failed")
    }
  }

  const handleLeadUpdated = (updated: Lead) => {
    setLeads((prev) => prev.map((l) => (l._id === updated._id ? updated : l)))
    setDetailLead(updated)
    loadLeads()
  }

  const allSelected = leads.length > 0 && selected.size === leads.length

  const statCards = useMemo(() => [
    { icon: Users,         label: "Leads found",    value: stats?.total ?? 0 },
    { icon: Inbox,         label: "To review",      value: stats?.awaitingReview ?? 0 },
    { icon: MessageSquare, label: "Messaged",       value: stats?.counts.messaged ?? 0 },
    { icon: Radar,         label: "Reply rate",     value: `${stats?.replyRate ?? 0}%` },
  ], [stats])

  // ── Empty state ────────────────────────────────────────────────────────────

  if (!loading && campaigns.length === 0) {
    return (
      <>
        <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-24 text-center">
          <div className="rounded-full bg-muted p-4">
            <Radar className="size-7 text-muted-foreground" />
          </div>
          <h1 className="mt-4 text-lg font-semibold">Find your first leads</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Search Instagram for businesses in a niche and location, filter to the ones with no
            website, and let AI draft a DM for each. You approve before anything sends.
          </p>
          <Button className="mt-5" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" /> New campaign
          </Button>
        </div>
        <CampaignDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onCreated={(c) => { setCampaigns((p) => [c, ...p]); setActiveCampaign(c._id) }}
        />
      </>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">Lead Generator</h1>
          <p className="text-sm text-muted-foreground">
            Businesses that match your niche, with AI-drafted DMs waiting for your approval.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-3.5" /> New campaign
        </Button>
      </div>

      {/* ── Campaign bar ───────────────────────────────────────────────── */}
      {campaigns.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <Select value={activeCampaign} onValueChange={setActiveCampaign}>
              <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Select campaign" /></SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {campaign && (
              <>
                <Badge variant="outline" className="capitalize">{campaign.status}</Badge>
                {campaign.sendState && (
                  <Badge variant="ghost" className="text-muted-foreground">
                    {campaign.sendState.sentToday}/{campaign.sendState.capToday} sent today
                  </Badge>
                )}

                <div className="ml-auto flex flex-wrap gap-1.5">
                  <Button size="sm" onClick={handleDiscover}
                    disabled={busy || campaign.status === "discovering"}>
                    {campaign.status === "discovering"
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : <Search className="size-3.5" />}
                    {campaign.status === "discovering" ? "Finding leads" : "Find leads"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleTogglePause} disabled={busy}>
                    {campaign.status === "paused" ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
                    {campaign.status === "paused" ? "Resume" : "Pause"}
                  </Button>
                  <Button variant="outline" size="icon-sm" onClick={handleSyncReplies} disabled={busy}
                    aria-label="Check for replies">
                    <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
                  </Button>
                  <Button variant="outline" size="icon-sm" onClick={handleExport} aria-label="Export CSV">
                    <Download className="size-3.5" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Live discovery progress ────────────────────────────────────── */}
      {campaign?.progress && campaign.progress.phase !== "idle" && (
        <Card>
          <CardContent className="space-y-2 p-3">
            <div className="flex items-center gap-2">
              {["planning", "collecting", "enriching", "saving", "drafting"].includes(campaign.progress.phase) ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : campaign.progress.phase === "error" ? (
                <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
              ) : (
                <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              )}
              <span className="text-sm font-medium">
                {campaign.progress.message || campaign.progress.phase}
              </span>
              {campaign.progress.total > 0 && (
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {campaign.progress.current} / {campaign.progress.total}
                </span>
              )}
            </div>

            {campaign.progress.total > 0 && (
              <Progress
                value={Math.min(100, (campaign.progress.current / campaign.progress.total) * 100)}
                className="h-1.5"
              />
            )}

            {campaign.progress.detail && (
              <p className="truncate text-xs text-muted-foreground">{campaign.progress.detail}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Why nothing is sending ─────────────────────────────────────── */}
      {campaign?.sendState && !campaign.sendState.allowed && campaign.sendState.reason && (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>Not sending right now: {campaign.sendState.reason}</span>
        </div>
      )}
      {campaign?.lastError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{campaign.lastError}</span>
        </div>
      )}

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3">
              <s.icon className="size-3.5 text-muted-foreground" />
              <p className="mt-1.5 text-xl font-semibold tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onValueChange={setTab} className="flex-1">
          <TabsList>
            {STATUS_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads"
            className="w-44 pl-7"
          />
        </div>

        <Select value={sort} onValueChange={(v) => setSort(v as ListLeadsParams["sort"])}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Best score</SelectItem>
            <SelectItem value="followers">Most followers</SelectItem>
            <SelectItem value="recent">Newest</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Bulk bar ───────────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/60 p-2">
          <span className="text-sm">{selected.size} selected</span>
          <div className="ml-auto flex gap-1.5">
            <Button size="sm" onClick={() => handleBulk("approve")} disabled={busy}>
              <Check className="size-3.5" /> Approve
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulk("skip")} disabled={busy}>
              <X className="size-3.5" /> Skip
            </Button>
          </div>
        </div>
      )}

      {/* ── List ───────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden p-0">
        {leads.length > 0 && (
          <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-3 py-2">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(v) =>
                setSelected(v ? new Set(leads.map((l) => l._id)) : new Set())
              }
              aria-label="Select all leads"
            />
            <span className="text-xs text-muted-foreground">
              {leads.length} lead{leads.length === 1 ? "" : "s"}
            </span>
          </div>
        )}

        {loading ? (
          <div className="space-y-3 p-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-64" />
                </div>
              </div>
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {campaign?.status === "discovering"
                ? "Searching Instagram. Leads will appear here as they are found."
                : tab === "review"
                  ? "Nothing waiting for review. Run Find leads to get more."
                  : "No leads match this filter."}
            </p>
          </div>
        ) : (
          leads.map((lead) => (
            <LeadRow
              key={lead._id}
              lead={lead}
              selected={selected.has(lead._id)}
              onSelect={(checked) =>
                setSelected((prev) => {
                  const next = new Set(prev)
                  if (checked) next.add(lead._id)
                  else next.delete(lead._id)
                  return next
                })
              }
              onOpen={() => setDetailLead(lead)}
            />
          ))
        )}
      </Card>

      <CampaignDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(c) => { setCampaigns((p) => [c, ...p]); setActiveCampaign(c._id) }}
      />

      <LeadDetailSheet
        lead={detailLead}
        open={Boolean(detailLead)}
        onClose={() => setDetailLead(null)}
        onUpdated={handleLeadUpdated}
      />
    </div>
  )
}
