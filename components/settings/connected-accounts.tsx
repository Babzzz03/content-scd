"use client"

import { useState } from "react"
import {
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Unlink,
  Cookie,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Copy,
  Check,
  Loader2,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { XIcon, LinkedInIcon, InstagramIcon } from "@/components/ui/platform-icons"
import { useAccounts } from "@/lib/accounts-context"
import { platformApi } from "@/lib/api/platform"
import type { ConnectedAccount, Platform } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ─── Platform metadata ────────────────────────────────────────────────────────

const PLATFORM_META: Record<
  Platform,
  {
    label: string
    icon: React.ElementType
    color: string
    bg: string
    border: string
    cookieName: string
    cookiePlaceholder: string
    steps: { action: string; detail: string }[]
  }
> = {
  x: {
    label: "X (Twitter)",
    icon: XIcon,
    color: "text-sky-600",
    bg: "bg-sky-50 dark:bg-sky-950/30",
    border: "border-sky-200 dark:border-sky-800",
    cookieName: "auth_token",
    cookiePlaceholder: "e.g. a1b2c3d4e5f6a1b2c3d4…",
    steps: [
      { action: "Go to x.com and make sure you're logged in", detail: "" },
      { action: "Open DevTools", detail: "F12 on Windows / Cmd+Option+I on Mac" },
      { action: "Application → Cookies → https://x.com", detail: "Left panel in Chrome/Edge, Storage tab in Firefox" },
      { action: "Find the cookie named auth_token", detail: "Copy the full Value column" },
      { action: "Paste it below along with your @handle", detail: "" },
    ],
  },
  linkedin: {
    label: "LinkedIn",
    icon: LinkedInIcon,
    color: "text-blue-700",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    cookieName: "li_at",
    cookiePlaceholder: "e.g. AQEDARab1cDe…",
    steps: [
      { action: "Go to linkedin.com and make sure you're logged in", detail: "" },
      { action: "Open DevTools", detail: "F12 on Windows / Cmd+Option+I on Mac" },
      { action: "Application → Cookies → https://www.linkedin.com", detail: "Left panel in Chrome/Edge" },
      { action: "Find the cookie named li_at", detail: "Copy the full Value column" },
      { action: "Paste it below along with your LinkedIn username", detail: "" },
    ],
  },
  instagram: {
    label: "Instagram",
    icon: InstagramIcon,
    color: "text-pink-600",
    bg: "bg-pink-50 dark:bg-pink-950/30",
    border: "border-pink-200 dark:border-pink-800",
    cookieName: "sessionid",
    cookiePlaceholder: "e.g. 12345678%3AabcXYZ…",
    steps: [
      { action: "Go to instagram.com and make sure you're logged in", detail: "" },
      { action: "Open DevTools", detail: "F12 on Windows / Cmd+Option+I on Mac" },
      { action: "Application → Cookies → https://www.instagram.com", detail: "Left panel in Chrome/Edge" },
      { action: "Find the cookie named sessionid", detail: "Copy the full Value column" },
      { action: "Paste it below along with your Instagram username", detail: "" },
    ],
  },
}

// ─── Account card ─────────────────────────────────────────────────────────────

interface AccountCardProps {
  account: ConnectedAccount
  onSave: (platform: Platform, username: string, cookie: string) => Promise<void>
  onDisconnect: (platform: Platform) => Promise<void>
  onVerify: (platform: Platform) => Promise<void>
}

function AccountCard({ account, onSave, onDisconnect, onVerify }: AccountCardProps) {
  const meta = PLATFORM_META[account.platform]
  const Icon = meta.icon

  const [username, setUsername] = useState(account.username ?? "")
  const [draft, setDraft] = useState("")
  const [showCookie, setShowCookie] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const isConnected = account.connected
  const canSave = username.trim().length > 0 && draft.trim().length > 0

  const handleSave = async () => {
    if (!canSave) {
      toast.error("Enter your username and paste the cookie value")
      return
    }
    setSaving(true)
    try {
      await onSave(account.platform, username.trim().replace(/^@/, ""), draft.trim())
      setDraft("")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await onDisconnect(account.platform)
    } catch {
      toast.error("Failed to disconnect")
    } finally {
      setDisconnecting(false)
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    try {
      await onVerify(account.platform)
    } catch {
      toast.error("Verification failed. Please refresh your cookie.")
    } finally {
      setVerifying(false)
    }
  }

  const handleCopyUsername = async () => {
    if (!account.username) return
    await navigator.clipboard.writeText(account.username)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className={cn(
      "rounded-xl border transition-colors overflow-hidden",
      isConnected ? cn(meta.bg, meta.border) : "border-border bg-card"
    )}>
      {/* Header row */}
      <div className="flex items-start gap-4 p-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background">
          <Icon className={cn("size-5", meta.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{meta.label}</p>
            {isConnected ? (
              <Badge className="text-[10px] h-4 px-1.5 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400">
                <CheckCircle2 className="size-2.5 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">
                <XCircle className="size-2.5 mr-1" />
                Not connected
              </Badge>
            )}
          </div>

          {isConnected && account.username ? (
            <div className="flex items-center gap-1 mt-0.5">
              <p className="text-xs text-muted-foreground">@{account.username}</p>
              <button onClick={handleCopyUsername} className="text-muted-foreground hover:text-foreground transition-colors">
                {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              Paste your <code className="font-mono bg-muted px-1 rounded text-[10px]">{meta.cookieName}</code> cookie to enable automation
            </p>
          )}
        </div>

        {isConnected && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleVerify}
              disabled={verifying || disconnecting}
            >
              {verifying
                ? <Loader2 className="size-3 mr-1 animate-spin" />
                : <ShieldCheck className="size-3 mr-1" />}
              Verify
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs text-destructive hover:text-destructive"
              onClick={handleDisconnect}
              disabled={disconnecting || verifying}
            >
              {disconnecting
                ? <Loader2 className="size-3 mr-1 animate-spin" />
                : <Unlink className="size-3 mr-1" />}
              Disconnect
            </Button>
          </div>
        )}
      </div>

      <Separator />

      {/* Cookie input area */}
      <div className="p-5 space-y-4">

        {/* Username field */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {account.platform === "x" ? "@handle" : "Username"}
          </Label>
          <Input
            placeholder={account.platform === "x" ? "@yourhandle" : "yourusername"}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="text-sm"
            autoComplete="off"
          />
        </div>

        {/* Cookie field */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Cookie className="size-3" />
            {meta.cookieName} cookie value
          </Label>
          <div className="relative">
            <Input
              type={showCookie ? "text" : "password"}
              placeholder={meta.cookiePlaceholder}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="pr-9 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => setShowCookie((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showCookie ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
        </div>


        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowInstructions((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {showInstructions ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            How to find this cookie
          </button>

          {canSave && (
            <Button size="sm" className="h-7 px-3 text-xs" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-3 mr-1 animate-spin" />}
              {isConnected ? "Update Cookie" : "Save & Connect"}
            </Button>
          )}
        </div>

        {/* Step-by-step instructions */}
        {showInstructions && (
          <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
            <p className="text-xs font-medium">
              How to get your{" "}
              <code className="font-mono bg-background border rounded px-1 py-0.5">{meta.cookieName}</code> cookie
            </p>

            <div className="rounded-md bg-background border px-3 py-2 flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">💡</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">Easiest way:</span> Install the{" "}
                <span className="font-medium text-foreground">Cookie-Editor</span> browser extension
                (Chrome/Firefox). Open it on the platform page, find{" "}
                <code className="font-mono bg-muted px-1 rounded">{meta.cookieName}</code>, and copy the value.
              </p>
            </div>

            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Manual (DevTools)</p>
            <ol className="space-y-2">
              {meta.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs">
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <span>
                    <span className="text-foreground">{step.action}</span>
                    {step.detail && (
                      <span className="text-muted-foreground"> — {step.detail}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ConnectedAccounts() {
  const { accounts, saveCookie, disconnect, refresh } = useAccounts()

  const handleSave = async (platform: Platform, username: string, cookie: string) => {
    await saveCookie(platform, username, cookie)
    toast.success(`${PLATFORM_META[platform].label} connected!`, {
      description: "Cookie saved — automation is ready",
    })
  }

  const handleDisconnect = async (platform: Platform) => {
    await disconnect(platform)
    toast.success(`${PLATFORM_META[platform].label} disconnected`)
  }

  const handleVerify = async (platform: Platform) => {
    const account = accounts.find((a) => a.platform === platform)
    if (!account?.accountId) return
    const res = await platformApi.verify(account.accountId)
    const valid = (res as { data: { valid: boolean } }).data?.valid
    if (valid) {
      toast.success(`${PLATFORM_META[platform].label} cookie is valid`, {
        description: "Your session is active and ready to post",
      })
    } else {
      toast.error(`${PLATFORM_META[platform].label} cookie is expired`, {
        description: "Please paste a fresh cookie value to restore automation",
        duration: 7000,
      })
    }
    await refresh()
  }

  const connectedCount = accounts.filter((a) => a.connected).length

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <Cookie className="size-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Platform Connections</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {connectedCount === 0
              ? "Connect your accounts using session cookies"
              : `${connectedCount} of 3 platforms connected`}
          </p>
        </div>
        {connectedCount > 0 && (
          <Badge variant="secondary" className="ml-auto text-xs">
            <CheckCircle2 className="size-3 mr-1 text-emerald-600" />
            {connectedCount} active
          </Badge>
        )}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 flex items-start gap-3">
        <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Keep your cookies private</p>
          <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
            Session cookies give full access to your account. Never share them. They expire when you
            log out of the platform — paste a fresh cookie if automation stops working.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {accounts.map((account) => (
          <AccountCard
            key={account.platform}
            account={account}
            onSave={handleSave}
            onDisconnect={handleDisconnect}
            onVerify={handleVerify}
          />
        ))}
      </div>
    </div>
  )
}
