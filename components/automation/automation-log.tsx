"use client"

import { useEffect, useRef } from "react"
import { Loader2, CheckCircle2, XCircle, Info, AlertTriangle, Square } from "lucide-react"
import { XIcon, LinkedInIcon, InstagramIcon } from "@/components/ui/platform-icons"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { AutomationLogEntry, AutomationStatus, Platform } from "@/lib/types"
import { cn } from "@/lib/utils"

const PLATFORM_ICONS: Record<Platform, React.ElementType> = {
  x: XIcon,
  linkedin: LinkedInIcon,
  instagram: InstagramIcon,
}

const PLATFORM_LABELS: Record<Platform, string> = {
  x: "X",
  linkedin: "LinkedIn",
  instagram: "Instagram",
}

interface AutomationLogProps {
  entries: AutomationLogEntry[]
  status: AutomationStatus
  platform: Platform
  onStop: () => void
}

function EntryDot({ status }: { status: AutomationLogEntry["status"] }) {
  if (status === "running") {
    return <Loader2 className="size-3.5 text-zinc-400 animate-spin shrink-0 mt-0.5" />
  }
  if (status === "success") {
    return <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
  }
  if (status === "error") {
    return <XCircle className="size-3.5 text-red-400 shrink-0 mt-0.5" />
  }
  if (status === "warning") {
    return <AlertTriangle className="size-3.5 text-yellow-400 shrink-0 mt-0.5" />
  }
  // info
  return <Info className="size-3.5 text-sky-400 shrink-0 mt-0.5" />
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

export function AutomationLog({ entries, status, platform, onStop }: AutomationLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const PlatformIcon = PLATFORM_ICONS[platform]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [entries])

  const successCount = entries.filter((e) => e.status === "success").length
  const isRunning = status === "running"
  const isCompleted = status === "completed"
  const isError = status === "error"

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <PlatformIcon className="size-3.5 text-zinc-400 shrink-0" />
          <span className="text-xs font-medium text-zinc-200 truncate">
            {PLATFORM_LABELS[platform]} Automation
          </span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] py-0 h-4 px-1.5 border shrink-0",
              isRunning && "border-emerald-700 text-emerald-400 bg-emerald-950/50",
              isCompleted && "border-sky-700 text-sky-400 bg-sky-950/50",
              isError && "border-red-700 text-red-400 bg-red-950/50",
              status === "idle" && "border-zinc-700 text-zinc-400",
              status === "paused" && "border-yellow-700 text-yellow-400 bg-yellow-950/50"
            )}
          >
            {isRunning && (
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Running
              </span>
            )}
            {isCompleted && "Completed"}
            {isError && "Error"}
            {status === "idle" && "Idle"}
            {status === "paused" && "Paused"}
          </Badge>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-zinc-500">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
          {isRunning && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-red-950 hover:border-red-700 hover:text-red-400"
              onClick={onStop}
            >
              <Square className="size-2.5 mr-1" />
              Stop
            </Button>
          )}
        </div>
      </div>

      {/* Log entries */}
      <ScrollArea className="h-64">
        <div className="px-4 py-3 space-y-2 font-mono">
          {entries.length === 0 && (
            <p className="text-xs text-zinc-600 italic">Waiting to start...</p>
          )}
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-2.5">
              <EntryDot status={entry.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[10px] text-zinc-600 shrink-0">
                    {formatTime(entry.timestamp)}
                  </span>
                  <span
                    className={cn(
                      "text-xs leading-snug",
                      entry.status === "success" && "text-zinc-200",
                      entry.status === "error" && "text-red-400",
                      entry.status === "warning" && "text-yellow-300",
                      entry.status === "info" && "text-zinc-400",
                      entry.status === "running" && "text-zinc-400"
                    )}
                  >
                    {entry.message}
                  </span>
                </div>
                {entry.detail && (
                  <p className="text-[10px] text-zinc-600 mt-0.5 pl-0 leading-snug truncate">
                    {entry.detail}
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Summary line */}
          {isCompleted && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800">
              <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
              <span className="text-xs text-emerald-400 font-medium">
                Automation complete — {successCount} action{successCount !== 1 ? "s" : ""} performed
              </span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  )
}
