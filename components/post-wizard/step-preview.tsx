"use client"

import { useRef, useState } from "react"
import {
  Hash,
  CalendarDays,
  BookmarkIcon,
  Copy,
  Layers,
  ImageIcon,
  Plus,
  Trash2,
  Maximize2,
  X,
  FileText,
  Download,
  Eye,
  EyeOff,
  Upload,
} from "lucide-react"
import { FlyerCanvas } from "@/components/post-wizard/flyer-canvas"
import type { FlyerCanvasHandle } from "@/components/post-wizard/flyer-canvas"
import { XIcon, LinkedInIcon, InstagramIcon } from "@/components/ui/platform-icons"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { Platform, PostWizardState, GeneratedPostContent, FlyerContent } from "@/lib/types"
import { FLYER_FONTS, PLATFORM_CONFIG } from "@/lib/types"
import { toast } from "sonner"

const PLATFORM_ICONS: Record<Platform, React.ElementType> = {
  x: XIcon,
  linkedin: LinkedInIcon,
  instagram: InstagramIcon,
}

const PLATFORM_LABELS: Record<Platform, string> = {
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  instagram: "Instagram",
}

interface StepPreviewProps {
  state: PostWizardState
  content: GeneratedPostContent
  onUpdateCaption: (caption: string) => void
  onUpdateFlyer: (idx: number, updates: Partial<FlyerContent>) => void
  onAddFlyer: () => void
  onAddCustomFlyer: (url: string) => void
  onDeleteFlyer: (idx: number) => void
  onUpdateThreadPost: (idx: number, text: string) => void
  onAddThreadPost: () => void
  onDeleteThreadPost: (idx: number) => void
  onSetLogo: (file: File, url: string) => void
  onClearLogo: () => void
  onSchedule: () => void
  onSaveDraft: () => void
  onDuplicate: () => void
}

