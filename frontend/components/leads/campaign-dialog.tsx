"use client"

import { useState } from "react"
import { Loader2, Search, Filter, Target, Send, Info } from "lucide-react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { TagInput } from "./tag-input"
import { leadsApi } from "@/lib/api/leads"
import { useAccounts } from "@/lib/accounts-context"
import type { LeadCampaign } from "@/lib/types"
import { toast } from "sonner"

const NICHE_SUGGESTIONS = [
  "bakery", "restaurant", "salon", "barbershop", "gym", "boutique",
  "photographer", "car wash", "real estate", "catering",
]

/** Sending caps above this are rejected by the backend, so the UI stops here too. */
const DAILY_CAP_MAX = 40

interface CampaignDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (campaign: LeadCampaign) => void
}

export function CampaignDialog({ open, onClose, onCreated }: CampaignDialogProps) {
  const { accounts } = useAccounts()
  const instagram = accounts.find((a) => a.platform === "instagram")

  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState("search")

  const [name, setName] = useState("")
  const [niches, setNiches] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [targetLeadCount, setTargetLeadCount] = useState(100)

  const [requireNoWebsite, setRequireNoWebsite] = useState(true)
  const [requireBusinessAccount, setRequireBusinessAccount] = useState(true)
  const [requireContactInfo, setRequireContactInfo] = useState(false)
  const [excludeVerified, setExcludeVerified] = useState(true)
  const [minFollowers, setMinFollowers] = useState(500)
  const [maxFollowers, setMaxFollowers] = useState(50000)
  const [activeWithinDays, setActiveWithinDays] = useState(60)
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>([])

  const [offerWhat, setOfferWhat] = useState("")
  const [offerPain, setOfferPain] = useState("")
  const [offerProof, setOfferProof] = useState("")
  const [offerCta, setOfferCta] = useState("")
  const [icp, setIcp] = useState("")

  const [autoSend, setAutoSend] = useState(false)
  const [dailyCap, setDailyCap] = useState(20)
  const [windowStart, setWindowStart] = useState(9)
  const [windowEnd, setWindowEnd] = useState(18)
  const [useWarmup, setUseWarmup] = useState(true)

  const canSave = name.trim().length > 0 && niches.length > 0 && Boolean(instagram?.accountId)

  const handleSave = async () => {
    if (!instagram?.accountId) {
      toast.error("Connect an Instagram account in Settings first")
      return
    }
    setSaving(true)
    try {
      const campaign = await leadsApi.createCampaign({
        name: name.trim(),
        platformAccountId: instagram.accountId,
        search: { niches, locations, extraHashtags: [], generatedQueries: [] },
        filters: {
          requireNoWebsite, requireBusinessAccount, requireContactInfo,
          excludeVerified, excludePrivate: true,
          minFollowers, maxFollowers, minPosts: 9,
          activeWithinDays, bioKeywords: [], excludeKeywords,
        },
        targetLeadCount,
        offer: { what: offerWhat, painPoint: offerPain, proof: offerProof, callToAction: offerCta },
        icp,
        messageSettings: {
          autoSend,
          dailyCap: Math.min(dailyCap, DAILY_CAP_MAX),
          sendWindow: { start: windowStart, end: windowEnd },
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          useWarmup,
        },
      })
      toast.success("Campaign created")
      onCreated(campaign)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create campaign")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New lead campaign</DialogTitle>
          <DialogDescription>
            Find businesses on Instagram that match your niche and location, then draft a DM for each one.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="search"><Search className="size-3.5" /> Search</TabsTrigger>
            <TabsTrigger value="filters"><Filter className="size-3.5" /> Filters</TabsTrigger>
            <TabsTrigger value="offer"><Target className="size-3.5" /> Offer</TabsTrigger>
            <TabsTrigger value="sending"><Send className="size-3.5" /> Sending</TabsTrigger>
          </TabsList>

          <ScrollArea className="mt-4 max-h-[52vh] pr-3">
            {/* ── Search ────────────────────────────────────────────────── */}
            <TabsContent value="search" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Campaign name</Label>
                <Input
                  id="campaign-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Lagos bakeries with no website"
                />
              </div>

              <div className="space-y-2">
                <Label>Niches</Label>
                <TagInput
                  value={niches}
                  onChange={setNiches}
                  placeholder="bakery, salon, gym"
                  suggestions={NICHE_SUGGESTIONS}
                />
                <p className="text-xs text-muted-foreground">
                  The kind of business you want to find. One or two works better than ten.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Locations</Label>
                <TagInput value={locations} onChange={setLocations} placeholder="Lagos, Abuja" />
                <p className="text-xs text-muted-foreground">
                  Each niche is combined with each location to build the hashtag searches.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target-count">Stop after finding</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="target-count"
                    type="number"
                    min={10}
                    max={1000}
                    value={targetLeadCount}
                    onChange={(e) => setTargetLeadCount(Number(e.target.value))}
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground">qualifying leads</span>
                </div>
              </div>
            </TabsContent>

            {/* ── Filters ───────────────────────────────────────────────── */}
            <TabsContent value="filters" className="space-y-4">
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="no-website" className="text-sm font-medium">
                      Only businesses with no website
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Rejects anyone with a link in bio, including Linktree and Shopify pages.
                    </p>
                  </div>
                  <Switch id="no-website" checked={requireNoWebsite} onCheckedChange={setRequireNoWebsite} />
                </div>
              </div>

              <div className="grid gap-3">
                {[
                  { id: "biz", label: "Business accounts only", desc: "Skip personal profiles", v: requireBusinessAccount, set: setRequireBusinessAccount },
                  { id: "contact", label: "Must have public contact info", desc: "Email or phone visible on the profile", v: requireContactInfo, set: setRequireContactInfo },
                  { id: "verified", label: "Exclude verified accounts", desc: "Big brands rarely need cold outreach", v: excludeVerified, set: setExcludeVerified },
                ].map((row) => (
                  <div key={row.id} className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <Label htmlFor={row.id} className="text-sm">{row.label}</Label>
                      <p className="text-xs text-muted-foreground">{row.desc}</p>
                    </div>
                    <Switch id={row.id} checked={row.v} onCheckedChange={row.set} />
                  </div>
                ))}
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="min-followers">Min followers</Label>
                  <Input id="min-followers" type="number" min={0} value={minFollowers}
                    onChange={(e) => setMinFollowers(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-followers">Max followers</Label>
                  <Input id="max-followers" type="number" min={0} value={maxFollowers}
                    onChange={(e) => setMaxFollowers(Number(e.target.value))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="active-days">Posted within the last</Label>
                <div className="flex items-center gap-2">
                  <Input id="active-days" type="number" min={0} value={activeWithinDays}
                    onChange={(e) => setActiveWithinDays(Number(e.target.value))} className="w-24" />
                  <span className="text-sm text-muted-foreground">days (0 to ignore)</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Exclude bios containing</Label>
                <TagInput value={excludeKeywords} onChange={setExcludeKeywords}
                  placeholder="agency, marketing, dropship" />
              </div>
            </TabsContent>

            {/* ── Offer ─────────────────────────────────────────────────── */}
            <TabsContent value="offer" className="space-y-4">
              <p className="text-xs text-muted-foreground">
                This is what the AI uses to judge fit and write each DM. The more concrete it is,
                the less generic the messages read.
              </p>

              <div className="space-y-2">
                <Label htmlFor="offer-what">What you sell</Label>
                <Textarea id="offer-what" rows={2} value={offerWhat} onChange={(e) => setOfferWhat(e.target.value)}
                  placeholder="I build simple websites with online ordering for food businesses" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="offer-pain">The problem it solves</Label>
                <Textarea id="offer-pain" rows={2} value={offerPain} onChange={(e) => setOfferPain(e.target.value)}
                  placeholder="No website means orders get lost in DMs and customers cannot order at night" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="offer-proof">Your proof or credibility</Label>
                <Textarea id="offer-proof" rows={2} value={offerProof} onChange={(e) => setOfferProof(e.target.value)}
                  placeholder="Built 12 sites for Lagos food businesses" />
                <p className="text-xs text-muted-foreground">
                  Leave blank if you have none. The AI is told never to invent results.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="offer-cta">What you want them to do</Label>
                <Input id="offer-cta" value={offerCta} onChange={(e) => setOfferCta(e.target.value)}
                  placeholder="Open to a quick look at a demo?" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="icp">Ideal customer (optional)</Label>
                <Textarea id="icp" rows={2} value={icp} onChange={(e) => setIcp(e.target.value)}
                  placeholder="Small food businesses doing steady orders but running everything through DMs" />
              </div>
            </TabsContent>

            {/* ── Sending ───────────────────────────────────────────────── */}
            <TabsContent value="sending" className="space-y-4">
              <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                <Info className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
                <p className="text-muted-foreground">
                  Instagram restricts accounts that DM strangers in bulk. These caps keep you well under
                  the threshold. Raising them raises your risk of a ban, not your reply count.
                </p>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-send" className="text-sm">Send without review</Label>
                  <p className="text-xs text-muted-foreground">
                    Off means drafts wait for your approval. Leave it off until you trust the messages.
                  </p>
                </div>
                <Switch id="auto-send" checked={autoSend} onCheckedChange={setAutoSend} />
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="warmup" className="text-sm">Warm up gradually</Label>
                  <p className="text-xs text-muted-foreground">
                    Starts at 5 DMs a day and ramps to your cap over a week.
                  </p>
                </div>
                <Switch id="warmup" checked={useWarmup} onCheckedChange={setUseWarmup} />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="daily-cap">Daily limit</Label>
                <div className="flex items-center gap-2">
                  <Input id="daily-cap" type="number" min={1} max={DAILY_CAP_MAX} value={dailyCap}
                    onChange={(e) => setDailyCap(Math.min(Number(e.target.value), DAILY_CAP_MAX))}
                    className="w-24" />
                  <span className="text-sm text-muted-foreground">DMs per day (max {DAILY_CAP_MAX})</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Send only between</Label>
                <div className="flex items-center gap-2">
                  <Select value={String(windowStart)} onValueChange={(v) => setWindowStart(Number(v))}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">and</span>
                  <Select value={String(windowEnd)} onValueChange={(v) => setWindowEnd(Number(v))}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Local time. Messages at 3am read as automated.
                </p>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="gap-2">
          {!instagram?.accountId && (
            <p className="mr-auto text-xs text-destructive">
              Connect an Instagram account in Settings first
            </p>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Create campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
