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
  PenLine,
  ChevronRight,
  BookOpen,
  Zap,
  ArrowRight,
  CheckCircle2,
  FileText,
} from "lucide-react"
import { XIcon, LinkedInIcon, InstagramIcon } from "@/components/ui/platform-icons"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PostWizard } from "@/components/post-wizard/post-wizard"
import { usePostsContext } from "@/lib/posts-context"
import { useUser } from "@/lib/user-context"
import { DUMMY_PLATFORM_STATS } from "@/lib/dummy-data"
import { cn } from "@/lib/utils"
import type { Platform, ScheduledPost } from "@/lib/types"

// ─── Platform config ──────────────────────────────────────────────────────────

const PLATFORMS: {
  id: Platform
  label: string
  tagline: string
  Icon: React.ElementType
  href: string
  color: string
  iconBg: string
  border: string
}[] = [
  {
    id: "x",
    label: "X (Twitter)",
    tagline: "Threads, replies & campaigns",
    Icon: XIcon,
    href: "/x",
    color: "text-sky-500",
    iconBg: "bg-sky-50 dark:bg-sky-950/40",
    border: "border-sky-200 dark:border-sky-800",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    tagline: "Professional posts & carousels",
    Icon: LinkedInIcon,
    href: "/linkedin",
    color: "text-blue-600",
    iconBg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
  },
  {
    id: "instagram",
    label: "Instagram",
    tagline: "Visuals, reels & stories",
    Icon: InstagramIcon,
    href: "/instagram",
    color: "text-pink-500",
    iconBg: "bg-pink-50 dark:bg-pink-950/40",
    border: "border-pink-200 dark:border-pink-800",
  },
]

// ─── Feature tools ────────────────────────────────────────────────────────────

