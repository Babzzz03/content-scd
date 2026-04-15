"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import {
  Plus,
  CalendarDays,
  Lightbulb,
  Mic2,
  TrendingUp,
  Newspaper,
  Clock,
  CheckCircle2,
  FileText,
  ArrowRight,
  PenLine,
  MessageCircleReply,
  Heart,
  Sparkles,
  Activity,
  BookOpen,
} from "lucide-react"
import { XIcon, LinkedInIcon, InstagramIcon } from "@/components/ui/platform-icons"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PostWizard } from "@/components/post-wizard/post-wizard"
import { ReplyComposer } from "@/components/composers/reply-composer"
import { EngageComposer } from "@/components/composers/engage-composer"
import { usePostsContext } from "@/lib/posts-context"
import { useUser } from "@/lib/user-context"
import { DUMMY_PLATFORM_STATS, DUMMY_CONTENT_IDEAS } from "@/lib/dummy-data"
import { cn } from "@/lib/utils"
import type { Platform, ScheduledPost } from "@/lib/types"

// ─── Platform metadata ────────────────────────────────────────────────────────

const PLATFORM_META: Record<
  Platform,
  {
    label: string
    Icon: React.ElementType
    color: string
    bg: string
    border: string
    dot: string
    ring: string
  }
> = {
  x: {
    label: "X (Twitter)",
    Icon: XIcon,
    color: "text-sky-500",
    bg: "bg-sky-50 dark:bg-sky-950/30",
    border: "border-sky-200 dark:border-sky-800",
    dot: "bg-sky-500",
    ring: "ring-sky-200 dark:ring-sky-800",
  },
  linkedin: {
    label: "LinkedIn",
    Icon: LinkedInIcon,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    dot: "bg-blue-600",
    ring: "ring-blue-200 dark:ring-blue-800",
  },
  instagram: {
    label: "Instagram",
    Icon: InstagramIcon,
    color: "text-pink-500",
    bg: "bg-pink-50 dark:bg-pink-950/30",
    border: "border-pink-200 dark:border-pink-800",
    dot: "bg-pink-500",
    ring: "ring-pink-200 dark:ring-pink-800",
  },
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  draft: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  published: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  failed: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
}

// ─── Static data ──────────────────────────────────────────────────────────────

const WEEKLY_DATA = [
  { day: "Mon", x: 2, linkedin: 1, instagram: 3 },
  { day: "Tue", x: 1, linkedin: 2, instagram: 2 },
  { day: "Wed", x: 3, linkedin: 1, instagram: 4 },
  { day: "Thu", x: 2, linkedin: 3, instagram: 2 },
  { day: "Fri", x: 4, linkedin: 2, instagram: 5 },
  { day: "Sat", x: 1, linkedin: 0, instagram: 3 },
  { day: "Sun", x: 0, linkedin: 1, instagram: 2 },
]

const QUICK_ACTIONS = [
  {
    label: "Create Post",
    description: "Compose with AI",
    icon: PenLine,
    href: null as string | null,
    isCreate: true,
    color: "bg-muted text-foreground",
  },
  {
    label: "Content Ideas",
    description: "AI-generated ideas",
    icon: Lightbulb,
    href: "/content-ideas",
    isCreate: false,
    color: "bg-muted text-foreground",
  },
  {
    label: "Post Ideas",
    description: "Ready-to-post drafts",
    icon: Newspaper,
    href: "/post-ideas",
    isCreate: false,
    color: "bg-muted text-foreground",
  },
  {
    label: "Schedule",
    description: "View calendar",
    icon: CalendarDays,
    href: "/schedule",
    isCreate: false,
    color: "bg-muted text-foreground",
  },
  {
    label: "Brand Voice",
    description: "Manage your tone",
    icon: Mic2,
    href: "/brand-voice",
    isCreate: false,
    color: "bg-muted text-foreground",
  },
  {
    label: "Strategy",
    description: "Marketing roadmap",
    icon: TrendingUp,
    href: "/marketing-strategy",
    isCreate: false,
    color: "bg-muted text-foreground",
  },
]

