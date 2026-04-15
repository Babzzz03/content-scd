"use client"

import { createContext, useContext, useState } from "react"
import { DUMMY_SCHEDULED_POSTS } from "@/lib/dummy-data"
import type { ScheduledPost, Platform, PostType, ContentIdea } from "@/lib/types"

interface NewPostPayload {
  platform: Platform
  postType: PostType
  content: string
  caption?: string
  hashtags?: string[]
  scheduledAt: Date
  source?: "post" | "content-idea"
  ideaData?: ContentIdea
}

interface PostsContextValue {
  scheduledPosts: ScheduledPost[]
  addScheduledPost: (payload: NewPostPayload) => ScheduledPost
  removeScheduledPost: (id: string) => void
  reschedulePost: (id: string, newDate: Date) => void
  updateScheduledPost: (id: string, updates: Partial<ScheduledPost>) => void
  duplicatePost: (id: string) => ScheduledPost | null
}

const PostsContext = createContext<PostsContextValue | null>(null)

export function PostsProvider({ children }: { children: React.ReactNode }) {
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>(DUMMY_SCHEDULED_POSTS)

  const addScheduledPost = (payload: NewPostPayload): ScheduledPost => {
    const post: ScheduledPost = {
      id: `post-${Date.now()}`,
      platform: payload.platform,
      postType: payload.postType,
      content: payload.content,
      caption: payload.caption,
      hashtags: payload.hashtags,
      scheduledAt: payload.scheduledAt,
      status: "scheduled",
      createdAt: new Date(),
      source: payload.source ?? "post",
      ideaData: payload.ideaData,
    }
    setScheduledPosts((prev) => [...prev, post])
    console.log("[POSTS CONTEXT] New post scheduled:", post)
    return post
  }

  const removeScheduledPost = (id: string) => {
    setScheduledPosts((prev) => prev.filter((p) => p.id !== id))
    console.log("[POSTS CONTEXT] Post removed:", id)
  }

  const reschedulePost = (id: string, newDate: Date) => {
    setScheduledPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, scheduledAt: newDate, status: "scheduled" } : p))
    )
    console.log("[POSTS CONTEXT] Post rescheduled:", id, newDate)
  }

  const updateScheduledPost = (id: string, updates: Partial<ScheduledPost>) => {
    setScheduledPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    )
    console.log("[POSTS CONTEXT] Post updated:", id, updates)
  }

  const duplicatePost = (id: string): ScheduledPost | null => {
    const original = scheduledPosts.find((p) => p.id === id)
    if (!original) return null
    const copy: ScheduledPost = {
      ...original,
      id: `post-${Date.now()}`,
      status: "draft",
      createdAt: new Date(),
      scheduledAt: new Date(original.scheduledAt.getTime() + 60 * 60 * 1000), // +1 hour
    }
    setScheduledPosts((prev) => [...prev, copy])
    console.log("[POSTS CONTEXT] Post duplicated:", id, "→", copy.id)
    return copy
  }

  return (
    <PostsContext.Provider value={{
      scheduledPosts,
      addScheduledPost,
      removeScheduledPost,
      reschedulePost,
      updateScheduledPost,
      duplicatePost,
    }}>
      {children}
    </PostsContext.Provider>
  )
}

export function usePostsContext() {
  const ctx = useContext(PostsContext)
  if (!ctx) throw new Error("usePostsContext must be used within PostsProvider")
  return ctx
}
