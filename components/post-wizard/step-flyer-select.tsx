"use client"

import { useCallback, useState } from "react"
import { Check, Upload, X, ImageIcon, Maximize2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { FLYER_TEMPLATES } from "@/lib/dummy-data"
import { FlyerCanvas } from "@/components/post-wizard/flyer-canvas"
import type { FlyerTemplate } from "@/lib/types"

interface StepFlyerSelectProps {
  selected: FlyerTemplate | null
  customFlyerPreviewUrl: string | null
  onSelect: (template: FlyerTemplate) => void
  onUploadCustomFlyer: (file: File, url: string) => void
  onClearCustomFlyer: () => void
  onSkip: () => void
}

export function StepFlyerSelect({
  selected,
  customFlyerPreviewUrl,
  onSelect,
  onUploadCustomFlyer,
  onClearCustomFlyer,
  onSkip,
}: StepFlyerSelectProps) {
  const [previewTemplate, setPreviewTemplate] = useState<FlyerTemplate | null>(null)

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const url = URL.createObjectURL(file)
      onUploadCustomFlyer(file, url)
    },
    [onUploadCustomFlyer]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files?.[0]
      if (!file || !file.type.startsWith("image/")) return
      const url = URL.createObjectURL(file)
      onUploadCustomFlyer(file, url)
    },
    [onUploadCustomFlyer]
  )

  return (
    <>
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold">Choose a flyer</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Pick a premade template or upload your own
          </p>
        </div>
        <button
          onClick={onSkip}
          className="text-xs text-muted-foreground underline hover:text-foreground transition-colors shrink-0"
        >
          Skip — text only
        </button>
      </div>

      {/* ── Upload your own ────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Upload your own flyer
        </p>

        {customFlyerPreviewUrl ? (
          <div className="relative rounded-xl overflow-hidden border-2 border-primary">
            <img
              src={customFlyerPreviewUrl}
              alt="Your flyer"
              className="w-full max-h-48 object-contain bg-muted/30"
            />
            <div className="absolute inset-0 bg-primary/5" />
            <div className="absolute top-2 right-2 flex items-center gap-1.5">
              <div className="flex items-center gap-1 rounded-full bg-primary/90 text-primary-foreground px-2 py-0.5 text-[10px] font-medium">
                <Check className="size-2.5" />
                Selected
              </div>
              <Button
                variant="secondary"
                size="icon"
                className="size-6 rounded-full bg-background/90 hover:bg-destructive hover:text-destructive-foreground"
                onClick={onClearCustomFlyer}
              >
                <X className="size-3" />
              </Button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-3 py-2">
              <p className="text-[11px] text-white font-medium flex items-center gap-1.5">
                <ImageIcon className="size-3" />
                Custom flyer — will be used as-is in the post
              </p>
            </div>
          </div>
        ) : (
          <label
            htmlFor="custom-flyer-upload"
            className={cn(
              "group flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed p-6 transition-colors",
              "border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5"
            )}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <div className="flex size-10 items-center justify-center rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
              <Upload className="size-4.5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">
                Drop your flyer here or{" "}
                <span className="text-primary">browse files</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                PNG, JPG, WebP — any aspect ratio
              </p>
            </div>
            <input
              id="custom-flyer-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
        )}
      </div>

      {/* ── Divider ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] text-muted-foreground font-medium">or choose a template</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* ── Premade templates — Canva-style full-preview grid ─────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {FLYER_TEMPLATES.map((template) => {
          const isSelected = !customFlyerPreviewUrl && selected?.id === template.id

          return (
            <div
              key={template.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(template)}
              onKeyDown={(e) => e.key === "Enter" && onSelect(template)}
              className={cn(
                "group relative rounded-xl border-2 overflow-hidden cursor-pointer transition-all outline-none",
                "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                "hover:shadow-lg hover:shadow-black/10 active:scale-[.98]",
                isSelected
                  ? "border-primary shadow-md shadow-primary/15"
                  : "border-transparent hover:border-border/70"
              )}
            >
              {/* Full flyer preview — no height clip, shows true aspect ratio */}
              <FlyerCanvas template={template} previewMode />

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all" />

              {/* Preview button — only visible on hover */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPreviewTemplate(template) }}
                  className="flex items-center gap-1 rounded-md bg-black/70 backdrop-blur-sm px-2 py-1 text-[10px] font-medium text-white hover:bg-black/90 transition-colors"
                >
                  <Maximize2 className="size-3" />
                  Preview
                </button>
              </div>

              {/* Selected check */}
              {isSelected && (
                <div className="absolute top-2 left-2 flex size-5 items-center justify-center rounded-full bg-primary shadow-md">
                  <Check className="size-3 text-primary-foreground" />
                </div>
              )}

              {/* Name + ratio bar */}
              <div className="px-2.5 py-2 bg-card flex items-center justify-between gap-1">
                <p className="text-xs font-semibold truncate leading-none">{template.name}</p>
                <Badge variant="secondary" className="text-[9px] py-0 h-4 shrink-0 font-medium">
                  {template.aspectRatio}
                </Badge>
              </div>
            </div>
          )
        })}
      </div>
    </div>

    {/* ── Full-view preview modal ─────────────────────────────────────────────── */}
    <Dialog open={!!previewTemplate} onOpenChange={(v) => !v && setPreviewTemplate(null)}>
      <DialogContent className="max-w-[320px] sm:max-w-sm p-4 gap-3">
        <DialogHeader className="pb-0">
          <DialogTitle className="text-sm">
            {previewTemplate?.name}
            {previewTemplate && (
              <span className="text-muted-foreground font-normal"> · {previewTemplate.aspectRatio}</span>
            )}
          </DialogTitle>
        </DialogHeader>
        {previewTemplate && (
          <>
            <FlyerCanvas
              template={previewTemplate}
              previewMode
              className="rounded-xl overflow-hidden shadow-lg w-full"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  onSelect(previewTemplate)
                  setPreviewTemplate(null)
                }}
              >
                <Check className="size-3.5 mr-1.5" />
                Use this template
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPreviewTemplate(null)}
              >
                Close
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
    </>
  )
}
