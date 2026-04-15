"use client"

import { Clock, MoreHorizontal } from "lucide-react"
import { XIcon, LinkedInIcon, InstagramIcon } from "@/components/ui/platform-icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { usePostsContext } from "@/lib/posts-context"
import type { ScheduledPost, Platform } from "@/lib/types"
import { cn } from "@/lib/utils"

const PLATFORM_ICONS: Record<Platform, React.ElementType> = {
  x: XIcon,
  linkedin: LinkedInIcon,
  instagram: InstagramIcon,
}

const PLATFORM_COLORS: Record<Platform, string> = {
  x: "text-sky-500",
  linkedin: "text-blue-600",
  instagram: "text-pink-500",
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  draft: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  published: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  failed: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
}

function formatScheduledTime(date: Date): string {
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  const hours = Math.floor(Math.abs(diff) / (1000 * 60 * 60))
  const mins = Math.floor((Math.abs(diff) % (1000 * 60 * 60)) / (1000 * 60))

  if (diff < 0) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }
  if (hours < 1) return `in ${mins}m`
  if (hours < 24) return `in ${hours}h ${mins}m`
  const days = Math.floor(hours / 24)
  return `in ${days}d`
}

interface ScheduledPreviewProps {
  posts: ScheduledPost[]
  platform: Platform
}

export function ScheduledPreview({ posts, platform }: ScheduledPreviewProps) {
  const { removeScheduledPost } = usePostsContext()
  const filtered = posts
    .filter((p) => p.platform === platform)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())

  const Icon = PLATFORM_ICONS[platform]

  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">No scheduled posts yet</p>
        <p className="text-xs text-muted-foreground mt-1">Create your first post above</p>
      </div>
    )
  }

  return (
    <ScrollArea className="max-h-72">
      <div className="flex flex-col gap-2">
        {filtered.map((post) => (
          <div
            key={post.id}
            className="flex items-start gap-3 rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors"
          >
            <Icon className={cn("size-4 mt-0.5 shrink-0", PLATFORM_COLORS[platform])} />
            <div className="flex-1 min-w-0">
              <p className="text-xs leading-relaxed text-foreground line-clamp-2">
                {post.content}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    STATUS_STYLES[post.status]
                  )}
                >
                  <Clock className="size-2.5" />
                  {post.status === "published"
                    ? "Published"
                    : formatScheduledTime(post.scheduledAt)}
                </span>
                <Badge variant="outline" className="text-[10px] py-0 h-4 px-1.5">
                  {post.postType}
                </Badge>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-6 shrink-0">
                  <MoreHorizontal className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => console.log("[ACTION] Edit post:", post.id)}
                >
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => console.log("[ACTION] Duplicate post:", post.id)}
                >
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => removeScheduledPost(post.id)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
