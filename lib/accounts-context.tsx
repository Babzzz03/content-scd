"use client"

import { createContext, useContext, useState } from "react"
import type { ConnectedAccount, Platform } from "@/lib/types"

const INITIAL_ACCOUNTS: ConnectedAccount[] = [
  { platform: "x", connected: false },
  { platform: "linkedin", connected: false },
  { platform: "instagram", connected: false },
]

interface AccountsContextValue {
  accounts: ConnectedAccount[]
  getAccount: (platform: Platform) => ConnectedAccount
  saveCookie: (platform: Platform, cookie: string) => void
  disconnect: (platform: Platform) => void
}

const AccountsContext = createContext<AccountsContextValue | null>(null)

export function AccountsProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>(INITIAL_ACCOUNTS)

  const getAccount = (platform: Platform) =>
    accounts.find((a) => a.platform === platform) ?? { platform, connected: false }

  const saveCookie = (platform: Platform, cookie: string) => {
    setAccounts((prev) =>
      prev.map((a) =>
        a.platform === platform
          ? { ...a, connected: true, sessionCookie: cookie, connectedAt: new Date() }
          : a
      )
    )
    console.log(`[ACCOUNTS] Cookie saved for ${platform}:`, cookie.slice(0, 8) + "…")
  }

  const disconnect = (platform: Platform) => {
    setAccounts((prev) =>
      prev.map((a) =>
        a.platform === platform
          ? { platform, connected: false, sessionCookie: undefined }
          : a
      )
    )
    console.log(`[ACCOUNTS] Disconnected ${platform}`)
  }

  return (
    <AccountsContext.Provider value={{ accounts, getAccount, saveCookie, disconnect }}>
      {children}
    </AccountsContext.Provider>
  )
}

export function useAccounts() {
  const ctx = useContext(AccountsContext)
  if (!ctx) throw new Error("useAccounts must be used within AccountsProvider")
  return ctx
}
