"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { postsApi, type ApiPost } from "@/lib/api/posts"
import { getAccessToken } from "@/lib/api/client"
import type { ScheduledPost, Platform, PostType, ContentIdea } from "@/lib/types"

interface NewPostPayload {
  platform: Platform
  postType: PostType
  content: string
  caption?: string
  hashtags?: string[]
  threadParts?: string[]
  scheduledAt?: Date
  status?: "draft" | "scheduled"
  mediaFiles?: File[]
  source?: "post" | "content-idea"
  ideaData?: ContentIdea
  platformAccountId?: string
}

interface PostsContextValue {
  scheduledPosts: ScheduledPost[]
  isLoading: boolean
  addScheduledPost: (payload: NewPostPayload) => Promise<ScheduledPost>
  removeScheduledPost: (id: string) => Promise<void>
  reschedulePost: (id: string, newDate: Date) => Promise<void>
  updateScheduledPost: (id: string, updates: Partial<ScheduledPost>) => Promise<void>
  duplicatePost: (id: string) => Promise<ScheduledPost | null>
  publishNow: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

function apiPostToScheduled(p: ApiPost): ScheduledPost {
  return {
    id: p._id,
    platform: p.platform as Platform,
    postType: p.postType as PostType,
    content: p.content,
    hashtags: p.hashtags,
    scheduledAt: p.scheduledAt ? new Date(p.scheduledAt) : new Date(),
    status: p.status as ScheduledPost["status"],
    createdAt: new Date(p.createdAt),
  }
}

const PostsContext = createContext<PostsContextValue | null>(null)

export function PostsProvider({ children }: { children: React.ReactNode }) {
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!getAccessToken()) {
      setScheduledPosts([])
      return
    }

    setIsLoading(true)
    try {
      const res = await postsApi.list()
      setScheduledPosts(res.data.posts.map(apiPostToScheduled))
    } catch {
      // Not authenticated yet — leave list empty
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!getAccessToken()) return
    refresh()
  }, [refresh])

  const addScheduledPost = async (payload: NewPostPayload): Promise<ScheduledPost> => {
    const formData = new FormData()
    formData.append("platform", payload.platform)
    formData.append("postType", payload.postType)
    formData.append("content", payload.content)
    if (payload.caption) formData.append("caption", payload.caption)
    if (payload.hashtags?.length) formData.append("hashtags", JSON.stringify(payload.hashtags))
    if (payload.threadParts?.length) formData.append("threadParts", JSON.stringify(payload.threadParts))
    if (payload.scheduledAt) formData.append("scheduledAt", payload.scheduledAt.toISOString())
    if (payload.platformAccountId) formData.append("platformAccountId", payload.platformAccountId)
    formData.append("status", payload.status ?? "scheduled")
    payload.mediaFiles?.forEach((f) => formData.append("media", f))

    const res = await postsApi.create(formData)
    const post = apiPostToScheduled(res.data.post)
    setScheduledPosts((prev) => [...prev, post])
    return post
  }

  const publishNow = async (id: string) => {
    await postsApi.publishNow(id)
    setScheduledPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "publishing" as const } : p))
    )
  }

  const removeScheduledPost = async (id: string) => {
    await postsApi.delete(id)
    setScheduledPosts((prev) => prev.filter((p) => p.id !== id))
  }

  const reschedulePost = async (id: string, newDate: Date) => {
    await postsApi.update(id, { scheduledAt: newDate.toISOString(), status: "scheduled" })
    setScheduledPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, scheduledAt: newDate, status: "scheduled" } : p))
    )
  }

  const updateScheduledPost = async (id: string, updates: Partial<ScheduledPost>) => {
    const apiUpdates: Partial<ApiPost> = {}
    if (updates.content !== undefined) apiUpdates.content = updates.content
    if (updates.hashtags !== undefined) apiUpdates.hashtags = updates.hashtags
    if (updates.scheduledAt !== undefined) apiUpdates.scheduledAt = updates.scheduledAt.toISOString()
    if (updates.status !== undefined) apiUpdates.status = updates.status as ApiPost["status"]

    if (Object.keys(apiUpdates).length > 0) await postsApi.update(id, apiUpdates)
    setScheduledPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    )
  }

  const duplicatePost = async (id: string): Promise<ScheduledPost | null> => {
    const original = scheduledPosts.find((p) => p.id === id)
    if (!original) return null

    const formData = new FormData()
    formData.append("platform", original.platform)
    formData.append("postType", original.postType)
    formData.append("content", original.content)
    if (original.hashtags?.length) formData.append("hashtags", JSON.stringify(original.hashtags))
    const newDate = new Date(original.scheduledAt.getTime() + 60 * 60 * 1000)
    formData.append("scheduledAt", newDate.toISOString())
    formData.append("status", "draft")

    const res = await postsApi.create(formData)
    const copy = apiPostToScheduled(res.data.post)
    setScheduledPosts((prev) => [...prev, copy])
    return copy
  }

  return (
    <PostsContext.Provider value={{
      scheduledPosts,
      isLoading,
      addScheduledPost,
      removeScheduledPost,
      reschedulePost,
      updateScheduledPost,
      duplicatePost,
      publishNow,
      refresh,
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
