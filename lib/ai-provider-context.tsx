"use client"

import { createContext, useContext, useState } from "react"
import type { AIProviderID, AIProviderConfig } from "@/lib/types"

const INITIAL_PROVIDERS: AIProviderConfig[] = [
  { id: "claude", apiKey: "", enabled: false },
  { id: "gemini", apiKey: "", enabled: false },
  { id: "chatgpt", apiKey: "", enabled: false },
]

interface AIProviderContextValue {
  providers: AIProviderConfig[]
  activeProvider: AIProviderConfig | null
  setApiKey: (id: AIProviderID, key: string) => void
  setActiveProvider: (id: AIProviderID) => void
  disableAll: () => void
}

const AIProviderContext = createContext<AIProviderContextValue | null>(null)

export function AIProviderProvider({ children }: { children: React.ReactNode }) {
  const [providers, setProviders] = useState<AIProviderConfig[]>(INITIAL_PROVIDERS)

  const activeProvider = providers.find((p) => p.enabled) ?? null

  const setApiKey = (id: AIProviderID, key: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, apiKey: key } : p))
    )
  }

  // Enabling one provider disables all others (radio-style)
  const setActiveProvider = (id: AIProviderID) => {
    setProviders((prev) =>
      prev.map((p) => ({ ...p, enabled: p.id === id }))
    )
  }

  const disableAll = () => {
    setProviders((prev) => prev.map((p) => ({ ...p, enabled: false })))
  }

  return (
    <AIProviderContext.Provider
      value={{ providers, activeProvider, setApiKey, setActiveProvider, disableAll }}
    >
      {children}
    </AIProviderContext.Provider>
  )
}

export function useAIProvider() {
  const ctx = useContext(AIProviderContext)
  if (!ctx) throw new Error("useAIProvider must be used within AIProviderProvider")
  return ctx
}