export function StepPreview({
  state,
  content,
  onUpdateCaption,
  onUpdateFlyer,
  onAddFlyer,
  onAddCustomFlyer,
  onDeleteFlyer,
  onUpdateThreadPost,
  onAddThreadPost,
  onDeleteThreadPost,
  onSetLogo,
  onClearLogo,
  onSchedule,
  onSaveDraft,
  onDuplicate,
}: StepPreviewProps) {
  const [activeFlyerIdx, setActiveFlyerIdx] = useState(0)
  const [showFullView, setShowFullView] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const flyerRef = useRef<FlyerCanvasHandle>(null)

  const PlatformIcon = PLATFORM_ICONS[state.platform]
  const cfg = PLATFORM_CONFIG[state.platform]

  // Clamp active index
  const safeIdx     = Math.min(activeFlyerIdx, Math.max(0, content.flyers.length - 1))
  const activeFlyer = content.flyers[safeIdx]

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(content.caption)
    toast.success("Caption copied to clipboard")
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      // Custom-image flyers: direct link download
      if (activeFlyer?.customImageUrl) {
        const link = document.createElement("a")
        link.download = `custom-flyer-${safeIdx + 1}.png`
        link.href = activeFlyer.customImageUrl
        link.click()
        toast.success("Flyer downloaded")
        return
      }
      if (!flyerRef.current) return
      const safeName = (activeFlyer?.text ?? "flyer").slice(0, 20).replace(/\s+/g, "-").toLowerCase()
      await flyerRef.current.downloadImage(`${safeName}-flyer-${safeIdx + 1}.png`)
      toast.success("Flyer downloaded")
    } catch (err) {
      console.error("[DOWNLOAD]", err)
      toast.error("Download failed", { description: "Please try again" })
    } finally {
      setIsDownloading(false)
    }
  }

  const captionLength = content.caption.length
  const isOverLimit   = captionLength > cfg.charLimit

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold">Preview your post</h3>
        <p className="text-sm text-muted-foreground mt-1">
          All fields are editable — changes update the preview live
        </p>
      </div>

      {/* Platform + post type badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1">
          <PlatformIcon className="size-3.5" />
          <span className="text-xs font-medium">{PLATFORM_LABELS[state.platform]}</span>
        </div>
        <Badge variant="outline" className="text-xs capitalize">{state.postType}</Badge>
        {state.aiInput.useBrandVoice && (
          <Badge variant="secondary" className="text-xs">Brand Voice On</Badge>
        )}
        <span className="text-[10px] text-muted-foreground ml-auto">{cfg.captionHint}</span>
      </div>

      {/* ── Custom flyer preview ───────────────────────────────────────────────── */}
      {state.customFlyerPreviewUrl && (
        <div className="relative rounded-xl overflow-hidden border-2 border-primary/40">
          <img
            src={state.customFlyerPreviewUrl}
            alt="Your flyer"
            className="w-full max-h-64 object-contain bg-muted/20"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/50 to-transparent px-3 py-2">
            <p className="text-[11px] text-white font-medium flex items-center gap-1.5">
              <ImageIcon className="size-3" />
              Your custom flyer
            </p>
          </div>
        </div>
      )}

      {/* ── Template flyer section ─────────────────────────────────────────────── */}
      {state.selectedFlyer && !state.customFlyerPreviewUrl && content.flyers.length > 0 && (
        <div className="space-y-3">
          {/* Flyer tabs + add button */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              {state.platform === "instagram" && state.postType === "carousel"
                ? "Flyers (= carousel slides)"
                : state.platform === "linkedin" && state.postType === "carousel"
                ? "Cover Flyer"
                : "Flyers"}
            </span>
            {content.flyers.map((f, i) => (
              <button
                key={f.id}
                onClick={() => setActiveFlyerIdx(i)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                  safeIdx === i
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                )}
              >
                {state.platform === "instagram" && state.postType === "carousel"
                  ? `Slide ${i + 1}`
                  : `Flyer ${i + 1}`}
              </button>
            ))}
            {!(state.platform === "linkedin" && state.postType === "carousel") && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px] px-2.5 gap-1"
                  onClick={() => { onAddFlyer(); setActiveFlyerIdx(content.flyers.length) }}
                >
                  <Plus className="size-3" />Add
                </Button>
                <label
                  htmlFor="upload-custom-flyer-preview"
                  className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-2.5 text-[11px] font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                >
                  <Upload className="size-3" />Upload
                  <input
                    id="upload-custom-flyer-preview"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const url = URL.createObjectURL(file)
                      onAddCustomFlyer(url)
                      setActiveFlyerIdx(content.flyers.length)
                      e.target.value = ""
                    }}
                  />
                </label>
              </>
            )}
          </div>

          {/* Canvas preview + controls */}
          {activeFlyer && (
            <>
              <div className="relative">
                <div className="mx-auto w-full max-w-[200px] rounded-xl overflow-hidden border border-border/50 shadow-md">
                  {activeFlyer.customImageUrl ? (
                    /* Plain uploaded image — renders as-is */
                    <img
                      src={activeFlyer.customImageUrl}
                      alt={`Flyer ${safeIdx + 1}`}
                      className="w-full block"
                    />
                  ) : (
                    <FlyerCanvas
                      ref={flyerRef}
                      enableDownload
                      template={state.selectedFlyer}
                      imageUrl={activeFlyer.imageUrl ?? state.imagePreviewUrl}
                      text={activeFlyer.text}
                      subtext={activeFlyer.subtext}
                      fontFamily={activeFlyer.fontFamily}
                      headlineColor={activeFlyer.headlineColor}
                      accentColor={activeFlyer.accentColor}
                      categoryLabel={activeFlyer.categoryLabel}
                      logoUrl={state.logoPreviewUrl}
                      hideTag={activeFlyer.hideTag}
                      hideHeadline={activeFlyer.hideHeadline}
                      hideSubtext={activeFlyer.hideSubtext}
                      hideLogo={activeFlyer.hideLogo}
                    />
                  )}
                </div>
                <button
                  onClick={() => setShowFullView(true)}
                  className="absolute top-2 right-[calc(50%-100px+8px)] flex items-center gap-1 rounded-md bg-black/60 backdrop-blur-sm px-2 py-1 text-[10px] font-medium text-white hover:bg-black/80 transition-colors"
                >
                  <Maximize2 className="size-3" />Full view
                </button>
              </div>

              {/* Download + visibility toggles */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-muted-foreground font-medium">Show:</span>
                  {([
                    { flag: "hideTag",      label: "Tag" },
                    { flag: "hideHeadline", label: "Headline" },
                    { flag: "hideSubtext",  label: "Description" },
                    { flag: "hideLogo",     label: "Logo" },
                  ] as const).map(({ flag, label }) => {
                    const isHidden = !!activeFlyer[flag]
                    return (
                      <button
                        key={flag}
                        onClick={() => onUpdateFlyer(safeIdx, { [flag]: !isHidden })}
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors",
                          !isHidden
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-muted border-border text-muted-foreground/50 line-through"
                        )}
                      >
                        {!isHidden ? <Eye className="size-2.5" /> : <EyeOff className="size-2.5" />}
                        {label}
                      </button>
                    )
                  })}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] gap-1.5"
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  <Download className="size-3.5" />
                  {isDownloading ? "Downloading…" : "Download PNG"}
                </Button>
              </div>

              {/* Always-editable flyer fields */}
              <div className="rounded-lg border bg-muted/30 divide-y divide-border/60">

                {activeFlyer.customImageUrl ? (
                  /* ── Custom uploaded image — only show replace option ── */
                  <div className="px-3 py-2.5 space-y-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block">
                      Uploaded image
                    </label>
                    <label
                      htmlFor={`replace-custom-flyer-${safeIdx}`}
                      className="flex items-center gap-2.5 cursor-pointer rounded-lg border border-dashed border-muted-foreground/25 px-3 py-2 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    >
                      <Upload className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">Replace with a different image</span>
                      <input
                        id={`replace-custom-flyer-${safeIdx}`}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const url = URL.createObjectURL(file)
                          onUpdateFlyer(safeIdx, { customImageUrl: url })
                          e.target.value = ""
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <>
                    {/* Background image (per-flyer) */}
                    <div className="px-3 py-2.5 space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block">
                        Background image
                      </label>
                      {activeFlyer.imageUrl ? (
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-md border bg-muted/40 overflow-hidden shrink-0">
                            <img src={activeFlyer.imageUrl} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">Custom background</p>
                            <p className="text-[10px] text-muted-foreground">Used only for this flyer</p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => onUpdateFlyer(safeIdx, { imageUrl: null })}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <label
                          htmlFor={`bg-image-flyer-${safeIdx}`}
                          className="flex items-center gap-2.5 cursor-pointer rounded-lg border border-dashed border-muted-foreground/25 px-3 py-2 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                        >
                          <ImageIcon className="size-3.5 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-xs font-medium">Upload background</p>
                            <p className="text-[10px] text-muted-foreground">
                              {state.imagePreviewUrl ? "Override the shared image for this flyer only" : "Add a background image for this flyer"}
                            </p>
                          </div>
                          <input
                            id={`bg-image-flyer-${safeIdx}`}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="sr-only"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              const url = URL.createObjectURL(file)
                              onUpdateFlyer(safeIdx, { imageUrl: url })
                              e.target.value = ""
                            }}
                          />
                        </label>
                      )}
                    </div>

                    {/* Tag */}
                    <div className="px-3 py-2.5 space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block">
                        Tag / Category
                      </label>
                      <input
                        value={activeFlyer.categoryLabel ?? ""}
                        onChange={(e) => onUpdateFlyer(safeIdx, { categoryLabel: e.target.value || undefined })}
                        placeholder={`Default: "${state.selectedFlyer.categoryLabel ?? "BREAKING"}" — type to override`}
                        className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
                      />
                    </div>

                    {/* Headline */}
                    <div className="px-3 py-2.5 space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block">
                        Headline
                      </label>
                      <Textarea
                        value={activeFlyer.text}
                        onChange={(e) => onUpdateFlyer(safeIdx, { text: e.target.value })}
                        rows={2}
                        className="text-sm resize-none"
                        placeholder="Bold headline on the flyer…"
                      />
                    </div>

                    {/* Description */}
                    <div className="px-3 py-2.5 space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block">
                        Description
                      </label>
                      <Textarea
                        value={activeFlyer.subtext ?? ""}
                        onChange={(e) => onUpdateFlyer(safeIdx, { subtext: e.target.value || undefined })}
                        rows={2}
                        className="text-sm resize-none"
                        placeholder="Short description below the headline (optional)…"
                      />
                    </div>

                    {/* Typography */}
                    <div className="px-3 py-2.5 space-y-2">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block">
                        Typography
                      </label>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {FLYER_FONTS.map((f) => {
                          const isActive = (activeFlyer.fontFamily ?? "") === (f.id === "default" ? "" : f.css)
                          return (
                            <button
                              key={f.id}
                              onClick={() => onUpdateFlyer(safeIdx, { fontFamily: f.id === "default" ? undefined : f.css })}
                              className={cn(
                                "shrink-0 px-3 py-1.5 rounded-lg border text-xs transition-colors whitespace-nowrap",
                                isActive
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                              )}
                              style={{ fontFamily: f.css }}
                            >
                              {f.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Colors */}
                    <div className="px-3 py-2.5 space-y-2">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block">
                        Colors
                      </label>
                      <div className="flex items-center gap-5">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <div className="relative">
                            <input
                              type="color"
                              value={activeFlyer.headlineColor ?? "#ffffff"}
                              onChange={(e) => onUpdateFlyer(safeIdx, { headlineColor: e.target.value })}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              title="Headline color"
                            />
                            <div
                              className="w-7 h-7 rounded-md border-2 border-border group-hover:border-primary/60 transition-colors shadow-sm"
                              style={{ background: activeFlyer.headlineColor ?? "#ffffff" }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">Headline</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <div className="relative">
                            <input
                              type="color"
                              value={activeFlyer.accentColor ?? state.selectedFlyer.accentColor ?? "#22c55e"}
                              onChange={(e) => onUpdateFlyer(safeIdx, { accentColor: e.target.value })}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              title="Accent color"
                            />
                            <div
                              className="w-7 h-7 rounded-md border-2 border-border group-hover:border-primary/60 transition-colors shadow-sm"
                              style={{ background: activeFlyer.accentColor ?? state.selectedFlyer.accentColor ?? "#22c55e" }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">Accent</span>
                        </label>
                        {(activeFlyer.headlineColor || activeFlyer.accentColor) && (
                          <button
                            onClick={() => onUpdateFlyer(safeIdx, { headlineColor: undefined, accentColor: undefined })}
                            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                          >
                            <X className="size-2.5" />Reset
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Logo — always shown regardless of flyer type */}
                <div className="px-3 py-2.5 space-y-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block">
                    Logo
                  </label>
                  {state.logoPreviewUrl ? (
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-md border bg-muted/40 overflow-hidden flex items-center justify-center shrink-0">
                        <img
                          src={state.logoPreviewUrl}
                          alt="Logo"
                          className="w-full h-full object-contain p-1"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">Logo uploaded</p>
                        <p className="text-[10px] text-muted-foreground">Use the toggle above to show/hide per flyer</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={onClearLogo}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <label
                      htmlFor="logo-upload"
                      className="flex items-center gap-2.5 cursor-pointer rounded-lg border border-dashed border-muted-foreground/25 px-3 py-2.5 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    >
                      <div className="size-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Upload className="size-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-medium">Upload logo</p>
                        <p className="text-[10px] text-muted-foreground">PNG or SVG recommended — shown on all flyers</p>
                      </div>
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const url = URL.createObjectURL(file)
                          onSetLogo(file, url)
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Delete flyer */}
              {content.flyers.length > 1 && (
                <button
                  onClick={() => {
                    onDeleteFlyer(safeIdx)
                    setActiveFlyerIdx(Math.max(0, safeIdx - 1))
                  }}
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="size-3" />
                  Remove {state.platform === "instagram" && state.postType === "carousel" ? `Slide ${safeIdx + 1}` : `Flyer ${safeIdx + 1}`}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Full-view modal ───────────────────────────────────────────────────── */}
      <Dialog open={showFullView} onOpenChange={setShowFullView}>
        <DialogContent className="max-w-xs sm:max-w-sm p-4 gap-3">
          <DialogHeader className="pb-0">
            <DialogTitle className="text-sm">
              {state.platform === "instagram" && state.postType === "carousel"
                ? `Slide ${safeIdx + 1} · Full View`
                : `Flyer ${safeIdx + 1} · Full View`}
            </DialogTitle>
          </DialogHeader>
          {activeFlyer && (
            activeFlyer.customImageUrl ? (
              <img
                src={activeFlyer.customImageUrl}
                alt={`Flyer ${safeIdx + 1}`}
                className="w-full rounded-xl shadow-lg block"
              />
            ) : state.selectedFlyer ? (
              <FlyerCanvas
                template={state.selectedFlyer}
                imageUrl={activeFlyer.imageUrl ?? state.imagePreviewUrl}
                text={activeFlyer.text}
                subtext={activeFlyer.subtext}
                fontFamily={activeFlyer.fontFamily}
                headlineColor={activeFlyer.headlineColor}
                accentColor={activeFlyer.accentColor}
                categoryLabel={activeFlyer.categoryLabel}
                logoUrl={state.logoPreviewUrl}
                hideTag={activeFlyer.hideTag}
                hideHeadline={activeFlyer.hideHeadline}
                hideSubtext={activeFlyer.hideSubtext}
                hideLogo={activeFlyer.hideLogo}
                className="rounded-xl overflow-hidden shadow-lg"
              />
            ) : null
          )}
        </DialogContent>
      </Dialog>

      {/* ── X Thread ──────────────────────────────────────────────────────────── */}
      {state.platform === "x" && state.postType === "thread" && content.threadPosts && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Thread · {content.threadPosts.length} tweets
            </Label>
            <span className="text-[10px] text-muted-foreground">Each tweet ≤ 280 chars</span>
          </div>

          <div className="space-y-2">
            {content.threadPosts.map((post, idx) => {
              const overLimit = post.length > 280
              return (
                <div key={idx} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="size-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">
                      {idx + 1}
                    </div>
                    {idx < content.threadPosts!.length - 1 && (
                      <div className="w-0.5 flex-1 bg-border min-h-3 my-1" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5 pb-1">
                    <Textarea
                      value={post}
                      onChange={(e) => onUpdateThreadPost(idx, e.target.value)}
                      rows={3}
                      className="text-sm resize-none"
                      placeholder={`Tweet ${idx + 1}…`}
                    />
                    <div className="flex items-center justify-between">
                      <span className={cn("text-[10px] font-medium", overLimit ? "text-destructive" : "text-muted-foreground")}>
                        {post.length}/280{overLimit && " — over limit"}
                      </span>
                      {content.threadPosts!.length > 2 && (
                        <button
                          onClick={() => onDeleteThreadPost(idx)}
                          className="text-[10px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="size-2.5" />Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            onClick={onAddThreadPost}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 py-2.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Plus className="size-3.5" />Add tweet to thread
          </button>
        </div>
      )}

      {/* ── LinkedIn / Instagram Carousel slides ─────────────────────────────── */}
      {(state.postType === "carousel") && content.carouselSlides && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="size-3.5 text-muted-foreground" />
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              {state.platform === "linkedin"
                ? `Document Carousel · ${content.carouselSlides.length} slides`
                : `Carousel · ${content.carouselSlides.length} slides`}
            </Label>
          </div>
          {state.platform === "linkedin" && (
            <p className="text-[10px] text-muted-foreground bg-muted/50 rounded-md px-2.5 py-2">
              These slides will be compiled into a PDF document. Viewers swipe through them on LinkedIn.
            </p>
          )}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {content.carouselSlides.map((slide, idx) => (
              <div
                key={idx}
                className={cn(
                  "shrink-0 w-36 rounded-lg border p-2.5 text-center",
                  idx === 0 ? "bg-primary/10 border-primary/30" : "bg-muted/30"
                )}
              >
                <p className="text-[9px] font-bold text-muted-foreground mb-1">SLIDE {idx + 1}</p>
                <p className="text-[10px] font-bold leading-snug">{slide.text}</p>
                <p className="text-[9px] text-muted-foreground mt-1 leading-snug line-clamp-3">{slide.subtext}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Caption / Tweet / Post ─────────────────────────────────────────────── */}
      {state.postType !== "thread" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>
              {cfg.captionLabel}
              {cfg.seoFold && (
                <span className="text-muted-foreground font-normal text-xs ml-1.5">
                  · first {cfg.seoFold} chars visible before "more"
                </span>
              )}
            </Label>
            <button
              onClick={handleCopyCaption}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy className="size-3" />Copy
            </button>
          </div>

          <Textarea
            value={content.caption}
            onChange={(e) => onUpdateCaption(e.target.value)}
            rows={state.platform === "linkedin" ? 8 : state.platform === "instagram" ? 6 : 4}
            className="text-sm"
            placeholder={`Write your ${cfg.captionLabel.toLowerCase()} here…`}
          />

          <div className="flex items-center justify-between">
            <span className={cn("text-[10px] font-medium", isOverLimit ? "text-destructive" : "text-muted-foreground")}>
              {captionLength.toLocaleString()} / {cfg.charLimit.toLocaleString()} chars
              {isOverLimit && " — over limit"}
            </span>
            {cfg.seoFold && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                First {cfg.seoFold} chars shown without tapping "more"
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Hashtags ─────────────────────────────────────────────────────────── */}
      {content.hashtags.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            <Hash className="size-3 inline mr-1" />
            Suggested hashtags
            <span className="ml-1 text-muted-foreground/60">
              ({cfg.hashtagRange[0]}–{cfg.hashtagRange[1]} recommended for {PLATFORM_LABELS[state.platform]})
            </span>
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {content.hashtags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs cursor-pointer">{tag}</Badge>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* ── Actions ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <Button onClick={onSchedule} className="col-span-3 sm:col-span-1">
          <CalendarDays data-icon="inline-start" />
          Schedule
        </Button>
        <Button variant="outline" onClick={onSaveDraft}>
          <BookmarkIcon data-icon="inline-start" />
          Save Draft
        </Button>
        <Button variant="outline" onClick={onDuplicate}>
          <Copy data-icon="inline-start" />
          Duplicate
        </Button>
      </div>
    </div>
  )
}
