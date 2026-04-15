"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WizardStep } from "@/lib/types"

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "post-type", label: "Post Type" },
  { id: "ai-input", label: "AI Input" },
  { id: "flyer-select", label: "Design" },
  { id: "image-upload", label: "Media" },
  { id: "preview", label: "Preview" },
]

function getStepIndex(step: WizardStep): number {
  return STEPS.findIndex((s) => s.id === step)
}

interface WizardProgressProps {
  currentStep: WizardStep
  completedSteps: WizardStep[]
}

export function WizardProgress({ currentStep, completedSteps }: WizardProgressProps) {
  const currentIdx = getStepIndex(currentStep)

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, idx) => {
        const isCompleted = completedSteps.includes(step.id)
        const isCurrent = step.id === currentStep
        const isPast = idx < currentIdx

        return (
          <div key={step.id} className="flex items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border-2 text-xs font-medium transition-all",
                  isCompleted || isPast
                    ? "bg-primary border-primary text-primary-foreground"
                    : isCurrent
                    ? "border-primary text-primary bg-background"
                    : "border-muted-foreground/30 text-muted-foreground bg-background"
                )}
              >
                {isCompleted || isPast ? (
                  <Check className="size-3.5" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium hidden sm:block",
                  isCurrent ? "text-primary" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-8 sm:w-12 mx-1 mb-4 transition-colors",
                  isPast || isCompleted ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
