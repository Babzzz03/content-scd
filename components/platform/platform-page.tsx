"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Plus,
  ArrowRight,
  Clock,
  FileText,
  CheckCircle2,
  TrendingUp,
  PenLine,
  MessageCircleReply,
  Heart,
  MoreHorizontal,
  CalendarDays,
} from "lucide-react"
import { XIcon, LinkedInIcon, InstagramIcon } from "@/components/ui/platform-icons"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PostWizard } from "@/components/post-wizard/post-wizard"
import { ReplyComposer } from "@/components/composers/reply-composer"
import { EngageComposer } from "@/components/composers/engage-composer"
import { DUMMY_PLATFORM_STATS } from "@/lib/dummy-data"
import { usePostsContext } from "@/lib/posts-context"
import { cn } from "@/lib/utils"
import type { Platform, ScheduledPost } from "@/lib/types"

// ─── Platform metadata ────────────────────────────────────────────────────────

const PLATFORM_META: Record<
  Platform,
  {
    label: string
    description: string
    Icon: React.ElementType
    color: string
    bg: string
    border: string
    dot: string
  }
> = {
  x: {
    label: "X (Twitter)",
    description: "Single posts & threads",
    Icon: XIcon,
    color: "text-sky-500",
    bg: "bg-sky-50 dark:bg-sky-950/30",
    border: "border-sky-200 dark:border-sky-800",
    dot: "bg-sky-500",
  },
  linkedin: {
    label: "LinkedIn",
    description: "Text, image & carousel posts",
    Icon: LinkedInIcon,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    dot: "bg-blue-600",
  },
  instagram: {
    label: "Instagram",
    description: "Singles, carousels & stories",
    Icon: InstagramIcon,
    color: "text-pink-500",
    bg: "bg-pink-50 dark:bg-pink-950/30",
    border: "border-pink-200 dark:border-pink-800",
    dot: "bg-pink-500",
  },
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  draft: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  published: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  failed: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
}

