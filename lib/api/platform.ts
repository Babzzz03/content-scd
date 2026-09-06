import { get, post, patch, del } from './client'

export interface PlatformAccount {
  _id: string
  platform: 'x' | 'linkedin' | 'instagram'
  username: string
  displayName: string
  profileImageUrl: string | null
  isActive: boolean
  isVerified: boolean
  dailyPostCount: number
  lastPostedAt: string | null
  createdAt: string
}

export const platformApi = {
  list: () =>
    get<{ data: { accounts: PlatformAccount[] } }>('/platforms'),

  connect: (body: {
    platform: string
    username: string
    cookie: string
    displayName?: string
    profileImageUrl?: string
  }) => post<{ data: { account: PlatformAccount } }>('/platforms', body),

  updateCookie: (id: string, cookie: string) =>
    patch(`/platforms/${id}`, { cookie }),

  verify: (id: string) =>
    post<{ data: { valid: boolean }; message: string }>(`/platforms/${id}/verify`, {}),

  disconnect: (id: string) => del(`/platforms/${id}`),
}
