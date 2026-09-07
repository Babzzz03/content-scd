"use client"

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react"

export interface TourStep {
  /** data-tour attribute selector on the destination page — null for a centered modal */
  target: string | null
  /** Route to navigate to before showing this step — null = stay on current route */
  route: string | null
  title: string
  description: string
  /** Preferred tooltip placement relative to the target */
  placement?: "top" | "bottom" | "left" | "right"
}

const TOUR_STEPS: TourStep[] = [
  {
    target: null,
    route: null,
    title: "Welcome to PostFlow! 👋",
    description:
      "Let's take a quick tour of the whole app together. We'll navigate through every section so you know exactly what's here and how to use it.",
    placement: "bottom",
  },
  {
    target: "page-dashboard",
    route: "/dashboard",
    title: "Dashboard",
    description:
      "This is your command centre. At a glance you can see scheduled posts, content stats and quick shortcuts to create or engage — all from one place.",
    placement: "bottom",
  },
  {
    target: "page-platform",
    route: "/x",
    title: "Platform Pages — X (Twitter)",
    description:
      "Each platform has its own hub. Here you can create posts, write replies to posts in your niche, and run engagement campaigns — all optimised for X's format.",
    placement: "bottom",
  },
  {
    target: "tour-start-here",
    route: "/x",
    title: "Create Post — Your Starting Point",
    description:
      "Tap 'Create Post' to launch the AI post wizard. Pick a post format, describe your idea, choose a flyer template, and get a full caption + graphic in seconds.",
    placement: "bottom",
  },
  {
    target: "page-platform",
    route: "/linkedin",
    title: "LinkedIn Platform Page",
    description:
      "Switch to LinkedIn to create professional posts, document carousels and thought-leadership content. The AI adapts tone and format automatically for each platform.",
    placement: "bottom",
  },
  {
    target: "page-platform",
    route: "/instagram",
    title: "Instagram Platform Page",
    description:
      "Create single posts, carousels, and story formats for Instagram. The AI generates visual-first captions, hashtag sets and flyer graphics ready to post.",
    placement: "bottom",
  },
  {
    target: "page-content-ideas",
    route: "/content-ideas",
    title: "Content Ideas",
    description:
      "Stuck on what to post? Generate video and reel ideas — skits, educational clips, BTS content and more — tailored to your brand. Save ideas or send them straight to your calendar.",
    placement: "bottom",
  },
  {
    target: "page-post-ideas",
    route: "/post-ideas",
    title: "Post Ideas",
    description:
      "Browse AI-generated caption ideas ready to publish. Filter by platform, tone or topic. Save your favourites or click 'Use This Idea' to prefill the post wizard.",
    placement: "bottom",
  },
  {
    target: "page-brand-voice",
    route: "/brand-voice",
    title: "Brand Voice",
    description:
      "Set up your brand identity once — your industry, tone, key messages and audience. Every piece of AI content will then sound authentically like you instead of generic AI.",
    placement: "bottom",
  },
  {
    target: "page-schedule",
    route: "/schedule",
    title: "Content Calendar",
    description:
      "All your scheduled and drafted posts across every platform, in a calendar view. Review, edit or reschedule posts with a click.",
    placement: "bottom",
  },
  {
    target: "page-marketing-strategy",
    route: "/marketing-strategy",
    title: "Marketing Strategy",
    description:
      "Generate a full AI-powered marketing plan in minutes — content pillars, growth tactics, KPIs, tool recommendations and a phased roadmap, all tailored to your goals.",
    placement: "bottom",
  },
  {
    target: "page-settings",
    route: "/settings",
    title: "Settings",
    description:
      "Connect your X, LinkedIn and Instagram accounts for direct posting. Also choose your AI provider (Claude, Gemini or ChatGPT) — your API key stays on your device.",
    placement: "bottom",
  },
  {
    target: null,
    route: null,
    title: "You're all set! 🚀",
    description:
      "That's the full PostFlow tour. Start by creating your Brand Voice profile, then generate your first post. You can replay this tour anytime from the sidebar.",
    placement: "bottom",
  },
]

interface TourContextValue {
  isActive: boolean
  currentStep: number
  totalSteps: number
  step: TourStep
  start: () => void
  stop: () => void
  next: () => void
  prev: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error("useTour must be inside TourProvider")
  return ctx
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  const start = useCallback(() => {
    setCurrentStep(0)
    setIsActive(true)
  }, [])

  const stop = useCallback(() => setIsActive(false), [])

  const next = useCallback(() => {
    setCurrentStep((s) => {
      if (s >= TOUR_STEPS.length - 1) {
        setIsActive(false)
        return s
      }
      return s + 1
    })
  }, [])

  const prev = useCallback(() => setCurrentStep((s) => Math.max(0, s - 1)), [])

  return (
    <TourContext.Provider
      value={{
        isActive,
        currentStep,
        totalSteps: TOUR_STEPS.length,
        step: TOUR_STEPS[currentStep],
        start,
        stop,
        next,
        prev,
      }}
    >
      {children}
    </TourContext.Provider>
  )
}