const PLATFORM_TIPS: Record<Platform, { title: string; tip: string }[]> = {
  x: [
    { title: "Tweet at peak hours", tip: "Post between 8–10 AM or 6–9 PM on weekdays for highest impressions." },
    { title: "Use threads for depth", tip: "Threads get 3× more engagement than single tweets for educational content." },
    { title: "Engage first", tip: "Reply to 5 posts in your niche before posting — it warms your account for the algorithm." },
  ],
  linkedin: [
    { title: "No links in the post", tip: "LinkedIn suppresses reach for posts with external links. Put your URL in the first comment instead." },
    { title: "Tell a story", tip: "Posts that start with a personal story get 2× more comments than list posts." },
    { title: "Post Tuesday–Thursday", tip: "LinkedIn audiences are most active mid-week between 9 AM and 12 PM." },
  ],
  instagram: [
    { title: "Carousels drive saves", tip: "Carousel posts get 3× more saves and shares than single-image posts." },
    { title: "Reels for discovery", tip: "Reels reach non-followers 5× more than static posts — use them to grow." },
    { title: "Strong first frame", tip: "You have 1.7 seconds. The first slide or frame must stop the scroll immediately." },
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  if (diff < 0) {
    const h = Math.floor(Math.abs(diff) / 36e5)
    return h < 24 ? `${h}h ago` : date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }
  const hours = Math.floor(diff / 36e5)
  const mins = Math.floor((diff % 36e5) / 6e4)
  if (hours < 1) return `in ${mins}m`
  if (hours < 24) return `in ${hours}h`
  return `in ${Math.floor(hours / 24)}d`
}

// ─── Stat mini-card ───────────────────────────────────────────────────────────

function StatMini({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: React.ElementType
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  )
}

// ─── Action tile ──────────────────────────────────────────────────────────────

function ActionTile({
  icon: Icon,
  title,
  description,
  buttonLabel,
  onClick,
  variant = "default",
  tourId,
}: {
  icon: React.ElementType
  title: string
  description: string
  buttonLabel: string
  onClick: () => void
  variant?: "default" | "outline"
  tourId?: string
}) {
  return (
    <Card
      className="group cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
      onClick={onClick}
      data-tour={tourId}
    >
      <CardContent className="p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
            <Icon className="size-4 text-foreground" />
          </div>
          <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
        </div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
        </div>
        <Button
          size="sm"
          variant={variant}
          className="w-full"
          onClick={(e) => { e.stopPropagation(); onClick() }}
        >
          <Icon className="size-3.5 mr-1.5" />
          {buttonLabel}
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Post queue ───────────────────────────────────────────────────────────────

function PostQueueCard({
  posts,
  platform,
  onCreatePost,
  onDelete,
}: {
  posts: ScheduledPost[]
  platform: Platform
  onCreatePost: () => void
  onDelete: (id: string) => void
}) {
  const meta = PLATFORM_META[platform]
  const filtered = posts
    .filter((p) => p.platform === platform && p.status !== "failed")
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())

  const scheduled = filtered.filter((p) => p.status === "scheduled")
  const drafts = filtered.filter((p) => p.status === "draft")
  const published = filtered.filter((p) => p.status === "published")

  const queue = [...scheduled, ...drafts, ...published].slice(0, 8)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">Post Queue</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {scheduled.length} scheduled · {drafts.length} draft
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
            <Link href="/schedule">
              Full calendar <ArrowRight className="size-3 ml-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {queue.length === 0 ? (
          <div className="rounded-xl border border-dashed py-8 text-center">
            <CalendarDays className="size-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">No posts yet</p>
            <p className="text-xs text-muted-foreground mt-0.5 mb-4">
              Create your first post for {meta.label}
            </p>
            <Button size="sm" variant="outline" onClick={onCreatePost}>
              <Plus className="size-3.5 mr-1.5" />
              Create post
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {queue.map((post) => (
              <div
                key={post.id}
                className="flex items-start gap-2.5 rounded-lg border bg-card p-3 hover:bg-accent/40 transition-colors"
              >
                {/* Status dot */}
                <div className={cn("mt-1.5 size-1.5 rounded-full shrink-0", meta.dot)} />

                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed line-clamp-2 text-foreground">
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
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0 capitalize">
                      {post.postType}
                    </Badge>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-6 shrink-0 mt-0.5">
                      <MoreHorizontal className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href="/schedule">View in calendar</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDelete(post.id)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Platform tips ────────────────────────────────────────────────────────────

function PlatformTipsCard({ platform }: { platform: Platform }) {
  const tips = PLATFORM_TIPS[platform]
  const meta = PLATFORM_META[platform]

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className={cn("size-3.5", meta.color)} />
          {meta.label} Tips
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {tips.map((t) => (
          <div key={t.title} className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-semibold">{t.title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{t.tip}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type OpenDialog = "create" | "reply" | "engage" | null

export function PlatformDashboardPage({ platform }: { platform: Platform }) {
  const { scheduledPosts, removeScheduledPost } = usePostsContext()
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null)

  const meta = PLATFORM_META[platform]
  const stats = DUMMY_PLATFORM_STATS.find((s) => s.platform === platform)!
  const Icon = meta.Icon

  return (
    <div className="flex-1 flex flex-col min-h-0">

      {/* ── Sticky page header ── */}
      <div data-tour="page-platform" className="sticky top-0 z-10 bg-background border-b px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg", meta.bg)}>
            <Icon className={cn("size-4 sm:size-5", meta.color)} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold leading-tight">{meta.label}</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">{meta.description}</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setOpenDialog("create")} className="shrink-0">
          <Plus className="size-3.5 mr-1.5" />
          <span className="hidden sm:inline">New Post</span>
          <span className="sm:hidden">Post</span>
        </Button>
      </div>

      {/* ── Body ── */}
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatMini label="Scheduled" value={stats.scheduledCount} icon={Clock} />
          <StatMini label="Drafts" value={stats.draftCount} icon={FileText} />
          <StatMini label="This Week" value={stats.publishedThisWeek} icon={CheckCircle2} />
          <StatMini label="Engagement" value={stats.engagementRate ?? "—"} icon={TrendingUp} />
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">

          {/* ── Left column — actions (2/3) ── */}
          <div className="lg:col-span-2 space-y-5">

            <div>
              <h2 className="text-sm font-semibold mb-3">What would you like to do?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <ActionTile
                  icon={PenLine}
                  title="Create Post"
                  description="Compose and schedule a new post with AI-assisted content and optional flyer generation."
                  buttonLabel="Create Post"
                  onClick={() => setOpenDialog("create")}
                  variant="default"
                  tourId="tour-start-here"
                />
                <ActionTile
                  icon={MessageCircleReply}
                  title="Reply to Posts"
                  description="Generate smart, on-brand replies to posts in your niche or from your audience."
                  buttonLabel="Write Reply"
                  onClick={() => setOpenDialog("reply")}
                  variant="outline"
                />
                <ActionTile
                  icon={Heart}
                  title="Engage & Comment"
                  description="Generate conversation-starting comments and engagement prompts for target posts."
                  buttonLabel="Generate"
                  onClick={() => setOpenDialog("engage")}
                  variant="outline"
                />
              </div>
            </div>

            {/* Platform tips — visible on mobile below actions, hidden on desktop (shown in right col) */}
            <div className="lg:hidden">
              <PlatformTipsCard platform={platform} />
            </div>

          </div>

          {/* ── Right column — queue + tips (1/3) ── */}
          <div className="lg:col-span-1 space-y-4">
            <PostQueueCard
              posts={scheduledPosts}
              platform={platform}
              onCreatePost={() => setOpenDialog("create")}
              onDelete={removeScheduledPost}
            />
            {/* Tips hidden on mobile (shown above) */}
            <div className="hidden lg:block">
              <PlatformTipsCard platform={platform} />
            </div>
          </div>

        </div>
      </div>

      {/* ── Dialogs ── */}
      {openDialog === "create" && (
        <PostWizard platform={platform} open onClose={() => setOpenDialog(null)} />
      )}
      {openDialog === "reply" && (
        <ReplyComposer platform={platform} open onClose={() => setOpenDialog(null)} />
      )}
      {openDialog === "engage" && (
        <EngageComposer platform={platform} open onClose={() => setOpenDialog(null)} />
      )}
    </div>
  )
}
