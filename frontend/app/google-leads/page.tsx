"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Plus, Search, Loader2, Download, MapPin, Phone, Check,
  AlertTriangle, Building2, Star,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { TagInput } from "@/components/leads/tag-input"
import { CallCard } from "@/components/google-leads/call-card"
import { CampaignList } from "@/components/leads/campaign-list"
import { leadsApi } from "@/lib/api/leads"
import type { Lead, LeadCampaign, LeadStats, LeadStatus } from "@/lib/types"
import { toast } from "sonner"

const TABS: { value: string; label: string; statuses?: LeadStatus[] }[] = [
  { value: "to_call",   label: "To call",     statuses: ["to_call"] },
  { value: "callback",  label: "Call back",   statuses: ["callback"] },
  { value: "contacted", label: "Contacted",   statuses: ["contacted", "won", "lost"] },
  // Businesses we checked that already have a website. Kept because the work
  // of finding them is done, and they may still be worth a call.
  { value: "has_site",  label: "Has website", statuses: ["skipped"] },
  { value: "all",       label: "All" },
]

const NICHES = ["bakery", "hotel", "restaurant", "salon", "gym", "guest house", "car wash", "boutique"]

export default function GoogleLeadsPage() {
  const [campaigns, setCampaigns] = useState<LeadCampaign[]>([])
  const [activeCampaign, setActiveCampaign] = useState("")
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<LeadStats | null>(null)
  const [tab, setTab] = useState("to_call")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<LeadCampaign | null>(null)

  // New-campaign form
  const [name, setName] = useState("")
  const [niches, setNiches] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [target, setTarget] = useState(40)
  const [requirePhone, setRequirePhone] = useState(true)
  const [offerWhat, setOfferWhat] = useState("")
  const [offerPain, setOfferPain] = useState("")
  const [offerCta, setOfferCta] = useState("")
  const [saving, setSaving] = useState(false)

  const campaign = campaigns.find((c) => c._id === activeCampaign)

  const loadCampaigns = useCallback(async () => {
    try {
      const google = await leadsApi.listCampaigns("google_maps")
      setCampaigns(google)
      setActiveCampaign((prev) => prev || google[0]?._id || "")
      return google
    } catch {
      return []
    }
  }, [])

  const loadLeads = useCallback(async () => {
    if (!activeCampaign) { setLeads([]); setStats(null); return }
    setLoading(true)
    try {
      const activeTab = TABS.find((t) => t.value === tab)
      const [res, s] = await Promise.all([
        leadsApi.listLeads({
          campaign: activeCampaign,
          status: activeTab?.statuses,
          search: search || undefined,
          sort: "score",
          limit: 100,
        }),
        leadsApi.getStats(activeCampaign),
      ])
      setLeads(res.leads)
      setStats(s)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load leads")
    } finally {
      setLoading(false)
    }
  }, [activeCampaign, tab, search])

  useEffect(() => { loadCampaigns().finally(() => setLoading(false)) }, [loadCampaigns])
  useEffect(() => { loadLeads() }, [loadLeads])

  // Keep polling between batches too. A queued continuation is still work in
  // progress, and stopping here made the count freeze on the last batch.
  const continuationPending = Boolean(
    campaign?.continuesAt && new Date(campaign.continuesAt).getTime() > Date.now()
  )
  const working = campaign?.status === "discovering" || continuationPending

  useEffect(() => {
    if (!working) return
    const t = setInterval(async () => {
      const list = await loadCampaigns()
      const fresh = list.find((c) => c._id === activeCampaign)
      const stillGoing = fresh?.status === "discovering" ||
        (fresh?.continuesAt && new Date(fresh.continuesAt).getTime() > Date.now())
      if (!stillGoing) loadLeads()
      else loadLeads()
    }, 4000)
    return () => clearInterval(t)
  }, [working, activeCampaign, loadCampaigns, loadLeads])

  // Live countdown to the next batch
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!continuationPending) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [continuationPending])

  const secondsToNextBatch = campaign?.continuesAt
    ? Math.max(0, Math.round((new Date(campaign.continuesAt).getTime() - now) / 1000))
    : 0

  const handleCreate = async () => {
    if (!name.trim() || !niches.length) return
    setSaving(true)
    try {
      const created = await leadsApi.createCampaign({
        name: name.trim(),
        source: "google_maps",
        search: { niches, locations, extraHashtags: [], generatedQueries: [] },
        filters: { requireNoWebsite: true, requireContactInfo: requirePhone } as never,
        targetLeadCount: target,
        offer: { what: offerWhat, painPoint: offerPain, proof: "", callToAction: offerCta },
      } as Partial<LeadCampaign>)
      setCampaigns((p) => [created, ...p])
      setActiveCampaign(created._id)
      setDialogOpen(false)
      toast.success("Campaign created")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create campaign")
    } finally {
      setSaving(false)
    }
  }

  const handleSearch = async () => {
    if (!campaign) return
    setBusy(true)
    try {
      const res = await leadsApi.startDiscovery(campaign._id)
      toast.success(res.message || "Searching Google Maps")
      await loadCampaigns()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the search")
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteCampaign = async (c: LeadCampaign) => {
    try {
      await leadsApi.deleteCampaign(c._id)
      setCampaigns((prev) => prev.filter((x) => x._id !== c._id))
      if (activeCampaign === c._id) setActiveCampaign("")
      toast.success("Campaign deleted. Its leads were kept.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete")
    }
  }

  const handleExport = async () => {
    try {
      const blob = await leadsApi.downloadCsv({ campaign: activeCampaign })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `call-list-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error("Export failed") }
  }

  const cards = useMemo(() => [
    { icon: Building2, label: "Businesses", value: stats?.total ?? 0 },
    { icon: Phone,     label: "To call",    value: stats?.counts.to_call ?? 0 },
    { icon: Check,     label: "Interested", value: stats?.counts.won ?? 0 },
    { icon: Star,      label: "Contacted",  value: (stats?.counts.contacted ?? 0) + (stats?.counts.won ?? 0) + (stats?.counts.lost ?? 0) },
  ], [stats])

  const dialog = (
    <Dialog open={dialogOpen} onOpenChange={(v) => !v && setDialogOpen(false)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Google Maps search</DialogTitle>
          <DialogDescription>
            Finds local businesses with no website, and gives you their phone number.
            Nothing is sent automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="g-name">Campaign name</Label>
            <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ikeja bakeries with no website" />
          </div>
          <div className="space-y-2">
            <Label>Business types</Label>
            <TagInput value={niches} onChange={setNiches} placeholder="bakery, hotel" suggestions={NICHES} />
          </div>
          <div className="space-y-2">
            <Label>Areas</Label>
            <TagInput value={locations} onChange={setLocations} placeholder="Ikeja, Lagos" />
            <p className="text-xs text-muted-foreground">
              Each business type is searched in each area, the way you would type it into Maps.
            </p>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="g-phone" className="text-sm">Only keep businesses with a phone number</Label>
              <p className="text-xs text-muted-foreground">A call list is useless without one.</p>
            </div>
            <Switch id="g-phone" checked={requirePhone} onCheckedChange={setRequirePhone} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="g-target">Stop after</Label>
            <div className="flex items-center gap-2">
              <Input id="g-target" type="number" min={5} max={200} value={target}
                onChange={(e) => setTarget(Number(e.target.value))} className="w-24" />
              <span className="text-sm text-muted-foreground">businesses</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="g-offer">What you sell</Label>
            <Textarea id="g-offer" rows={2} value={offerWhat} onChange={(e) => setOfferWhat(e.target.value)}
              placeholder="I build simple websites with online ordering for small businesses" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="g-pain">The problem it solves</Label>
            <Textarea id="g-pain" rows={2} value={offerPain} onChange={(e) => setOfferPain(e.target.value)}
              placeholder="Customers find them on Google but cannot order, so they go elsewhere" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="g-cta">What you want them to do</Label>
            <Input id="g-cta" value={offerCta} onChange={(e) => setOfferCta(e.target.value)}
              placeholder="a 10 minute look at a demo" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving || !name.trim() || !niches.length}>
            {saving && <Loader2 className="size-3.5 animate-spin" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  if (!loading && campaigns.length === 0) {
    return (
      <>
        <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-24 text-center">
          <div className="rounded-full bg-muted p-4"><MapPin className="size-7 text-muted-foreground" /></div>
          <h1 className="mt-4 text-lg font-semibold">Find local businesses to call</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Searches Google Maps for businesses in your area that have no website, and gives you
            their phone number, rating and an opening line. You make the call.
          </p>
          <Button className="mt-5" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" /> New search
          </Button>
        </div>
        {dialog}
      </>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">Google Lead Generator</h1>
          <p className="text-sm text-muted-foreground">
            Local businesses with no website, ready to call. Nothing is sent automatically.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-3.5" /> New search
        </Button>
      </div>

      {/* Searches on the left so every run stays visible and comparable */}
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <CampaignList
          campaigns={campaigns}
          activeId={activeCampaign}
          onSelect={setActiveCampaign}
          onNew={() => { setEditingCampaign(null); setDialogOpen(true) }}
          onEdit={(c) => { setEditingCampaign(c); setDialogOpen(true) }}
          onDelete={handleDeleteCampaign}
          newLabel="Create your first search"
        />

        <div className="min-w-0 space-y-4">

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          {campaign && (
            <>
              <span className="truncate text-sm font-medium">{campaign.name}</span>
              <Badge variant="outline" className="capitalize">
                {working ? "Working" : campaign.status}
              </Badge>
              <div className="ml-auto flex gap-1.5">
                <Button size="sm" onClick={handleSearch} disabled={busy || working}>
                  {working ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                  {working ? "Searching" : "Find businesses"}
                </Button>
                <Button variant="outline" size="icon-sm" onClick={handleExport} aria-label="Export CSV">
                  <Download className="size-3.5" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {campaign?.progress && campaign.progress.phase !== "idle" &&
        !(campaign.status === "paused" && !working) && (
        <Card>
          <CardContent className="space-y-2 p-3">
            <div className="flex items-center gap-2">
              {/* Trust the campaign status, not the phase. A phase left over
                  from an interrupted run kept the spinner going for days. */}
              {working
                ? <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                : campaign.progress.phase === "error"
                  ? <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
                  : <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
              <span className="text-sm font-medium">{campaign.progress.message || campaign.progress.phase}</span>
              {campaign.progress.total > 0 && (
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {campaign.progress.current} / {campaign.progress.total}
                </span>
              )}
            </div>
            {campaign.progress.total > 0 && (
              <Progress value={Math.min(100, (campaign.progress.current / campaign.progress.total) * 100)} className="h-1.5" />
            )}
            {campaign.progress.detail && (
              <p className="text-xs text-muted-foreground">{campaign.progress.detail}</p>
            )}
            {continuationPending && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Next batch in {Math.floor(secondsToNextBatch / 60)}:
                {String(secondsToNextBatch % 60).padStart(2, "0")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-3">
              <c.icon className="size-3.5 text-muted-foreground" />
              <p className="mt-1.5 text-xl font-semibold tabular-nums">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onValueChange={setTab} className="flex-1">
          <TabsList>
            {TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search" className="w-44 pl-7" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : leads.length === 0 ? (
        <Card><CardContent className="p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {campaign?.status === "discovering"
              ? "Searching Google Maps. Businesses will appear here as they are found."
              : "No businesses in this list yet. Run Find businesses."}
          </p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => (
            <CallCard
              key={lead._id}
              lead={lead}
              onUpdated={(u) => setLeads((prev) => prev.map((l) => (l._id === u._id ? u : l)))}
            />
          ))}
        </div>
      )}

        </div>
      </div>

      {dialog}
    </div>
  )
}
