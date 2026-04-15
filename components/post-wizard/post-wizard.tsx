"use client"

import { useState } from "react"
import { ArrowLeft, ArrowRight, Sparkles, Loader2, Info, Zap } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { WizardProgress } from "./wizard-progress"
import { StepPostType } from "./step-post-type"
import { StepAIInput } from "./step-ai-input"
import { StepFlyerSelect } from "./step-flyer-select"
import { StepImageUpload } from "./step-image-upload"
import { StepPreview } from "./step-preview"
import { ScheduleDatePicker } from "./schedule-date-picker"
import { generatePostContent } from "@/lib/ai-mock"
import { DUMMY_BRAND_VOICE } from "@/lib/dummy-data"
import { usePostsContext } from "@/lib/posts-context"
import { useAIProvider } from "@/lib/ai-provider-context"
import { useAccounts } from "@/lib/accounts-context"
import type {
  Platform,
  PostType,
  PostWizardState,
  WizardStep,
  FlyerTemplate,
  GeneratedPostContent,
  FlyerContent,
  ContentTone,
} from "@/lib/types"
import { toast } from "sonner"

const STEP_ORDER: WizardStep[] = [
  "post-type",
  "ai-input",
  "flyer-select",
  "image-upload",
  "preview",
]

const INITIAL_STATE = (platform: Platform): PostWizardState => ({
  platform,
  postType: null,
  aiInput: {
    topic: "",
    tone: "professional",
    useBrandVoice: false,
    additionalContext: "",
  },
  selectedFlyer: null,
  imageFile: null,
  imagePreviewUrl: null,
  customFlyerFile: null,
  customFlyerPreviewUrl: null,
  logoFile: null,
  logoPreviewUrl: null,
  generatedContent: null,
  scheduledAt: null,
  step: "post-type",
})

function canAdvance(state: PostWizardState): boolean {
  switch (state.step) {
    case "post-type":
      return state.postType !== null
    case "ai-input":
      // topic is optional when brand voice is active
      return state.aiInput.useBrandVoice || state.aiInput.topic.trim().length > 0
    case "flyer-select":
      return true // always can advance (can skip flyer)
    case "image-upload":
      return true // image is optional
    case "preview":
      return false
    default:
      return false
  }
}

// ─── Prefill Types ────────────────────────────────────────────────────────────
export interface PostWizardPrefill {
  platform: Platform
  postType: PostType
  topic: string
  tone: ContentTone
  caption: string
  hashtags: string[]
  imagePrompt?: string
  postNow?: boolean  // if true, skip to preview immediately after generation
}

interface PostWizardProps {
  platform: Platform
  open: boolean
  onClose: () => void
  prefill?: PostWizardPrefill
}

