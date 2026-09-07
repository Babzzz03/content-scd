"use client"

import { PenLine, MessageCircleReply, Heart, ChevronRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Platform } from "@/lib/types"

export type ActionType = "create" | "reply" | "engage"

const ACTION_META: Record<
  ActionType,
  {
    icon: React.ElementType
    title: string
    description: string
    buttonLabel: string
    color: string
    badgeVariant: "default" | "secondary" | "outline"
  }
> = {
  create: {
    icon: PenLine,
    title: "Create Post",
    description: "Compose and design platform-specific posts with AI-assisted content and flyer generation",
    buttonLabel: "Create Post",
    color: "text-primary",
    badgeVariant: "default",
  },
  reply: {
    icon: MessageCircleReply,
    title: "Reply to Posts",
    description: "Generate smart, on-brand replies to posts in your niche or from your audience",
    buttonLabel: "Write Reply",
    color: "text-emerald-600",
    badgeVariant: "secondary",
  },
  engage: {
    icon: Heart,
    title: "Engage & Comment",
    description: "Generate conversation-starting comments and engagement prompts for your target posts",
    buttonLabel: "Generate Engagement",
    color: "text-rose-500",
    badgeVariant: "outline",
  },
}

interface ActionCardProps {
  type: ActionType
  platform: Platform
  onClick: () => void
  className?: string
}

export function ActionCard({ type, platform, onClick, className }: ActionCardProps) {
  const meta = ACTION_META[type]
  const Icon = meta.icon

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={cn("flex size-9 items-center justify-center rounded-lg bg-muted", meta.color)}>
            <Icon className="size-4" />
          </div>
          <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <CardTitle className="text-sm mt-2">{meta.title}</CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          {meta.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Button
          size="sm"
          variant={type === "create" ? "default" : "outline"}
          className="w-full text-xs"
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
        >
          <Icon data-icon="inline-start" />
          {meta.buttonLabel}
        </Button>
      </CardContent>
    </Card>
  )
}
