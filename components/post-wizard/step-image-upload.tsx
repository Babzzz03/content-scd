"use client"

import { useCallback } from "react"
import { Upload, ImageIcon, X, Sparkles, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import type { FlyerTemplate } from "@/lib/types"

interface StepImageUploadProps {
  selectedFlyer: FlyerTemplate | null
  imageSuggestion: string
  imagePreviewUrl: string | null
  onImageSelect: (file: File, previewUrl: string) => void
  onImageClear: () => void
}

export function StepImageUpload({
  selectedFlyer,
  imageSuggestion,
  imagePreviewUrl,
  onImageSelect,
  onImageClear,
}: StepImageUploadProps) {
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const url = URL.createObjectURL(file)
      onImageSelect(file, url)
      console.log("[IMAGE UPLOAD] File selected:", {
        name: file.name,
        size: file.size,
        type: file.type,
      })
    },
    [onImageSelect]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files?.[0]
      if (!file || !file.type.startsWith("image/")) return
      const url = URL.createObjectURL(file)
      onImageSelect(file, url)
      console.log("[IMAGE UPLOAD] File dropped:", {
        name: file.name,
        size: file.size,
      })
    },
    [onImageSelect]
  )

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Upload your image</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {selectedFlyer?.name
            ? `Required for the "${selectedFlyer.name}" template`
            : "Add an image for your post"}
        </p>
      </div>

      {/* AI image suggestion */}
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

      {/* Upload area */}
      {!imagePreviewUrl ? (
        <label
          htmlFor="image-upload"
          className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/25 p-8 transition-colors hover:border-primary/50 hover:bg-primary/5"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
            <Upload className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">
              Drop your image here or{" "}
              <span className="text-primary">browse files</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPG, WebP up to 10MB
            </p>
          </div>
          <input
            id="image-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={handleFileChange}
          />
        </label>
      ) : (
        <div className="relative rounded-xl overflow-hidden border">
          <img
            src={imagePreviewUrl}
            alt="Uploaded preview"
            className="w-full object-cover max-h-64"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 size-7"
            onClick={onImageClear}
          >
            <X className="size-4" />
          </Button>
          <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent p-3">
            <p className="text-xs text-white font-medium flex items-center gap-1.5">
              <ImageIcon className="size-3.5" />
              Image uploaded successfully
            </p>
          </div>
        </div>
      )}

      {/* Flyer template aspect ratio hint */}
      {selectedFlyer && (
        <Alert>
          <Info className="size-4" />
          <AlertDescription className="text-xs">
            The <span className="font-medium">{selectedFlyer.name}</span> template is{" "}
            <span className="font-medium">{selectedFlyer.aspectRatio}</span>. For best results,
            upload an image with the same aspect ratio.
            {selectedFlyer.imageSlotHint && (
              <> AI suggests: <em>"{selectedFlyer.imageSlotHint}"</em></>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
