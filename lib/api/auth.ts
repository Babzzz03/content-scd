import { post, get, patch, setTokens, clearTokens } from './client'

export interface AuthUser {
  _id: string
  name: string
  email: string
  plan: 'free' | 'starter' | 'pro' | 'agency'
  avatarUrl: string | null
  usage: { postsThisMonth: number; aiGenerationsThisMonth: number }
  subscriptionStatus: string
}

interface AuthResponse {
  data: { user: AuthUser; accessToken: string; refreshToken: string }
}

export const authApi = {
  register: async (name: string, email: string, password: string) => {
    const res = await post<AuthResponse>('/auth/register', { name, email, password }, { skipAuth: true })
    setTokens(res.data.accessToken, res.data.refreshToken)
    return res.data.user
  },

  login: async (email: string, password: string) => {
    const res = await post<AuthResponse>('/auth/login', { email, password }, { skipAuth: true })
    setTokens(res.data.accessToken, res.data.refreshToken)
    return res.data.user
  },

  logout: async () => {
    try { await post('/auth/logout') } finally { clearTokens() }
  },

  me: async () => {
    const res = await get<{ data: { user: AuthUser } }>('/auth/me')
    return res.data.user
  },

  updateProfile: async (updates: Partial<{ name: string; avatarUrl: string }>) => {
    const res = await patch<{ data: { user: AuthUser } }>('/auth/profile', updates)
    return res.data.user
  },
}