const TIPS = [
  {
    icon: Sparkles,
    title: "Leverage your Brand Voice",
    body: "Posts generated with your brand voice profile tend to resonate more with your audience. Keep it updated regularly.",
    href: "/brand-voice",
    cta: "Update voice",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900/30",
  },
  {
    icon: CalendarDays,
    title: "Best time to post",
    body: "Tuesday–Thursday between 9–11 AM typically delivers the highest organic reach for B2B audiences.",
    href: "/schedule",
    cta: "Open schedule",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30",
  },
  {
    icon: BookOpen,
    title: "How It Works",
    body: "Explore the full PostFlow workflow guide to unlock features you may not be using yet.",
    href: "/how-it-works",
    cta: "Read guide",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30",
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(name: string): string {
  const hour = new Date().getHours()
  const firstName = name.split(" ")[0]
  if (hour < 12) return `Good morning, ${firstName}`
  if (hour < 17) return `Good afternoon, ${firstName}`
  return `Good evening, ${firstName}`
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  if (diff < 0) {
    const pastHours = Math.floor(Math.abs(diff) / (1000 * 60 * 60))
    if (pastHours < 24) return `${pastHours}h ago`
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours < 1) return `in ${mins}m`
  if (hours < 24) return `in ${hours}h`
  const days = Math.floor(hours / 24)
  return `in ${days}d`
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  trend,
}: {
  label: string
  value: string | number
  sub: string
  icon: React.ElementType
  accent: string
  trend?: { value: string; positive: boolean }
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
            <p className="text-2xl font-bold mt-1 leading-none tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>
          </div>
          <div className={cn("flex size-9 items-center justify-center rounded-lg shrink-0 ml-2", accent)}>
            <Icon className="size-4" />
          </div>
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground">
              {trend.positive ? "↑" : "↓"} {trend.value}
            </span>
            <span className="text-[10px] text-muted-foreground">vs last week</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Platform card ────────────────────────────────────────────────────────────

function PlatformCard({ platform }: { platform: Platform }) {
  const meta = PLATFORM_META[platform]
  const stats = DUMMY_PLATFORM_STATS.find((s) => s.platform === platform)!
  const Icon = meta.Icon
  const engagementPct = parseFloat(stats.engagementRate ?? "0")
  const barWidth = Math.min(engagementPct * 12, 100)

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex size-8 items-center justify-center rounded-lg border bg-background shadow-sm">
            <Icon className={cn("size-4", meta.color)} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-none">{meta.label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {stats.publishedThisWeek} posts this week
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div className="rounded-md py-2 bg-muted/50">
            <p className="text-base font-bold leading-none">{stats.scheduledCount}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Scheduled</p>
          </div>
          <div className="rounded-md py-2 bg-muted/50">
            <p className="text-base font-bold leading-none">{stats.draftCount}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Drafts</p>
          </div>
          <div className="rounded-md py-2 bg-muted/50">
            <p className="text-base font-bold leading-none">
              {stats.engagementRate ?? "—"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Engage</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">Engagement rate</span>
            <span className="text-[10px] font-semibold">{stats.engagementRate}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-foreground/20 transition-all duration-500"
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Upcoming posts ───────────────────────────────────────────────────────────

function UpcomingPostsList({
  posts,
  onCreatePost,
}: {
  posts: ScheduledPost[]
  onCreatePost: () => void
}) {
  const upcoming = posts
    .filter((p) => p.status !== "failed")
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
    .slice(0, 6)

  if (upcoming.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <CalendarDays className="size-9 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-semibold">No upcoming posts</p>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          Schedule your first post to see it here
        </p>
        <Button size="sm" variant="outline" onClick={onCreatePost}>
          <Plus className="size-3.5 mr-1.5" />
          Create a post
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {upcoming.map((post) => {
        const meta = PLATFORM_META[post.platform]
        const Icon = meta.Icon
        return (
          <div
            key={post.id}
            className="flex items-start gap-3 rounded-xl border bg-card p-3 hover:bg-accent/40 transition-colors"
          >
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-lg border shrink-0 mt-0.5",
                meta.bg,
                meta.border
              )}
            >
              <Icon className={cn("size-3.5", meta.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs leading-relaxed text-foreground line-clamp-2">
                {post.content}
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    STATUS_STYLES[post.status]
                  )}
                >
                  <Clock className="size-2.5" />
                  {post.status === "published"
                    ? "Published"
                    : formatRelativeTime(post.scheduledAt)}
                </span>
                <Badge variant="outline" className="text-[10px] py-0 h-4 px-1.5 capitalize">
                  {post.postType}
                </Badge>
              </div>
            </div>
            <span className={cn("text-[10px] font-medium shrink-0 mt-1", meta.color)}>
              {meta.label.split(" ")[0]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Weekly activity chart ────────────────────────────────────────────────────

function WeeklyActivityChart() {
  const maxTotal = Math.max(
    ...WEEKLY_DATA.map((d) => d.x + d.linkedin + d.instagram)
  )
  const [todayShort, setTodayShort] = useState("")

  useEffect(() => {
    setTodayShort(
      new Date().toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3)
    )
  }, [])

  const totalThisWeek = WEEKLY_DATA.reduce(
    (acc, d) => acc + d.x + d.linkedin + d.instagram,
    0
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-muted-foreground">
            <span className="text-foreground font-semibold text-sm">{totalThisWeek}</span>{" "}
            total posts this week
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(["x", "linkedin", "instagram"] as Platform[]).map((p) => {
            const meta = PLATFORM_META[p]
            const total = WEEKLY_DATA.reduce((acc, d) => acc + (d[p as "x" | "linkedin" | "instagram"]), 0)
            return (
              <div key={p} className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground hidden sm:inline">
                  {meta.label.split(" ")[0]}
                </span>
                <span className="text-[10px] font-semibold">{total}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-end gap-1.5 sm:gap-2 h-24" suppressHydrationWarning>
        {WEEKLY_DATA.map((d) => {
          const total = d.x + d.linkedin + d.instagram
          const heightPct = maxTotal > 0 ? (total / maxTotal) * 100 : 0
          const isToday = d.day === todayShort

          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex flex-col justify-end" style={{ height: 80 }}>
                <div
                  className={cn(
                    "w-full rounded-sm transition-all duration-300",
                    isToday ? "bg-primary" : "bg-muted-foreground/25"
                  )}
                  style={{ height: `${Math.max(heightPct, 5)}%` }}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] leading-none",
                  isToday ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                )}
              >
                {d.day}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
        <span>Weekly trend</span>
        <span className="font-medium text-foreground">↑ 12% vs last week</span>
      </div>
    </div>
  )
}

// ─── Quick actions grid ───────────────────────────────────────────────────────

function QuickActionsGrid({ onCreatePost }: { onCreatePost: () => void }) {
  const inner = (action: (typeof QUICK_ACTIONS)[0]) => {
    const Icon = action.icon
    return (
      <>
        <div className={cn("flex size-8 items-center justify-center rounded-lg", action.color)}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-none">{action.label}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{action.description}</p>
        </div>
      </>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {QUICK_ACTIONS.map((action) => {
        const sharedClass =
          "flex flex-col items-start gap-2.5 rounded-xl border p-3 hover:bg-accent/60 hover:border-accent transition-all text-left w-full cursor-pointer"

        if (action.isCreate) {
          return (
            <button key={action.label} onClick={onCreatePost} className={sharedClass}>
              {inner(action)}
            </button>
          )
        }
        return (
          <Link key={action.label} href={action.href!} className={cn(sharedClass, "no-underline")}>
            {inner(action)}
          </Link>
        )
      })}
    </div>
  )
}

// ─── Content pipeline ─────────────────────────────────────────────────────────

function ContentPipeline({
  totalScheduled,
  totalDrafts,
}: {
  totalScheduled: number
  totalDrafts: number
}) {
  const items = [
    {
      label: "Content Ideas",
      value: DUMMY_CONTENT_IDEAS.length,
      max: 10,
      color: "bg-primary",
      href: "/content-ideas",
      icon: Lightbulb,
    },
    {
      label: "Scheduled Posts",
      value: Math.min(totalScheduled + 10, 20),
      max: 20,
      color: "bg-primary",
      href: "/schedule",
      icon: Clock,
    },
    {
      label: "Pending Drafts",
      value: Math.min(totalDrafts + 6, 15),
      max: 15,
      color: "bg-primary",
      href: "/schedule",
      icon: FileText,
    },
    {
      label: "Posts Published",
      value: DUMMY_PLATFORM_STATS.reduce((a, s) => a + s.publishedThisWeek, 0),
      max: 25,
      color: "bg-primary",
      href: "/schedule",
      icon: CheckCircle2,
    },
  ]

  return (
    <div className="space-y-3.5">
      {items.map((item) => {
        const Icon = item.icon
        const pct = Math.min((item.value / item.max) * 100, 100)
        return (
          <Link key={item.label} href={item.href} className="block group">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Icon className="size-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                  {item.label}
                </span>
              </div>
              <span className="text-xs font-semibold">{item.value}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", item.color)}
                style={{ width: `${pct}%` }}
              />
            </div>
          </Link>
        )
      })}
    </div>
  )
}

// ─── Pro tips ─────────────────────────────────────────────────────────────────

function ProTips() {
  return (
    <div className="space-y-2.5">
      {TIPS.map((tip) => {
        const Icon = tip.icon
        return (
          <div key={tip.title} className={cn("rounded-xl border p-3.5", tip.bg)}>
            <div className="flex items-start gap-2.5">
              <div className={cn("mt-0.5 shrink-0", tip.color)}>
                <Icon className="size-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold">{tip.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  {tip.body}
                </p>
                <Link
                  href={tip.href}
                  className={cn(
                    "mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold hover:underline",
                    tip.color
                  )}
                >
                  {tip.cta}
                  <ArrowRight className="size-2.5" />
                </Link>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

type OpenDialog =
  | { type: "create"; platform: Platform }
  | { type: "reply"; platform: Platform }
  | { type: "engage"; platform: Platform }
  | null

function DashboardContent() {
  const { scheduledPosts } = usePostsContext()
  const { user } = useUser()
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null)
  const [greeting, setGreeting] = useState("Welcome back")
  const [todayLabel, setTodayLabel] = useState("")

  useEffect(() => {
    setGreeting(getGreeting(user.name))
    setTodayLabel(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    )
  }, [user.name])

  const totalScheduled = scheduledPosts.filter((p) => p.status === "scheduled").length
  const totalDrafts = scheduledPosts.filter((p) => p.status === "draft").length
  const totalPublishedThisWeek = DUMMY_PLATFORM_STATS.reduce(
    (acc, s) => acc + s.publishedThisWeek,
    0
  )
  const avgEngagement = (
    DUMMY_PLATFORM_STATS.reduce(
      (acc, s) => acc + parseFloat(s.engagementRate ?? "0"),
      0
    ) / DUMMY_PLATFORM_STATS.length
  ).toFixed(1) + "%"

  const openCreate = () => setOpenDialog({ type: "create", platform: "x" })
  const closeDialog = () => setOpenDialog(null)

  return (
    <div className="flex flex-col h-full">
      {/* ── Fixed mobile header ── */}
      <div className="sticky top-0 z-10 bg-background border-b px-5 py-3 flex items-center justify-between sm:hidden">
        <div className="min-w-0">
          <p className="text-sm font-bold leading-none truncate" suppressHydrationWarning>
            {greeting} 👋
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5" suppressHydrationWarning>
            {todayLabel || ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <Button variant="outline" size="sm" asChild className="h-8">
            <Link href="/schedule">
              <CalendarDays className="size-3.5" />
            </Link>
          </Button>
          <Button size="sm" onClick={openCreate} className="h-8">
            <Plus className="size-3.5 mr-1" />
            New Post
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-5 sm:p-6 space-y-6 max-w-7xl mx-auto">

          {/* ── Greeting (desktop only) ── */}
          <div className="hidden sm:flex sm:items-center sm:justify-between gap-3">
            <div>
              <h1
                className="text-xl sm:text-2xl font-bold tracking-tight"
                suppressHydrationWarning
              >
                {greeting} 👋
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5" suppressHydrationWarning>
                {todayLabel || "Loading…"} · Here's your content overview
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" asChild>
                <Link href="/schedule">
                  <CalendarDays className="size-3.5 mr-1.5" />
                  Calendar
                </Link>
              </Button>
              <Button size="sm" onClick={openCreate}>
                <Plus className="size-3.5 mr-1.5" />
                New Post
              </Button>
            </div>
          </div>

          {/* ── KPI stats ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-tour="page-dashboard">
            <StatCard
              label="Published This Week"
              value={totalPublishedThisWeek}
              sub="Across all platforms"
              icon={CheckCircle2}
              accent="bg-muted text-muted-foreground"
              trend={{ value: "3", positive: true }}
            />
            <StatCard
              label="Scheduled"
              value={totalScheduled + 10}
              sub="Ready to go live"
              icon={Clock}
              accent="bg-muted text-muted-foreground"
              trend={{ value: "2", positive: true }}
            />
            <StatCard
              label="Drafts"
              value={totalDrafts + 6}
              sub="Awaiting review"
              icon={FileText}
              accent="bg-muted text-muted-foreground"
            />
            <StatCard
              label="Avg. Engagement"
              value={avgEngagement}
              sub="All-platform average"
              icon={Activity}
              accent="bg-muted text-muted-foreground"
              trend={{ value: "0.8%", positive: true }}
            />
          </div>

          {/* ── Platform performance ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Platform Performance</h2>
              <Link
                href="/schedule"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                View all analytics
                <ArrowRight className="size-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <PlatformCard platform="x" />
              <PlatformCard platform="linkedin" />
              <PlatformCard platform="instagram" />
            </div>
          </div>

          {/* ── Main two-column grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Left — upcoming posts + weekly chart */}
            <div className="lg:col-span-3 space-y-5">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">Upcoming Posts</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Next scheduled & drafted content across all platforms
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                      <Link href="/schedule">
                        View all
                        <ArrowRight className="size-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <UpcomingPostsList posts={scheduledPosts} onCreatePost={openCreate} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Weekly Activity</CardTitle>
                  <CardDescription className="text-xs">
                    Posts published per day — stacked by platform
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <WeeklyActivityChart />
                </CardContent>
              </Card>
            </div>

            {/* Right — quick actions + pipeline + tips */}
            <div className="lg:col-span-2 space-y-4">

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <QuickActionsGrid onCreatePost={openCreate} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Content Pipeline</CardTitle>
                  <CardDescription className="text-xs">
                    Health of your content at a glance
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ContentPipeline
                    totalScheduled={totalScheduled}
                    totalDrafts={totalDrafts}
                  />
                </CardContent>
              </Card>

              {/* <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-violet-500" />
                    Pro Tips
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ProTips />
                </CardContent>
              </Card> */}

            </div>
          </div>

        </div>
      </ScrollArea>

      {/* Dialogs */}
      {openDialog?.type === "create" && (
        <PostWizard platform={openDialog.platform} open onClose={closeDialog} />
      )}
      {openDialog?.type === "reply" && (
        <ReplyComposer platform={openDialog.platform} open onClose={closeDialog} />
      )}
      {openDialog?.type === "engage" && (
        <EngageComposer platform={openDialog.platform} open onClose={closeDialog} />
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <DashboardContent />
    </Suspense>
  )
}