export function PostWizard({ platform, open, onClose, prefill }: PostWizardProps) {
  // Build initial state considering prefill
  const buildInitialState = (): PostWizardState => {
    if (!prefill) return INITIAL_STATE(platform)

    // Prefill the topic + additional context so AI can generate fresh content
    return {
      platform: prefill.platform,
      postType: prefill.postType,
      aiInput: {
        topic: prefill.topic,
        tone: prefill.tone,
        useBrandVoice: !!DUMMY_BRAND_VOICE,
        additionalContext: prefill.caption, // idea caption becomes additional context
      },
      selectedFlyer: null,
      imageFile: null,
      imagePreviewUrl: null,
      customFlyerFile: null,
      customFlyerPreviewUrl: null,
      logoFile: null,
      logoPreviewUrl: null,
      generatedContent: null, // always generate fresh — never skip AI step
      scheduledAt: null,
      step: "ai-input",
    }
  }

  const [state, setState] = useState<PostWizardState>(() => buildInitialState())
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>(() =>
    prefill ? ["post-type"] : []
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const { addScheduledPost } = usePostsContext()
  const { activeProvider } = useAIProvider()
  const { getAccount } = useAccounts()

  const currentStepIdx = STEP_ORDER.indexOf(state.step)

  const updateState = (updates: Partial<PostWizardState>) => {
    setState((prev) => ({ ...prev, ...updates }))
  }

  const markStepComplete = (step: WizardStep) => {
    setCompletedSteps((prev) => (prev.includes(step) ? prev : [...prev, step]))
  }

  const goToStep = (step: WizardStep) => {
    updateState({ step })
  }

  const handleNext = async () => {
    markStepComplete(state.step)

    // If moving from ai-input, always trigger AI generation
    if (state.step === "ai-input") {
      setIsGenerating(true)
      try {
        const generated = await generatePostContent(state, activeProvider?.id ?? null)
        updateState({ generatedContent: generated, step: "flyer-select" })
        const providerLabel = activeProvider ? ` via ${activeProvider.id}` : ""
        toast.success("AI content generated!", { description: `Review and customise below${providerLabel}` })
      } catch (err) {
        console.error("[AI ERROR]", err)
        toast.error("AI generation failed", { description: "Please try again" })
      } finally {
        setIsGenerating(false)
      }
      return
    }

    // Skip image upload if custom flyer uploaded OR selected flyer has no image slot
    if (state.step === "flyer-select") {
      if (state.customFlyerFile || !state.selectedFlyer?.hasImageSlot) {
        updateState({ step: "preview" })
        return
      }
    }

    const nextIdx = currentStepIdx + 1
    if (nextIdx < STEP_ORDER.length) {
      updateState({ step: STEP_ORDER[nextIdx] })
    }
  }

  const handleBack = () => {
    if (state.step === "preview" && !state.selectedFlyer?.hasImageSlot) {
      updateState({ step: "flyer-select" })
      return
    }
    const prevIdx = currentStepIdx - 1
    if (prevIdx >= 0) {
      updateState({ step: STEP_ORDER[prevIdx] })
    }
  }

  const handleClose = () => {
    setState(buildInitialState())
    setCompletedSteps(prefill ? ["post-type"] : [])
    onClose()
  }

  // Called when user clicks "Schedule" in preview — opens the date picker
  const handleSchedule = () => {
    setShowDatePicker(true)
  }

  // Called when user confirms a date in the date picker
  const handleDateConfirmed = (date: Date) => {
    const content = state.generatedContent
    const account = getAccount(state.platform)

    console.log("[POST WIZARD] Scheduling post:", {
      platform: state.platform,
      scheduledAt: date,
      cookiePresent: account.connected,
      cookiePreview: account.sessionCookie
        ? account.sessionCookie.slice(0, 8) + "…"
        : "no cookie — connect account in Settings",
    })

    addScheduledPost({
      platform: state.platform,
      postType: state.postType ?? "single",
      content: content?.caption ?? state.aiInput.topic,
      caption: content?.caption,
      hashtags: content?.hashtags,
      scheduledAt: date,
    })
    setShowDatePicker(false)

    const notConnected = !account.connected
    toast.success("Post scheduled!", {
      description: date.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      ...(notConnected && {
        description: "Note: connect your account in Settings to enable real posting",
      }),
    })
    handleClose()
  }

  const handleSaveDraft = () => {
    const payload = {
      platform: state.platform,
      postType: state.postType,
      content: state.generatedContent,
      action: "draft",
    }
    console.log("[POST WIZARD] Save draft:", payload)
    toast.success("Saved as draft")
    handleClose()
  }

  const handleSetLogo = (file: File, url: string) => {
    updateState({ logoFile: file, logoPreviewUrl: url })
  }

  const handleClearLogo = () => {
    updateState({ logoFile: null, logoPreviewUrl: null })
  }

  const handleDuplicate = () => {
    console.log("[POST WIZARD] Duplicate post:", state)
    toast.info("Post duplicated", {
      description: "A copy has been saved to your drafts",
    })
    handleClose()
  }

  const isFirstStep = currentStepIdx === 0
  const isPreviewStep = state.step === "preview"

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-xl sm:max-w-2xl lg:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base">Create Post</DialogTitle>
            {prefill?.postNow && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 gap-1">
                <Zap className="size-2.5" />
                Auto-post
              </Badge>
            )}
          </div>
          <div className="mt-3">
            <WizardProgress
              currentStep={state.step}
              completedSteps={completedSteps}
            />
          </div>
        </DialogHeader>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Prefill banner */}
          {prefill && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-3 mb-4">
              <Info className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Topic and context pre-filled from your Post Idea — tweak if needed, then click <strong>Generate with AI</strong> to create your post.
              </p>
            </div>
          )}

          {state.step === "post-type" && (
            <StepPostType
              platform={state.platform}
              selected={state.postType}
              onSelect={(type) => updateState({ postType: type })}
            />
          )}

          {state.step === "ai-input" && (
            <StepAIInput
              platform={state.platform}
              postType={state.postType}
              aiInput={state.aiInput}
              hasBrandVoice={!!DUMMY_BRAND_VOICE}
              onChange={(updates) =>
                updateState({ aiInput: { ...state.aiInput, ...updates } })
              }
            />
          )}

          {state.step === "flyer-select" && (
            <StepFlyerSelect
              selected={state.selectedFlyer}
              customFlyerPreviewUrl={state.customFlyerPreviewUrl}
              onSelect={(flyer) => updateState({
                selectedFlyer: flyer,
                customFlyerFile: null,
                customFlyerPreviewUrl: null,
              })}
              onUploadCustomFlyer={(file, url) => updateState({
                customFlyerFile: file,
                customFlyerPreviewUrl: url,
                selectedFlyer: null,
              })}
              onClearCustomFlyer={() => updateState({
                customFlyerFile: null,
                customFlyerPreviewUrl: null,
              })}
              onSkip={() => {
                updateState({ selectedFlyer: null, customFlyerFile: null, customFlyerPreviewUrl: null })
                markStepComplete("flyer-select")
                updateState({ step: "preview" })
              }}
            />
          )}

          {state.step === "image-upload" && (
            <StepImageUpload
              selectedFlyer={state.selectedFlyer}
              imageSuggestion={state.generatedContent?.imageSuggestion ?? ""}
              imagePreviewUrl={state.imagePreviewUrl}
              onImageSelect={(file, url) =>
                updateState({ imageFile: file, imagePreviewUrl: url })
              }
              onImageClear={() =>
                updateState({ imageFile: null, imagePreviewUrl: null })
              }
            />
          )}

          {state.step === "preview" && state.generatedContent && (
            <StepPreview
              state={state}
              content={state.generatedContent}
              onUpdateCaption={(caption) => {
                if (!state.generatedContent) return
                updateState({ generatedContent: { ...state.generatedContent, caption } })
              }}
              onUpdateFlyer={(idx, updates: Partial<FlyerContent>) => {
                if (!state.generatedContent) return
                const flyers = [...state.generatedContent.flyers]
                flyers[idx] = { ...flyers[idx], ...updates }
                updateState({ generatedContent: { ...state.generatedContent, flyers } })
              }}
              onAddFlyer={() => {
                if (!state.generatedContent) return
                const newFlyer: FlyerContent = {
                  id: `f${Date.now()}`,
                  text: "NEW FLYER HEADLINE",
                  subtext: "Add your description here",
                }
                updateState({ generatedContent: { ...state.generatedContent, flyers: [...state.generatedContent.flyers, newFlyer] } })
              }}
              onAddCustomFlyer={(url) => {
                if (!state.generatedContent) return
                const newFlyer: FlyerContent = {
                  id: `f${Date.now()}`,
                  text: "",
                  customImageUrl: url,
                }
                updateState({ generatedContent: { ...state.generatedContent, flyers: [...state.generatedContent.flyers, newFlyer] } })
              }}
              onDeleteFlyer={(idx) => {
                if (!state.generatedContent) return
                const flyers = state.generatedContent.flyers.filter((_, i) => i !== idx)
                updateState({ generatedContent: { ...state.generatedContent, flyers } })
              }}
              onUpdateThreadPost={(idx, text) => {
                if (!state.generatedContent?.threadPosts) return
                const updated = [...state.generatedContent.threadPosts]
                updated[idx] = text
                updateState({ generatedContent: { ...state.generatedContent, threadPosts: updated } })
              }}
              onAddThreadPost={() => {
                if (!state.generatedContent) return
                const posts = state.generatedContent.threadPosts ?? []
                updateState({
                  generatedContent: { ...state.generatedContent, threadPosts: [...posts, ""] },
                })
              }}
              onDeleteThreadPost={(idx) => {
                if (!state.generatedContent?.threadPosts) return
                const updated = state.generatedContent.threadPosts.filter((_, i) => i !== idx)
                updateState({ generatedContent: { ...state.generatedContent, threadPosts: updated } })
              }}
              onSetLogo={handleSetLogo}
              onClearLogo={handleClearLogo}
              onSchedule={handleSchedule}
              onSaveDraft={handleSaveDraft}
              onDuplicate={handleDuplicate}
            />
          )}
        </div>

        {/* Footer navigation — Back always visible; Continue hidden on preview */}
        <>
          <Separator />
          <div className="flex items-center justify-between px-6 py-4 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              disabled={isFirstStep}
            >
              <ArrowLeft data-icon="inline-start" />
              Back
            </Button>

            {!isPreviewStep && (
              <Button
                size="sm"
                onClick={handleNext}
                disabled={!canAdvance(state) || isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    Generating...
                  </>
                ) : state.step === "ai-input" ? (
                  <>
                    <Sparkles data-icon="inline-start" />
                    Generate with AI
                    {activeProvider && (
                      <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-medium capitalize">
                        {activeProvider.id}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight data-icon="inline-end" />
                  </>
                )}
              </Button>
            )}
          </div>
        </>
      </DialogContent>
    </Dialog>

    <ScheduleDatePicker
      open={showDatePicker}
      onClose={() => setShowDatePicker(false)}
      onConfirm={handleDateConfirmed}
    />
    </>
  )
}
