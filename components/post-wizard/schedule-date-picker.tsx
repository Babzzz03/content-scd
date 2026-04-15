"use client"

import { useState } from "react"
import { CalendarDays, Clock, CheckCircle2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

const QUICK_TIMES = [
  { label: "9:00 AM", hour: 9, minute: 0 },
  { label: "12:00 PM", hour: 12, minute: 0 },
  { label: "3:00 PM", hour: 15, minute: 0 },
  { label: "6:00 PM", hour: 18, minute: 0 },
  { label: "8:00 PM", hour: 20, minute: 0 },
]

function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

interface ScheduleDatePickerProps {
  open: boolean
  onClose: () => void
  onConfirm: (date: Date) => void
}

export function ScheduleDatePicker({ open, onClose, onConfirm }: ScheduleDatePickerProps) {
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined)
  const [selectedHour, setSelectedHour] = useState(9)
  const [selectedMinute, setSelectedMinute] = useState(0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const scheduledDate = selectedDay
    ? new Date(
        selectedDay.getFullYear(),
        selectedDay.getMonth(),
        selectedDay.getDate(),
        selectedHour,
        selectedMinute,
        0
      )
    : null

  const isPast = scheduledDate ? scheduledDate <= new Date() : false
  const canConfirm = scheduledDate !== null && !isPast

  const applyQuickTime = (hour: number, minute: number) => {
    setSelectedHour(hour)
    setSelectedMinute(minute)
  }

  const handleConfirm = () => {
    if (!scheduledDate) return
    onConfirm(scheduledDate)
    // reset
    setSelectedDay(undefined)
    setSelectedHour(9)
    setSelectedMinute(0)
  }

  const handleClose = () => {
    setSelectedDay(undefined)
    setSelectedHour(9)
    setSelectedMinute(0)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 border-b">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            <DialogTitle className="text-base">Schedule Post</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Pick the date and time you want this post to go out
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 py-4 space-y-4">
          {/* Calendar */}
          <Calendar
            mode="single"
            selected={selectedDay}
            onSelect={setSelectedDay}
            disabled={{ before: today }}
            className="rounded-lg border w-full"
          />

          {/* Time picker */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="size-3" />
              Time
            </Label>

            {/* Quick time buttons */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TIMES.map((qt) => {
                const isActive = selectedHour === qt.hour && selectedMinute === qt.minute
                return (
                  <button
                    key={qt.label}
                    onClick={() => applyQuickTime(qt.hour, qt.minute)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-accent"
                    }`}
                  >
                    {qt.label}
                  </button>
                )
              })}
            </div>

            {/* Manual time input */}
            <div className="flex items-center gap-2">
              <select
                value={selectedHour}
                onChange={(e) => setSelectedHour(Number(e.target.value))}
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, "0")}:00{" "}
                    {i === 0 ? "(midnight)" : i === 12 ? "(noon)" : i < 12 ? "AM" : "PM"}
                  </option>
                ))}
              </select>
              <span className="text-muted-foreground text-sm">:</span>
              <select
                value={selectedMinute}
                onChange={(e) => setSelectedMinute(Number(e.target.value))}
                className="w-24 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary */}
          {scheduledDate && (
            <div
              className={`rounded-lg border px-3 py-2.5 text-sm flex items-center gap-2 ${
                isPast
                  ? "border-destructive/40 bg-destructive/5 text-destructive"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
              }`}
            >
              <CheckCircle2 className="size-4 shrink-0" />
              <span className="font-medium">
                {isPast ? "This time has already passed" : formatDateTime(scheduledDate)}
              </span>
            </div>
          )}
        </div>

        <Separator />

        <div className="flex gap-2 px-5 py-4">
          <Button variant="outline" className="flex-1" onClick={handleClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleConfirm} disabled={!canConfirm}>
            <CalendarDays data-icon="inline-start" />
            Confirm Schedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
