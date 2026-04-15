"use client"

import { createContext, useContext, useState } from "react"

export type UserPlan = "free" | "pro" | "enterprise"

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
}

interface UserContextValue {
  user: UserProfile
  updateUser: (updates: Partial<UserProfile>) => void
}

const DEFAULT_USER: UserProfile = {
  name: "Nova Studio",
  email: "hello@novastudio.com",
  bio: "Content creator & marketer building in public.",
  plan: "pro",
  timezone: "America/New_York",
  avatarUrl: null,
  notifyScheduled: true,
  notifyPublished: true,
  notifyFailed: true,
  joinedAt: new Date("2024-01-15"),
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile>(DEFAULT_USER)

  const updateUser = (updates: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...updates }))
  }

  return (
    <UserContext.Provider value={{ user, updateUser }}>
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
  pro: "Pro",
  enterprise: "Enterprise",
}

export const PLAN_COLORS: Record<UserPlan, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  enterprise: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
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
