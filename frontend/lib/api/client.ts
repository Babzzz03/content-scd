/**
 * PostFlow API client.
 *
 * Thin wrapper around fetch that:
 *  - Attaches the JWT access token from localStorage
 *  - Handles 401 → attempts refresh → retries once
 *  - Returns typed responses or throws ApiError
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ─── Token helpers ────────────────────────────────────────────────────────────

export const getAccessToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem('pf_access_token') : null

export const setTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem('pf_access_token', accessToken)
  localStorage.setItem('pf_refresh_token', refreshToken)
}

export const clearTokens = () => {
  localStorage.removeItem('pf_access_token')
  localStorage.removeItem('pf_refresh_token')
}

export const getRefreshToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem('pf_refresh_token') : null

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

interface FetchOptions extends RequestInit {
  skipAuth?: boolean
  isRetry?: boolean
}

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipAuth = false, isRetry = false, ...fetchOpts } = options

  const headers: Record<string, string> = {
    ...(fetchOpts.headers as Record<string, string>),
  }

  // Attach auth token unless explicitly skipped
  if (!skipAuth) {
    const token = getAccessToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  // Only set Content-Type for JSON bodies (not FormData)
  if (!(fetchOpts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...fetchOpts,
    headers,
  })

  // Auto-refresh on 401 (once)
  if (res.status === 401 && !isRetry && !skipAuth) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      return apiFetch<T>(endpoint, { ...options, isRetry: true })
    }
    clearTokens()
    window.location.href = '/login'
    throw new ApiError(401, 'Session expired')
  }

  const data = await res.json()

  if (!res.ok) {
    throw new ApiError(res.status, data.error || 'Request failed', data.details)
  }

  return data
}

const tryRefresh = async (): Promise<boolean> => {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return false
    const { data } = await res.json()
    setTokens(data.accessToken, data.refreshToken)
    return true
  } catch {
    return false
  }
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

export const get = <T>(path: string, opts?: FetchOptions) =>
  apiFetch<T>(path, { method: 'GET', ...opts })

export const post = <T>(path: string, body?: unknown, opts?: FetchOptions) =>
  apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body), ...opts })

export const put = <T>(path: string, body?: unknown, opts?: FetchOptions) =>
  apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body), ...opts })

export const patch = <T>(path: string, body?: unknown, opts?: FetchOptions) =>
  apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body), ...opts })

export const del = <T>(path: string, opts?: FetchOptions) =>
  apiFetch<T>(path, { method: 'DELETE', ...opts })

export const postForm = <T>(path: string, formData: FormData, opts?: FetchOptions) =>
  apiFetch<T>(path, { method: 'POST', body: formData, ...opts })
