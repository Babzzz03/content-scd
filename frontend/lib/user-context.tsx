"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { authApi, type AuthUser } from "@/lib/api/auth"
import { getAccessToken } from "@/lib/api/client"

export type UserPlan = "free" | "starter" | "pro" | "agency"

export interface UserProfile {
  name: string
  email: string
  bio: string
  plan: UserPlan
  timezone: string
  avatarUrl: string | null
  notifyScheduled: boolean
  notifyPublished: boolean
  notifyFailed: boolean
  joinedAt: Date
  usage: { postsThisMonth: number; aiGenerationsThisMonth: number }
  subscriptionStatus: string
}

interface UserContextValue {
  user: UserProfile
  isLoading: boolean
  isAuthenticated: boolean
  updateUser: (updates: Partial<UserProfile>) => void
  refreshUser: () => Promise<void>
}

const DEFAULT_USER: UserProfile = {
  name: "",
  email: "",
  bio: "",
  plan: "free",
  timezone: "Africa/Lagos",
  avatarUrl: null,
  notifyScheduled: true,
  notifyPublished: true,
  notifyFailed: true,
  joinedAt: new Date(),
  usage: { postsThisMonth: 0, aiGenerationsThisMonth: 0 },
  subscriptionStatus: "inactive",
}

function mapApiUser(u: AuthUser): UserProfile {
  return {
    name: u.name,
    email: u.email,
    bio: "",
    plan: (u.plan as UserPlan) || "free",
    timezone: "Africa/Lagos",
    avatarUrl: u.avatarUrl,
    notifyScheduled: true,
    notifyPublished: true,
    notifyFailed: true,
    joinedAt: new Date(),
    usage: u.usage,
    subscriptionStatus: u.subscriptionStatus,
  }
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile>(DEFAULT_USER)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const refreshUser = useCallback(async () => {
    try {
      const apiUser = await authApi.me()
      setUser(mapApiUser(apiUser))
      setIsAuthenticated(true)
    } catch {
      setIsAuthenticated(false)
    }
  }, [])

  useEffect(() => {
    if (getAccessToken()) {
      refreshUser().finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [refreshUser])

  const updateUser = async (updates: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...updates }))
    // Persist name / avatarUrl to backend
    const patch: { name?: string; avatarUrl?: string } = {}
    if (updates.name) patch.name = updates.name
    if (updates.avatarUrl !== undefined) patch.avatarUrl = updates.avatarUrl ?? ""
    if (Object.keys(patch).length > 0) {
      try { await authApi.updateProfile(patch) } catch { /* silently fail */ }
    }
  }

  return (
    <UserContext.Provider value={{ user, isLoading, isAuthenticated, updateUser, refreshUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error("useUser must be used within UserProvider")
  return ctx
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export const PLAN_LABELS: Record<UserPlan, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  agency: "Agency",
}

export const PLAN_COLORS: Record<UserPlan, string> = {
  free: "bg-muted text-muted-foreground",
  starter: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  pro: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  agency: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
}

export const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Pacific/Auckland",
]