const TOOLS: {
  label: string
  desc: string
  icon: React.ElementType
  href: string | null
  isCreate?: boolean
  iconColor: string
  iconBg: string
}[] = [
  {
    label: "Create Post",
    desc: "AI-powered post wizard",
    icon: PenLine,
    href: null,
    isCreate: true,
    iconColor: "text-primary",
    iconBg: "bg-primary/10",
  },
  {
    label: "Content Ideas",
    desc: "Video & reel concepts",
    icon: Lightbulb,
    href: "/content-ideas",
    iconColor: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-50 dark:bg-amber-950/40",
  },
  {
    label: "Post Ideas",
    desc: "Ready-to-post drafts",
    icon: Newspaper,
    href: "/post-ideas",
    iconColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-50 dark:bg-blue-950/40",
  },
  {
    label: "Brand Voice",
    desc: "Your tone & identity",
    icon: Mic2,
    href: "/brand-voice",
    iconColor: "text-violet-600 dark:text-violet-400",
    iconBg: "bg-violet-50 dark:bg-violet-950/40",
  },
  {
    label: "Schedule",
    desc: "Content calendar",
    icon: CalendarDays,
    href: "/schedule",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
  },
  {
    label: "Strategy",
    desc: "AI marketing plan",
    icon: TrendingUp,
    href: "/marketing-strategy",
    iconColor: "text-rose-600 dark:text-rose-400",
    iconBg: "bg-rose-50 dark:bg-rose-950/40",
  },
  {
    label: "How It Works",
    desc: "Full feature guide",
    icon: BookOpen,
    href: "/how-it-works",
    iconColor: "text-teal-600 dark:text-teal-400",
    iconBg: "bg-teal-50 dark:bg-teal-950/40",
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(name: string) {
  const hour = new Date().getHours()
  const first = name.split(" ")[0]
  if (hour < 12) return `Good morning, ${first}`
  if (hour < 17) return `Good afternoon, ${first}`
  return `Good evening, ${first}`
}

function formatRelative(date: Date) {
  const diff = date.getTime() - Date.now()
  const hours = Math.floor(Math.abs(diff) / 36e5)
  if (diff < 0) return hours < 24 ? `${hours}h ago` : date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  const mins = Math.floor(Math.abs(diff) / 6e4)
  if (mins < 60) return `in ${mins}m`
  if (hours < 24) return `in ${hours}h`
  return `in ${Math.floor(hours / 24)}d`
}

const PLATFORM_LABEL: Record<Platform, string> = { x: "X", linkedin: "LinkedIn", instagram: "Instagram" }
const PLATFORM_COLOR: Record<Platform, string> = {
  x: "text-sky-500",
  linkedin: "text-blue-600",
  instagram: "text-pink-500",
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UpcomingPosts({ posts, onCreatePost }: { posts: ScheduledPost[]; onCreatePost: () => void }) {
  const upcoming = posts
    .filter((p) => p.status !== "failed")
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
    .slice(0, 4)

  if (upcoming.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center">
        <CalendarDays className="size-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-medium">No upcoming posts</p>
        <p className="text-xs text-muted-foreground mt-1 mb-3">Schedule your first post to see it here</p>
        <Button size="sm" variant="outline" onClick={onCreatePost}>
          <Plus className="size-3.5 mr-1.5" />
          Create a post
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {upcoming.map((post) => (
        <div key={post.id} className="flex items-start gap-3 rounded-xl border bg-card px-3 py-2.5 hover:bg-accent/40 transition-colors">
          <div className="flex-1 min-w-0">
            <p className="text-xs leading-relaxed line-clamp-1 text-foreground">{post.content}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn("text-[10px] font-semibold", PLATFORM_COLOR[post.platform])}>
                {PLATFORM_LABEL[post.platform]}
              </span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="size-2.5" />
                {post.status === "published" ? "Published" : formatRelative(post.scheduledAt)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

function DashboardContent() {
  const { scheduledPosts } = usePostsContext()
  const { user } = useUser()
  const [createOpen, setCreateOpen] = useState(false)
  const [greeting, setGreeting] = useState("")
  const [todayLabel, setTodayLabel] = useState("")

  useEffect(() => {
    setGreeting(getGreeting(user.name))
    setTodayLabel(new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }))
  }, [user.name])

  const scheduled = scheduledPosts.filter((p) => p.status === "scheduled").length + 10
  const drafts = scheduledPosts.filter((p) => p.status === "draft").length + 6
  const published = DUMMY_PLATFORM_STATS.reduce((a, s) => a + s.publishedThisWeek, 0)

  return (
    <div className="flex flex-col h-full">

      {/* ── Sticky top bar (mobile) ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-3 sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold leading-snug truncate" suppressHydrationWarning>
              {greeting || `Hey, ${user.name.split(" ")[0]}`} 👋
            </p>
            <p className="text-[11px] text-muted-foreground" suppressHydrationWarning>
              {todayLabel}
            </p>
          </div>
          <Button size="sm" className="h-8 shrink-0" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5 mr-1" />
            New Post
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">

          {/* ── Desktop greeting ─────────────────────────────────────────────── */}
          <div className="hidden sm:flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight" suppressHydrationWarning>
                {greeting || "Welcome back"} 👋
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5" suppressHydrationWarning>
                {todayLabel} · Your PostFlow command centre
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" asChild>
                <Link href="/schedule">
                  <CalendarDays className="size-3.5 mr-1.5" />
                  Calendar
                </Link>
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-3.5 mr-1.5" />
                New Post
              </Button>
            </div>
          </div>

          {/* ── Stat chips ───────────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2.5" data-tour="page-dashboard">
            {[
              { label: "Scheduled",    value: scheduled, icon: Clock,        href: "/schedule",  color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-950/40"   },
              { label: "Drafts",       value: drafts,    icon: FileText,     href: "/schedule",  color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-950/40" },
              { label: "This week",    value: published, icon: CheckCircle2, href: "/schedule",  color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
            ].map(({ label, value, icon: Icon, href, color, bg }) => (
              <Link key={label} href={href}
                className="flex flex-col items-center gap-1.5 rounded-xl border bg-card p-3 hover:bg-accent/50 transition-colors text-center"
              >
                <div className={cn("flex size-8 items-center justify-center rounded-lg", bg)}>
                  <Icon className={cn("size-4", color)} />
                </div>
                <p className="text-lg font-bold leading-none">{value}</p>
                <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
              </Link>
            ))}
          </div>

          {/* ── Platforms ────────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-sm font-semibold mb-2.5">Your Platforms</h2>
            <div className="space-y-2">
              {PLATFORMS.map((p) => {
                const stats = DUMMY_PLATFORM_STATS.find((s) => s.platform === p.id)
                return (
                  <Link key={p.id} href={p.href}
                    className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 hover:bg-accent/50 active:scale-[0.99] transition-all group"
                  >
                    <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border", p.iconBg, p.border)}>
                      <p.Icon className={cn("size-4.5", p.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-none">{p.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{p.tagline}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold">{stats?.scheduledCount ?? 0} scheduled</p>
                      <p className="text-[10px] text-muted-foreground">{stats?.draftCount ?? 0} drafts</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                  </Link>
                )
              })}
            </div>
          </section>

          {/* ── Tools grid ───────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-sm font-semibold mb-2.5">Create & Manage</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {TOOLS.map((tool) => {
                const inner = (
                  <>
                    <div className={cn("flex size-9 items-center justify-center rounded-lg shrink-0", tool.iconBg)}>
                      <tool.icon className={cn("size-4", tool.iconColor)} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold leading-none">{tool.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{tool.desc}</p>
                    </div>
                  </>
                )
                const cls = "flex items-center gap-2.5 rounded-xl border bg-card p-3 hover:bg-accent/50 active:scale-[0.99] transition-all text-left w-full"
                if (tool.isCreate) {
                  return (
                    <button key={tool.label} onClick={() => setCreateOpen(true)} className={cn(cls, "col-span-2 sm:col-span-1")}>
                      {inner}
                    </button>
                  )
                }
                return (
                  <Link key={tool.label} href={tool.href!} className={cls}>
                    {inner}
                  </Link>
                )
              })}
            </div>
          </section>

          {/* ── Up next ──────────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-sm font-semibold">Up Next</h2>
              <Link href="/schedule" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                View all <ArrowRight className="size-3" />
              </Link>
            </div>
            <UpcomingPosts posts={scheduledPosts} onCreatePost={() => setCreateOpen(true)} />
          </section>

          {/* ── PostFlow intro (first-time hint) ─────────────────────────────── */}
          <div className="rounded-xl border bg-primary/5 border-primary/20 p-4 flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
              <Zap className="size-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">New here? Start with Brand Voice</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Tell PostFlow about your brand once — every AI-generated post will sound authentically like you.
              </p>
              <Link href="/brand-voice" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                Set up Brand Voice <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>

        </div>
      </ScrollArea>

      {createOpen && (
        <PostWizard platform="x" open onClose={() => setCreateOpen(false)} />
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
