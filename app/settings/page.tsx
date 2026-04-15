"use client"

import { Settings } from "lucide-react"
import { ConnectedAccounts } from "@/components/settings/connected-accounts"
import { AIProviders } from "@/components/settings/ai-providers"
import { Separator } from "@/components/ui/separator"

export default function SettingsPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Page header */}
      <div data-tour="page-settings" className="sticky top-0 z-10 bg-background flex items-center gap-3 px-4 py-4 sm:px-6 sm:py-5 border-b">
        <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Settings className="size-4 sm:size-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-semibold leading-tight">Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your account connections and preferences
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-5 sm:gap-8 lg:grid-cols-2 lg:gap-6 max-w-6xl">
          <section>
            <AIProviders />
          </section>
          <section>
            <ConnectedAccounts />
          </section>
        </div>
      </div>
    </div>
  )
}
