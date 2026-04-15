"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MoreHorizontal,
  Filter,
  Copy,
  Lightbulb,
  X,
  Sparkles,
  Loader2,
} from "lucide-react"
import { XIcon, LinkedInIcon, InstagramIcon } from "@/components/ui/platform-icons"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PostWizard, type PostWizardPrefill } from "@/components/post-wizard/post-wizard"
import { ScheduleDatePicker } from "@/components/post-wizard/schedule-date-picker"
import { generateVideoPrompt } from "@/lib/ai-mock"
import type { Platform, ScheduledPost } from "@/lib/types"
import { usePostsContext } from "@/lib/posts-context"
import { useAccounts } from "@/lib/accounts-context"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const PLATFORM_ICONS: Record<Platform, React.ElementType> = {
  x: XIcon,
  linkedin: LinkedInIcon,
  instagram: InstagramIcon,
}

const PLATFORM_COLORS: Record<Platform, string> = {
  x: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  linkedin: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  instagram: "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300",
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400",
  draft: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400",
  published: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400",
  failed: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400",
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

// ── ScheduledPostCard ─────────────────────────────────────────────────────────

interface ScheduledPostCardProps {
  post: ScheduledPost
  compact?: boolean
  onDelete: (id: string) => void
  onEdit: (post: ScheduledPost) => void
  onReschedule: (post: ScheduledPost) => void
  onDuplicate: (id: string) => void
  onViewIdea: (post: ScheduledPost) => void
}

function ScheduledPostCard({
  post,
  compact,
  onDelete,
  onEdit,
  onReschedule,
  onDuplicate,
  onViewIdea,
}: ScheduledPostCardProps) {
  const PIcon = PLATFORM_ICONS[post.platform]

  const isIdea = post.source === "content-idea"

  if (compact) {
    return (
      <div
        onClick={(e) => { e.stopPropagation(); isIdea ? onViewIdea(post) : onEdit(post) }}
        className={cn(
          "flex items-center gap-1.5 rounded px-1.5 py-1 text-[10px] font-medium truncate cursor-pointer hover:opacity-80 transition-opacity",
          isIdea
            ? "border border-dashed border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
            : PLATFORM_COLORS[post.platform]
        )}
      >
        {isIdea ? (
          <Lightbulb className="size-2.5 shrink-0" />
        ) : (
          <PIcon className="size-2.5 shrink-0" />
        )}
        <span className="truncate">{post.content.substring(0, 30)}…</span>
      </div>
    )
  }

  if (isIdea) {
    return (
      <div
        onClick={() => onViewIdea(post)}
        className="flex items-start gap-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20 p-4 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
          <Lightbulb className="size-4 text-amber-600 dark:text-amber-400" />
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Badge className="text-[10px] py-0 h-4 px-1.5 bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300">
              Content Idea
            </Badge>
            <PIcon className="size-3 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium leading-snug line-clamp-2">{post.content}</p>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-1">
            {post.caption}
          </p>
          <span
            suppressHydrationWarning
            className="inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400"
          >
            <Clock className="size-2.5" />
            {post.scheduledAt.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewIdea(post) }}>
              View Idea
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onReschedule(post) }}>
              Reschedule
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(post.id) }}
            >
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <div
      onClick={() => onEdit(post)}
      className="flex items-start gap-3 rounded-xl border bg-card p-4 hover:bg-accent/30 transition-colors cursor-pointer"
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
          PLATFORM_COLORS[post.platform]
        )}
      >
        <PIcon className="size-4" />
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-sm leading-relaxed line-clamp-2">{post.content}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            suppressHydrationWarning
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
              STATUS_COLORS[post.status]
            )}
          >
            <Clock className="size-2.5" />
            {post.status === "published"
              ? post.scheduledAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : post.scheduledAt.toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
          </span>
          <Badge variant="outline" className="text-[10px] py-0 h-4 px-1.5">
            {post.postType}
          </Badge>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(post)}>
            Edit post
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onReschedule(post)}>
            Reschedule
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDuplicate(post.id)}>
            <Copy className="size-3.5 mr-2" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => onDelete(post.id)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const VALID_PLATFORMS: Platform[] = ["x", "linkedin", "instagram"]

