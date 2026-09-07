import { get, post, patch, del, postForm } from './client'

export interface ApiPost {
  _id: string
  platform: 'x' | 'linkedin' | 'instagram'
  content: string
  hashtags: string[]
  mediaUrls: string[]
  postType: string
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed'
  scheduledAt?: string
  publishedAt?: string
  engagement: { likes: number; comments: number; shares: number; reach: number }
  createdAt: string
}

export const postsApi = {
  list: (params?: { platform?: string; status?: string; page?: number }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return get<{ data: { posts: ApiPost[]; total: number; pages: number } }>(`/posts${query ? `?${query}` : ''}`)
  },

  getStats: () =>
    get<{ data: { scheduled: number; drafts: number; published: number } }>('/posts/stats'),

  create: (formData: FormData) => postForm<{ data: { post: ApiPost } }>('/posts', formData),

  update: (id: string, body: Partial<ApiPost>) =>
    patch<{ data: { post: ApiPost } }>(`/posts/${id}`, body),

  delete: (id: string) => del(`/posts/${id}`),

  publishNow: (id: string) => post(`/posts/${id}/publish`),

  engage: (params: {
    platform: string
    platformAccountId: string
    topic: string
    replyText: string
    repeatCount: number
    tone?: string
    delayBetween?: number
    targetType?: string
  }) => post<{ data: { engaged: number } }>('/posts/engage', params),
}
