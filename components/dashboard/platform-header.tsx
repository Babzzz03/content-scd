"use client"

import { TrendingUp, FileText, Clock } from "lucide-react"
import { XIcon, LinkedInIcon, InstagramIcon } from "@/components/ui/platform-icons"
import { Badge } from "@/components/ui/badge"
import type { Platform, PlatformStats } from "@/lib/types"
import { cn } from "@/lib/utils"

const PLATFORM_META: Record<
  Platform,
  { label: string; icon: React.ElementType; color: string; bg: string; description: string }
> = {
  x: {
    label: "X (Twitter)",
    icon: XIcon,
    color: "text-sky-500",
    bg: "bg-sky-50 dark:bg-sky-950/30",
    description: "Single posts & threads",
  },
  linkedin: {
    label: "LinkedIn",
    icon: LinkedInIcon,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    description: "Text, image & carousel posts",
  },
  instagram: {
    label: "Instagram",
    icon: InstagramIcon,
    color: "text-pink-500",
    bg: "bg-pink-50 dark:bg-pink-950/30",
    description: "Singles, carousels & stories",
  },
}

interface PlatformHeaderProps {
  platform: Platform
  stats: PlatformStats
}

export function PlatformHeader({ platform, stats }: PlatformHeaderProps) {
  const meta = PLATFORM_META[platform]
  const Icon = meta.icon

  return (
    <div className={cn("rounded-xl border p-5", meta.bg)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-background shadow-sm border">
            <Icon className={cn("size-5", meta.color)} />
          </div>
          <div>
            <h2 className="text-base font-semibold">{meta.label}</h2>
            <p className="text-xs text-muted-foreground">{meta.description}</p>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">
          Active
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="flex items-center gap-2">
          <Clock className="size-3.5 text-muted-foreground" />
          <div>
            <p className="text-lg font-semibold leading-none">{stats.scheduledCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Scheduled</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FileText className="size-3.5 text-muted-foreground" />
          <div>
            <p className="text-lg font-semibold leading-none">{stats.draftCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Drafts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="size-3.5 text-muted-foreground" />
          <div>
            <p className="text-lg font-semibold leading-none">{stats.engagementRate ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Engagement</p>
          </div>
        </div>
      </div>
    </div>
  )
}