function ScheduleContent() {
  const searchParams = useSearchParams()
  const { scheduledPosts, removeScheduledPost, reschedulePost, duplicatePost, updateScheduledPost } =
    usePostsContext()

  const platformParam = searchParams.get("platform") as Platform | null
  const initialFilter: Platform | "all" =
    platformParam && VALID_PLATFORMS.includes(platformParam) ? platformParam : "all"

  const today = new Date()
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<number | null>(today.getDate())
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">(initialFilter)

  // Edit state
  const [editPost, setEditPost] = useState<ScheduledPost | null>(null)
  const [editWizardKey, setEditWizardKey] = useState(0)

  // Reschedule state
  const [rescheduleTarget, setRescheduleTarget] = useState<ScheduledPost | null>(null)

  // View idea state
  const [viewIdea, setViewIdea] = useState<ScheduledPost | null>(null)
  const [modalVideoPrompt, setModalVideoPrompt] = useState("")
  const [isGeneratingVideoPrompt, setIsGeneratingVideoPrompt] = useState(false)

  // New post wizard
  const [newWizardOpen, setNewWizardOpen] = useState(false)
  const [newWizardPlatform, setNewWizardPlatform] = useState<Platform>("x")
  const [newWizardKey, setNewWizardKey] = useState(0)

  const { accounts } = useAccounts()

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)

  const prevMonth = () => {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11 }
      return m - 1
    })
    setSelectedDate(null)
  }

  const nextMonth = () => {
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0 }
      return m + 1
    })
    setSelectedDate(null)
  }

  const getPostsForDay = (day: number) =>
    scheduledPosts.filter((post) => {
      const d = post.scheduledAt
      return (
        d.getDate() === day &&
        d.getMonth() === viewMonth &&
        d.getFullYear() === viewYear &&
        (platformFilter === "all" || post.platform === platformFilter)
      )
    })

  const selectedDayPosts = selectedDate
    ? getPostsForDay(selectedDate).sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
    : []

  const allVisiblePosts = scheduledPosts
    .filter((p) => {
      const d = p.scheduledAt
      return (
        d.getMonth() === viewMonth &&
        d.getFullYear() === viewYear &&
        (platformFilter === "all" || p.platform === platformFilter)
      )
    })
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleEdit = (post: ScheduledPost) => {
    setEditPost(post)
    setEditWizardKey((k) => k + 1)
  }

  const handleViewIdea = (post: ScheduledPost) => {
    setViewIdea(post)
    setModalVideoPrompt(post.ideaData?.videoPrompt ?? "")
    setIsGeneratingVideoPrompt(false)
  }

  const handleGenerateModalVideoPrompt = async () => {
    if (!viewIdea?.ideaData) return
    setIsGeneratingVideoPrompt(true)
    try {
      const prompt = await generateVideoPrompt(viewIdea.ideaData)
      setModalVideoPrompt(prompt)
      // Persist into the scheduled post
      updateScheduledPost(viewIdea.id, {
        ideaData: { ...viewIdea.ideaData, videoPrompt: prompt },
      })
    } finally {
      setIsGeneratingVideoPrompt(false)
    }
  }

  const handleReschedule = (post: ScheduledPost) => {
    setRescheduleTarget(post)
  }

  const handleRescheduleConfirm = (newDate: Date) => {
    if (!rescheduleTarget) return
    reschedulePost(rescheduleTarget.id, newDate)
    toast.success("Post rescheduled!", {
      description: newDate.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    })
    setRescheduleTarget(null)
  }

  const handleDuplicate = (id: string) => {
    const copy = duplicatePost(id)
    if (copy) {
      toast.success("Post duplicated", {
        description: `Copy scheduled for ${copy.scheduledAt.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })} (+1 hour)`,
      })
    }
  }

  // Build prefill from an existing post for the edit wizard
  const editPrefill: PostWizardPrefill | undefined = editPost
    ? {
        platform: editPost.platform,
        postType: editPost.postType,
        topic: editPost.content.slice(0, 60),
        tone: "professional",
        caption: editPost.content,
        hashtags: editPost.hashtags ?? [],
      }
    : undefined

  const cardProps = {
    onDelete: removeScheduledPost,
    onEdit: handleEdit,
    onReschedule: handleReschedule,
    onDuplicate: handleDuplicate,
    onViewIdea: handleViewIdea,
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Page header */}
      <div data-tour="page-schedule" className="sticky top-0 z-10 bg-background flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5 border-b">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <CalendarDays className="size-4 sm:size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-semibold leading-tight">Schedule</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              View and manage all your scheduled content
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Plus data-icon="inline-start" />
              Schedule Post
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {([
              { id: "x" as Platform, label: "X (Twitter)", Icon: PLATFORM_ICONS.x },
              { id: "linkedin" as Platform, label: "LinkedIn", Icon: PLATFORM_ICONS.linkedin },
              { id: "instagram" as Platform, label: "Instagram", Icon: PLATFORM_ICONS.instagram },
            ]).map(({ id, label, Icon }) => (
              <DropdownMenuItem
                key={id}
                onClick={() => {
                  setNewWizardPlatform(id)
                  setNewWizardKey((k) => k + 1)
                  setNewWizardOpen(true)
                }}
              >
                <Icon className="size-3.5 mr-2" />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6 lg:flex-row">
        {/* Calendar */}
        <div className="flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="size-8" onClick={prevMonth}>
                <ChevronLeft className="size-4" />
              </Button>
              <h2 className="text-base font-semibold min-w-28 text-center">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </h2>
              <Button variant="outline" size="icon" className="size-8" onClick={nextMonth}>
                <ChevronRight className="size-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="size-3.5 text-muted-foreground shrink-0" />
              {(["all", "x", "linkedin", "instagram"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatformFilter(p)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors capitalize",
                    platformFilter === p
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-accent"
                  )}
                >
                  {p === "all" ? "All" : p === "x" ? "X" : p === "linkedin" ? "LinkedIn" : "IG"}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border overflow-hidden">
            <div className="grid grid-cols-7 border-b bg-muted/30">
              {DAY_NAMES.map((day) => (
                <div
                  key={day}
                  className="py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-12 sm:min-h-20 border-r border-b bg-muted/10" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const day = idx + 1
                const dayPosts = getPostsForDay(day)
                const isToday =
                  day === today.getDate() &&
                  viewMonth === today.getMonth() &&
                  viewYear === today.getFullYear()
                const isSelected = day === selectedDate
                const colPos = (firstDay + idx) % 7

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "min-h-12 sm:min-h-20 border-r border-b p-1.5 cursor-pointer transition-colors",
                      colPos === 6 && "border-r-0",
                      isSelected ? "bg-primary/5" : "hover:bg-accent/50"
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs font-medium mb-1",
                        isToday
                          ? "bg-primary text-primary-foreground"
                          : isSelected
                          ? "bg-primary/20 text-primary"
                          : "text-foreground"
                      )}
                    >
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayPosts.slice(0, 2).map((post) => (
                        <ScheduledPostCard
                          key={post.id}
                          post={post}
                          compact
                          {...cardProps}
                        />
                      ))}
                      {dayPosts.length > 2 && (
                        <p className="text-[9px] text-muted-foreground pl-1">
                          +{dayPosts.length - 2} more
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-full lg:w-80">
          <div className="sticky top-0 space-y-4">

            {/* Connected accounts strip */}
            <div className="rounded-xl border bg-card p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Connected Accounts
              </p>
              <div className="space-y-1.5">
                {accounts.map((acc) => {
                  const Icon = PLATFORM_ICONS[acc.platform]
                  const colors: Record<Platform, string> = {
                    x: "text-sky-500",
                    linkedin: "text-blue-600",
                    instagram: "text-pink-500",
                  }
                  const labels: Record<Platform, string> = {
                    x: "X (Twitter)",
                    linkedin: "LinkedIn",
                    instagram: "Instagram",
                  }
                  return (
                    <div key={acc.platform} className="flex items-center gap-2.5">
                      <Icon className={cn("size-3.5 shrink-0", colors[acc.platform])} />
                      <span className="text-xs flex-1">{labels[acc.platform]}</span>
                      {acc.connected ? (
                        <div className="flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                          <span className="text-[10px] text-emerald-600 font-medium">Connected</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-muted-foreground/40 inline-block" />
                          <span className="text-[10px] text-muted-foreground">
                            <a href="/settings" className="hover:underline">Connect</a>
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {accounts.filter((a) => a.connected).length === 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Connect accounts in{" "}
                  <a href="/settings" className="text-primary hover:underline">Settings</a>{" "}
                  to enable automation
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {selectedDate
                  ? `${MONTH_NAMES[viewMonth]} ${selectedDate}`
                  : `${MONTH_NAMES[viewMonth]} Overview`}
              </h3>
              <Badge variant="secondary" className="text-xs">
                {selectedDate ? selectedDayPosts.length : allVisiblePosts.length} posts
              </Badge>
            </div>

            <ScrollArea className="max-h-150">
              <div className="space-y-2">
                {(selectedDate ? selectedDayPosts : allVisiblePosts).length === 0 ? (
                  <div className="rounded-xl border border-dashed p-8 text-center">
                    <CalendarDays className="size-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No posts {selectedDate ? "on this day" : "this month"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Create a post from the dashboard
                    </p>
                  </div>
                ) : (
                  (selectedDate ? selectedDayPosts : allVisiblePosts).map((post) => (
                    <ScheduledPostCard key={post.id} post={post} {...cardProps} />
                  ))
                )}
              </div>
            </ScrollArea>
        </div>
        </div>
      </div>

      {/* Edit wizard — key forces remount on each new edit target */}
      {editPost && (
        <PostWizard
          key={editWizardKey}
          platform={editPost.platform}
          open
          prefill={editPrefill}
          onClose={() => setEditPost(null)}
        />
      )}

      {/* New post wizard — key forces fresh remount on every open so platform state never stales */}
      <PostWizard
        key={newWizardKey}
        platform={newWizardPlatform}
        open={newWizardOpen}
        onClose={() => setNewWizardOpen(false)}
      />

      {/* Reschedule date picker */}
      <ScheduleDatePicker
        open={rescheduleTarget !== null}
        onClose={() => setRescheduleTarget(null)}
        onConfirm={handleRescheduleConfirm}
      />

      {/* Content Idea Detail Dialog */}
      <Dialog open={viewIdea !== null} onOpenChange={(open) => { if (!open) setViewIdea(null) }}>
        <DialogContent className="max-w-xl sm:max-w-2xl lg:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
                <Lightbulb className="size-4 text-amber-600 dark:text-amber-400" />
              </div>
              Content Idea
            </DialogTitle>
          </DialogHeader>

          {viewIdea && (() => {
            const idea = viewIdea.ideaData
            const PIcon = PLATFORM_ICONS[viewIdea.platform]
            const platformLabel: Record<Platform, string> = {
              x: "X (Twitter)", linkedin: "LinkedIn", instagram: "Instagram"
            }
            return (
              <div className="flex flex-col flex-1 min-h-0">
                <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
                  <div className="space-y-4 pr-2 pb-2">
                    {/* Meta row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300">
                        {idea?.type ?? "Content Idea"}
                      </Badge>
                      <div className="flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-1 text-[11px]">
                        <PIcon className="size-3" />
                        <span>{platformLabel[viewIdea.platform]}</span>
                      </div>
                      {idea?.estimatedDuration && (
                        <div className="flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-1 text-[11px]">
                          <Clock className="size-3 text-amber-600" />
                          <span>{idea.estimatedDuration}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-1 text-[11px]">
                        <Clock className="size-3 text-muted-foreground" />
                        <span suppressHydrationWarning>
                          {viewIdea.scheduledAt.toLocaleString("en-US", {
                            weekday: "short", month: "short", day: "numeric",
                            hour: "numeric", minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Title */}
                    <div>
                      <p className="text-base font-semibold leading-snug">{viewIdea.content}</p>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {idea?.description ?? viewIdea.caption}
                    </p>

                    {/* Hook (suggested caption) */}
                    {idea?.suggestedCaption && (
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3">
                        <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">Hook / Caption</p>
                        <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{idea.suggestedCaption}</p>
                      </div>
                    )}

                    {/* Script */}
                    {idea?.script && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Script</p>
                        <div className="rounded-lg border bg-muted/30 px-4 py-3">
                          <p className="text-sm leading-relaxed whitespace-pre-line">{idea.script}</p>
                        </div>
                      </div>
                    )}

                    {/* Scene Breakdown */}
                    {idea?.sceneBreakdown && idea.sceneBreakdown.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Scene Breakdown</p>
                        <div className="space-y-2">
                          {idea.sceneBreakdown.map((scene, i) => (
                            <div key={i} className="flex gap-3 rounded-lg border bg-card px-3 py-2.5">
                              <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary mt-0.5">
                                {i + 1}
                              </div>
                              <div className="flex-1 min-w-0 space-y-0.5">
                                <p className="text-xs font-medium">{scene.scene}</p>
                                <p className="text-[11px] text-muted-foreground">{scene.action}</p>
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
                                  <Clock className="size-2.5" />{scene.duration}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Visual Direction */}
                    {idea?.visualDirection && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Visual Direction</p>
                        <div className="rounded-lg border bg-muted/30 px-4 py-3">
                          <p className="text-sm text-muted-foreground leading-relaxed">{idea.visualDirection}</p>
                        </div>
                      </div>
                    )}

                    {/* Props */}
                    {idea?.props && idea.props.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Props / What You Need</p>
                        <div className="flex flex-wrap gap-1.5">
                          {idea.props.map((prop) => (
                            <span key={prop} className="rounded-full bg-muted border px-2.5 py-1 text-[11px] font-medium">
                              {prop}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* CTA */}
                    {idea?.callToAction && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Call to Action</p>
                        <p className="text-sm text-muted-foreground">{idea.callToAction}</p>
                      </div>
                    )}

                    {/* AI Video Prompt */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Video Prompt</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2"
                          onClick={handleGenerateModalVideoPrompt}
                          disabled={isGeneratingVideoPrompt}
                        >
                          {isGeneratingVideoPrompt ? (
                            <><Loader2 className="size-2.5 mr-1 animate-spin" />Generating…</>
                          ) : (
                            <><Sparkles className="size-2.5 mr-1" />Generate for Runway / Sora</>
                          )}
                        </Button>
                      </div>
                      {modalVideoPrompt ? (
                        <div className="rounded-lg border bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800 px-4 py-3">
                          <p className="text-xs text-violet-900 dark:text-violet-200 leading-relaxed">{modalVideoPrompt}</p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(modalVideoPrompt)
                              toast.success("Video prompt copied!")
                            }}
                            className="mt-2 text-[10px] text-violet-600 hover:underline font-medium"
                          >
                            Copy prompt
                          </button>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-violet-200 dark:border-violet-800 px-4 py-3 text-center">
                          <p className="text-xs text-muted-foreground">Click Generate to create an AI video prompt for tools like Runway, Sora, or Pika</p>
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>

                {/* Actions footer */}
                <div className="flex items-center justify-between pt-3 border-t shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const snap = viewIdea
                      setViewIdea(null)
                      handleReschedule(snap)
                    }}
                  >
                    <Clock className="size-3.5 mr-1.5" />
                    Reschedule
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      removeScheduledPost(viewIdea.id)
                      setViewIdea(null)
                      toast.success("Removed from calendar")
                    }}
                  >
                    <X className="size-3.5 mr-1.5" />
                    Remove
                  </Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <ScheduleContent />
    </Suspense>
  )
}
