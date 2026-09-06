"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { platformApi, type PlatformAccount as ApiAccount } from "@/lib/api/platform"
import { getAccessToken } from "@/lib/api/client"
import type { ConnectedAccount, Platform } from "@/lib/types"

function mapApiAccount(a: ApiAccount): ConnectedAccount {
  return {
    platform:        a.platform as Platform,
    connected:       a.isActive,
    username:        a.username,
    displayName:     a.displayName,
    profileImageUrl: a.profileImageUrl ?? undefined,
    connectedAt:     a.createdAt ? new Date(a.createdAt) : undefined,
    accountId:       a._id,
  }
}

interface AccountsContextValue {
  accounts: ConnectedAccount[]
  isLoading: boolean
  getAccount: (platform: Platform) => ConnectedAccount
  saveCookie: (platform: Platform, username: string, cookie: string) => Promise<void>
  disconnect: (platform: Platform) => Promise<void>
  refresh: () => Promise<void>
}

const PLATFORM_LIST: Platform[] = ["x", "linkedin", "instagram"]

const AccountsContext = createContext<AccountsContextValue | null>(null)

export function AccountsProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>(
    PLATFORM_LIST.map((p) => ({ platform: p, connected: false }))
  )
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!getAccessToken()) {
      setAccounts(PLATFORM_LIST.map((platform) => ({ platform, connected: false })))
      return
    }

    setIsLoading(true)
    try {
      const res = await platformApi.list()
      const apiAccounts = res.data.accounts
      setAccounts(
        PLATFORM_LIST.map((platform) => {
          const match = apiAccounts.find((a) => a.platform === platform)
          return match ? mapApiAccount(match) : { platform, connected: false }
        })
      )
    } catch {
      // Not authenticated yet
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!getAccessToken()) return
    refresh()
  }, [refresh])

  const getAccount = (platform: Platform) =>
    accounts.find((a) => a.platform === platform) ?? { platform, connected: false }

  const saveCookie = async (platform: Platform, username: string, cookie: string) => {
    const existing = accounts.find((a) => a.platform === platform)
    if (existing?.connected && existing.accountId) {
      await platformApi.updateCookie(existing.accountId, cookie)
      setAccounts((prev) =>
        prev.map((a) => (a.platform === platform ? { ...a, connected: true } : a))
      )
    } else {
      const res = await platformApi.connect({ platform, username, cookie })
      const account = mapApiAccount(res.data.account)
      setAccounts((prev) => prev.map((a) => (a.platform === platform ? account : a)))
    }
  }

  const disconnect = async (platform: Platform) => {
    const account = accounts.find((a) => a.platform === platform)
    if (!account?.accountId) return
    await platformApi.disconnect(account.accountId)
    setAccounts((prev) =>
      prev.map((a) => (a.platform === platform ? { platform, connected: false } : a))
    )
  }

  return (
    <AccountsContext.Provider value={{ accounts, isLoading, getAccount, saveCookie, disconnect, refresh }}>
      {children}
    </AccountsContext.Provider>
  )
}

export function useAccounts() {
  const ctx = useContext(AccountsContext)
  if (!ctx) throw new Error("useAccounts must be used within AccountsProvider")
  return ctx
}
