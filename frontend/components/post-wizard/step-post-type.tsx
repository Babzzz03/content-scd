"use client"

import {
  FileText,
  Layers,
  BookOpen,
  MessageSquare,
  Image,
  AlignLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Platform, PostType, XPostType, InstagramPostType, LinkedInPostType } from "@/lib/types"

interface PostTypeOption {
  id: PostType
  label: string
  description: string
  icon: React.ElementType
  badge?: string
}

const POST_TYPES: Record<Platform, PostTypeOption[]> = {
  x: [
    {
      id: "single" as XPostType,
      label: "Single Post",
      description: "A standalone tweet up to 280 characters with optional media",
      icon: MessageSquare,
    },
    {
      id: "thread" as XPostType,
      label: "Thread",
      description: "A connected series of tweets for longer storytelling",
      icon: BookOpen,
      badge: "AI-powered",
    },
  ],
  instagram: [
    {
      id: "single" as InstagramPostType,
      label: "Single Post",
      description: "One image or video in your feed with a caption",
      icon: Image,
    },
    {
      id: "carousel" as InstagramPostType,
      label: "Carousel",
      description: "Up to 10 swipeable slides — great for tutorials & lists",
      icon: Layers,
      badge: "High engagement",
    },
    {
      id: "story" as InstagramPostType,
      label: "Story",
      description: "Vertical full-screen content that disappears after 24h",
      icon: FileText,
    },
  ],
  linkedin: [
    {
      id: "text" as LinkedInPostType,
      label: "Text Post",
      description: "Pure text content — great for thought leadership",
      icon: AlignLeft,
      badge: "High reach",
    },
    {
      id: "image" as LinkedInPostType,
      label: "Image Post",
      description: "Post with an image or visual to accompany your copy",
      icon: Image,
    },
    {
      id: "carousel" as LinkedInPostType,
      label: "Document/Carousel",
      description: "PDF-style swipeable document — great for educational content",
      icon: Layers,
      badge: "Top performing",
    },
  ],
}

interface StepPostTypeProps {
  platform: Platform
  selected: PostType | null
  onSelect: (type: PostType) => void
}

export function StepPostType({ platform, selected, onSelect }: StepPostTypeProps) {
  const options = POST_TYPES[platform]

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">Choose your post type</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Select the format that best fits your content goal
        </p>
      </div>

      <div className="grid gap-3">
        {options.map((option) => {
          const Icon = option.icon
          const isSelected = selected === option.id

          return (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              className={cn(
                "flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all hover:bg-accent",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-transparent bg-muted/50"
              )}
            >
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-background border"
                )}
              >
                <Icon className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{option.label}</span>
                  {option.badge && (
                    <Badge variant="secondary" className="text-[10px] py-0 h-4">
                      {option.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {option.description}
                </p>
              </div>
              <div
                className={cn(
                  "size-4 rounded-full border-2 shrink-0 mt-0.5 transition-colors",
                  isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                )}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
