"use client"

import { useCallback } from "react"
import { Upload, ImageIcon, X, Sparkles, Info, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { FlyerTemplate, Platform, PostType } from "@/lib/types"

// ── Platform-aware dimension specs ────────────────────────────────────────────
const DIMENSION_HINTS: Partial<Record<Platform, Partial<Record<string, { label: string; dims: string; aspect: string; multiple?: boolean }[]>>>> = {
  instagram: {
    single:   [{ label: "Square (recommended)", dims: "1080 × 1080 px", aspect: "1:1" }, { label: "Portrait", dims: "1080 × 1350 px", aspect: "4:5" }, { label: "Landscape", dims: "1080 × 566 px", aspect: "1.91:1" }],
    carousel: [{ label: "Square (recommended)", dims: "1080 × 1080 px", aspect: "1:1", multiple: true }, { label: "Portrait", dims: "1080 × 1350 px", aspect: "4:5", multiple: true }],
    story:    [{ label: "Story / Reel", dims: "1080 × 1920 px", aspect: "9:16" }],
    reel:     [{ label: "Reel", dims: "1080 × 1920 px", aspect: "9:16" }],
  },
  x: {
    single:   [{ label: "Landscape (recommended)", dims: "1200 × 675 px", aspect: "16:9" }, { label: "Square", dims: "1200 × 1200 px", aspect: "1:1" }],
    thread:   [{ label: "Landscape (recommended)", dims: "1200 × 675 px", aspect: "16:9" }, { label: "Square", dims: "1200 × 1200 px", aspect: "1:1" }],
  },
  linkedin: {
    image:    [{ label: "Landscape (recommended)", dims: "1200 × 627 px", aspect: "1.91:1" }, { label: "Square", dims: "1080 × 1080 px", aspect: "1:1" }],
    carousel: [{ label: "Portrait (recommended)", dims: "1080 × 1350 px", aspect: "4:5", multiple: true }, { label: "Square", dims: "1080 × 1080 px", aspect: "1:1", multiple: true }],
    text:     [],
  },
}

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

interface StepImageUploadProps {
  platform: Platform
  postType: PostType | null
  selectedFlyer: FlyerTemplate | null
  imageSuggestion: string
  // Single-image (flyer background)
  imagePreviewUrl: string | null
  onImageSelect: (file: File, previewUrl: string) => void
  onImageClear: () => void
  // Multi-image (carousel / standard)
  imageFiles: File[]
  imagePreviewUrls: string[]
  onImagesChange: (files: File[], urls: string[]) => void
}

export function StepImageUpload({
  platform,
  postType,
  selectedFlyer,
  imageSuggestion,
  imagePreviewUrl,
  onImageSelect,
  onImageClear,
  imageFiles,
  imagePreviewUrls,
  onImagesChange,
}: StepImageUploadProps) {
  const isCarousel = postType === "carousel"
  const specs = DIMENSION_HINTS[platform]?.[postType ?? ""] ?? []

  // ── Single-image handlers (for flyer background) ──────────────────────────
  const handleSingleChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const url = await readAsDataUrl(file)
      onImageSelect(file, url)
      e.target.value = ""
    },
    [onImageSelect]
  )

  const handleSingleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files?.[0]
      if (!file || !file.type.startsWith("image/")) return
      const url = await readAsDataUrl(file)
      onImageSelect(file, url)
    },
    [onImageSelect]
  )

  // ── Multi-image handlers ───────────────────────────────────────────────────
  const handleMultiAdd = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newFiles = Array.from(e.target.files ?? []).filter(f => f.type.startsWith("image/"))
      if (!newFiles.length) return
      const newUrls = await Promise.all(newFiles.map(readAsDataUrl))
      onImagesChange([...imageFiles, ...newFiles], [...imagePreviewUrls, ...newUrls])
      e.target.value = ""
    },
    [imageFiles, imagePreviewUrls, onImagesChange]
  )

  const handleMultiDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      const dropped = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"))
      if (!dropped.length) return
      const urls = await Promise.all(dropped.map(readAsDataUrl))
      onImagesChange([...imageFiles, ...dropped], [...imagePreviewUrls, ...urls])
    },
    [imageFiles, imagePreviewUrls, onImagesChange]
  )

  const removeImage = useCallback(
    (idx: number) => {
      onImagesChange(
        imageFiles.filter((_, i) => i !== idx),
        imagePreviewUrls.filter((_, i) => i !== idx)
      )
    },
    [imageFiles, imagePreviewUrls, onImagesChange]
  )

  // ── Dimension hint block ───────────────────────────────────────────────────
  const DimensionHint = () => {
    if (!specs.length) return null
    return (
      <Alert>
        <Info className="size-4" />
        <AlertDescription className="text-xs space-y-1">
          <span className="font-medium block mb-1">Recommended dimensions for {platform} {postType}:</span>
          {specs.map((s) => (
            <span key={s.aspect} className="flex items-center gap-1.5">
              <span className="font-medium">{s.aspect}</span>
              <span className="text-muted-foreground">— {s.dims}</span>
              {s.label && <span className="text-muted-foreground">({s.label})</span>}
            </span>
          ))}
          {isCarousel && (
            <span className="block mt-1 text-muted-foreground">All images in a carousel must use the same aspect ratio.</span>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  // ── Flyer template: single background image upload ─────────────────────────
  if (selectedFlyer) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Upload image for template</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Background image for the &ldquo;{selectedFlyer.name}&rdquo; template
          </p>
        </div>

        {imageSuggestion && (
          <div className="flex items-start gap-2.5 rounded-lg border bg-primary/5 border-primary/20 p-3.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Sparkles className="size-3.5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-primary">AI Image Suggestion</p>
              <p className="text-sm mt-0.5 leading-relaxed">{imageSuggestion}</p>
            </div>
          </div>
        )}

        {!imagePreviewUrl ? (
          <label
            htmlFor="image-upload-single"
            className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/25 p-8 transition-colors hover:border-primary/50 hover:bg-primary/5"
            onDrop={handleSingleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
              <Upload className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">
                Drop image here or <span className="text-primary">browse</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP up to 10MB</p>
            </div>
            <input
              id="image-upload-single"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={handleSingleChange}
            />
          </label>
        ) : (
          <div className="relative rounded-xl overflow-hidden border">
            <img src={imagePreviewUrl} alt="Uploaded preview" className="w-full object-cover max-h-64" />
            <Button variant="destructive" size="icon" className="absolute top-2 right-2 size-7" onClick={onImageClear}>
              <X className="size-4" />
            </Button>
            <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent p-3">
              <p className="text-xs text-white font-medium flex items-center gap-1.5">
                <ImageIcon className="size-3.5" /> Image uploaded
              </p>
            </div>
          </div>
        )}

        <Alert>
          <Info className="size-4" />
          <AlertDescription className="text-xs">
            The <span className="font-medium">{selectedFlyer.name}</span> template is{" "}
            <span className="font-medium">{selectedFlyer.aspectRatio}</span>.
            {selectedFlyer.imageSlotHint && (
              <> AI suggests: <em>&ldquo;{selectedFlyer.imageSlotHint}&rdquo;</em></>
            )}
          </AlertDescription>
        </Alert>

        {/* For carousel: each extra upload becomes the background for the next flyer slide */}
        {isCarousel && (
          <div className="space-y-3 border-t pt-4">
            <div>
              <p className="text-sm font-medium">Additional slide backgrounds</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Each image becomes the background for the next carousel slide — AI text will be overlaid on each one.
              </p>
            </div>

            {imagePreviewUrls.length === 0 ? (
              <label
                htmlFor="image-upload-extra"
                className="group flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 text-sm transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <Plus className="size-4 text-muted-foreground group-hover:text-primary" />
                <span className="text-muted-foreground group-hover:text-primary">Add more slides</span>
                <input
                  id="image-upload-extra"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="sr-only"
                  onChange={handleMultiAdd}
                />
              </label>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {imagePreviewUrls.map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border bg-muted">
                      <img src={url} alt={`Slide ${idx + 2} bg`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                      >
                        <X className="size-3" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 py-0.5 px-1">
                        <p className="text-[10px] text-white text-center">Slide {idx + 2} bg</p>
                      </div>
                    </div>
                  ))}
                  <label
                    htmlFor="image-upload-extra-add"
                    className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    <Plus className="size-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Add</span>
                    <input
                      id="image-upload-extra-add"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      className="sr-only"
                      onChange={handleMultiAdd}
                    />
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {imagePreviewUrls.length + 1} slides total — slide 1 (main background) + {imagePreviewUrls.length} extra
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => onImagesChange([], [])}
                  >
                    Clear extras
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── No flyer: multi-image upload ───────────────────────────────────────────
  const title = isCarousel ? "Upload carousel images" : "Upload image"
  const subtitle = isCarousel
    ? "Add 2–10 images — they'll appear as swipeable slides"
    : "Add an image to accompany your post (optional)"

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>

      {imageSuggestion && (
        <div className="flex items-start gap-2.5 rounded-lg border bg-primary/5 border-primary/20 p-3.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Sparkles className="size-3.5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium text-primary">AI Image Suggestion</p>
            <p className="text-sm mt-0.5 leading-relaxed">{imageSuggestion}</p>
          </div>
        </div>
      )}

      {imagePreviewUrls.length === 0 ? (
        <label
          htmlFor="image-upload-multi"
          className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/25 p-8 transition-colors hover:border-primary/50 hover:bg-primary/5"
          onDrop={handleMultiDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
            <Upload className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">
              Drop {isCarousel ? "images" : "an image"} here or{" "}
              <span className="text-primary">browse files</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isCarousel
                ? "Select multiple images • PNG, JPG, WebP up to 10MB each"
                : "PNG, JPG, WebP up to 10MB"}
            </p>
          </div>
          <input
            id="image-upload-multi"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple={isCarousel}
            className="sr-only"
            onChange={handleMultiAdd}
          />
        </label>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {imagePreviewUrls.map((url, idx) => (
              <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border bg-muted">
                <img src={url} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                >
                  <X className="size-3" />
                </button>
                {idx === 0 && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 py-0.5 px-1">
                    <p className="text-[10px] text-white text-center">Cover</p>
                  </div>
                )}
              </div>
            ))}

            {/* Add more — only shown for carousel or when multiple is useful */}
            {(isCarousel || imagePreviewUrls.length > 0) && (
              <label
                htmlFor="image-upload-add"
                className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <Plus className="size-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Add</span>
                <input
                  id="image-upload-add"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple={isCarousel}
                  className="sr-only"
                  onChange={handleMultiAdd}
                />
              </label>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {imagePreviewUrls.length} image{imagePreviewUrls.length !== 1 ? "s" : ""} selected
              {imagePreviewUrls.length > 1 ? " — carousel" : ""}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={() => onImagesChange([], [])}
            >
              Clear all
            </Button>
          </div>
        </div>
      )}

      <DimensionHint />
    </div>
  )
}
