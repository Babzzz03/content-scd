"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { useRouter, usePathname } from "next/navigation"
import { X, ArrowLeft, ArrowRight, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTour } from "@/lib/tour-context"
import { cn } from "@/lib/utils"

// ─── Constants ────────────────────────────────────────────────────────────────
const PAD        = 10    // spotlight padding (px)
const GAP        = 14    // gap between spotlight and tooltip (px)
const NAV_SETTLE = 700   // ms to wait after pathname changes before spotlighting

// ─── Types ────────────────────────────────────────────────────────────────────
interface SpotRect   { x: number; y: number; w: number; h: number }
interface TooltipPos { top?: number; bottom?: number; left?: number; right?: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function findTarget(sel: string): Element | null {
  return document.querySelector(`[data-tour="${sel}"]`)
}

function scrollToIfNeeded(sel: string) {
  const el = findTarget(sel)
  if (!el) return
  const r = el.getBoundingClientRect()
  if (r.top < 0 || r.bottom > window.innerHeight)
    el.scrollIntoView({ behavior: "smooth", block: "center" })
}

function calcTooltipPos(
  rect: DOMRect,
  placement: string,
  ttW: number,
  ttH: number,
): TooltipPos {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const sTop  = rect.top    - PAD,  sBot  = rect.bottom + PAD
  const sLeft = rect.left   - PAD,  sRight= rect.right  + PAD
  const sCX   = (sLeft + sRight) / 2, sCY = (sTop + sBot) / 2

  const cx = (x: number) => Math.max(8, Math.min(x, vw - ttW - 8))
  const cy = (y: number) => Math.max(8, Math.min(y, vh - ttH - 8))

  if (placement === "right"  && sRight + GAP + ttW <= vw) return { left: sRight + GAP,       top: cy(sCY - ttH / 2) }
  if (placement === "left"   && sLeft  - GAP - ttW >= 0)  return { left: sLeft - GAP - ttW,  top: cy(sCY - ttH / 2) }
  if (placement === "bottom" && sBot   + GAP + ttH <= vh)  return { top: sBot + GAP,          left: cx(sCX - ttW / 2) }
  return { top: cy(sTop - GAP - ttH), left: cx(sCX - ttW / 2) }   // fallback: above
}

// ─── Component ────────────────────────────────────────────────────────────────
export function TourOverlay() {
  const { isActive, step, currentStep, totalSteps, next, prev, stop } = useTour()
  const router   = useRouter()
  const pathname = usePathname()

  const tooltipRef       = useRef<HTMLDivElement>(null)
  const pendingRouteRef  = useRef<string | null>(null)
  // Separating "did we just finish navigating?" into a ref avoids the
  // setTimeout-cancellation bug where a re-render caused by setNavigating(false)
  // would trigger the previous effect's cleanup and clearTimeout the recalc.
  const didJustNavigate  = useRef(false)

  const [spotlight,  setSpotlight]  = useState<SpotRect | null>(null)
  const [tooltipPos, setTooltipPos] = useState<TooltipPos>({})
  const [visible,    setVisible]    = useState(false)
  const [navigating, setNavigating] = useState(false)

  // ── Recalculate spotlight position ───────────────────────────────────────────
  const recalc = useCallback(() => {
    if (!isActive) return

    // No target (welcome / done steps) → centered tooltip
    if (!step.target) {
      setSpotlight(null)
      setTooltipPos({})
      setVisible(true)
      return
    }

    const target = findTarget(step.target)

    // Target not found (e.g. element not rendered) → centred tooltip without spotlight
    if (!target) {
      setSpotlight(null)
      setTooltipPos({})
      setVisible(true)
      return
    }

    scrollToIfNeeded(step.target)

    const rect = target.getBoundingClientRect()
    const ttEl = tooltipRef.current
    const ttW  = ttEl?.offsetWidth  || 290
    const ttH  = ttEl?.offsetHeight || 180

    setSpotlight({ x: rect.left - PAD, y: rect.top - PAD, w: rect.width + PAD * 2, h: rect.height + PAD * 2 })
    setTooltipPos(calcTooltipPos(rect, step.placement ?? "bottom", ttW, ttH))
    setVisible(true)
  }, [isActive, step])

  // ── Step change: navigate or recalc immediately ───────────────────────────────
  useEffect(() => {
    if (!isActive) return

    setVisible(false)
    setSpotlight(null)

    if (step.route && pathname !== step.route) {
      // Need to navigate first
      pendingRouteRef.current = step.route
      didJustNavigate.current = false
      setNavigating(true)
      router.push(step.route)
    } else {
      // Already on the right page
      pendingRouteRef.current = null
      const id = setTimeout(recalc, 150)
      return () => clearTimeout(id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, isActive])

  // ── Effect 1: detect when navigation pathname matches the pending route ────────
  // This only sets navigating=false and marks the didJustNavigate ref.
  // It does NOT start any setTimeout so there is nothing to cancel.
  useEffect(() => {
    if (!navigating) return
    if (!pendingRouteRef.current) return
    if (pathname !== pendingRouteRef.current) return

    pendingRouteRef.current = null
    didJustNavigate.current = true
    setNavigating(false)
  }, [pathname, navigating])

  // ── Effect 2: after navigating becomes false, trigger recalc with settle delay ─
  // This is a SEPARATE effect so its cleanup (clearing the timeout) only fires
  // when its own deps change — NOT when navigating changes to false mid-flight.
  useEffect(() => {
    if (!isActive)   return
    if (navigating)  return
    if (!didJustNavigate.current) return

    didJustNavigate.current = false
    const id = setTimeout(recalc, NAV_SETTLE)
    return () => clearTimeout(id)
  // recalc is stable per step; navigating going false is the trigger
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigating, isActive])

  // ── Recalc on window resize ───────────────────────────────────────────────────
  useEffect(() => {
    window.addEventListener("resize", recalc)
    return () => window.removeEventListener("resize", recalc)
  }, [recalc])

  // ── Keyboard navigation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")     stop()
      if (e.key === "ArrowRight") next()
      if (e.key === "ArrowLeft")  prev()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isActive, next, prev, stop])

  if (!isActive) return null

  const isFirst  = currentStep === 0
  const isLast   = currentStep === totalSteps - 1
  const progress = ((currentStep + 1) / totalSteps) * 100

  // Centered when there's no spotlight to anchor to (no target, target not found,
  // or still navigating). Otherwise the tooltip positions near the spotlight on
  // all screen sizes — mobile included, just with a narrower card width.
  const isCentered = !step.target || !spotlight

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Overlay ─────────────────────────────────────────────────────────── */}
      {spotlight ? (
        /* SVG with transparent window cut out over the target — works on all sizes */
        <svg
          className="fixed inset-0 w-full h-full"
          style={{ zIndex: 9998, pointerEvents: "none" }}
          aria-hidden="true"
        >
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={spotlight.x} y={spotlight.y}
                width={spotlight.w} height={spotlight.h}
                rx={8} fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.65)" mask="url(#tour-mask)" />
          {/* Highlight ring around target */}
          <rect
            x={spotlight.x - 1} y={spotlight.y - 1}
            width={spotlight.w + 2} height={spotlight.h + 2}
            rx={9} fill="none"
            stroke="hsl(var(--primary))" strokeWidth={2.5} opacity={0.9}
          />
        </svg>
      ) : (
        /* Solid dark overlay for centered / navigating states */
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
          style={{ zIndex: 9998 }}
          aria-hidden="true"
        />
      )}

      {/* Click-blocker layer — stops accidental clicks on the page */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 9999 }}
        onClick={stop}
        aria-label="Close tour"
      />

      {/* ── Tooltip card ────────────────────────────────────────────────────── */}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Tour step ${currentStep + 1} of ${totalSteps}: ${step.title}`}
        className={cn(
          "fixed transition-opacity duration-200",
          visible || navigating ? "opacity-100" : "opacity-0",
          // Spotlight mode: card anchors near the highlighted element.
          // Width is capped so it never overflows narrow mobile screens.
          !isCentered && "w-[min(290px,calc(100vw-24px))]",
          // Centered mode (welcome/done/navigating): vertically + horizontally centred
          // card on all screen sizes, width adjusts to viewport.
          isCentered && [
            "left-1/2 -translate-x-1/2",
            "top-1/2 -translate-y-1/2",
            "w-[min(380px,calc(100vw-32px))]",
          ],
        )}
        style={{ zIndex: 10000, ...(!isCentered ? tooltipPos : {}) }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-card border border-border shadow-2xl overflow-hidden rounded-2xl">
          {/* Progress bar */}
          <div className="h-0.5 bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* ── Navigating state ── */}
          {navigating && (
            <div className="px-4 py-3.5 sm:px-5 sm:py-4 flex items-center gap-3 text-xs sm:text-sm text-muted-foreground">
              <div className="size-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
              Navigating to {step.route}…
            </div>
          )}

          {/* ── Main content ── */}
          {!navigating && (
            <div className="p-3.5 sm:p-5">
              {/* Header row */}
              <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-full bg-primary/15">
                    <MapPin className="size-3 sm:size-3.5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-xs sm:text-sm leading-snug">{step.title}</h3>
                </div>
                <button
                  onClick={stop}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close tour"
                >
                  <X className="size-3.5 sm:size-4" />
                </button>
              </div>

              {/* Route badge */}
              {step.route && (
                <div className="mb-2 sm:mb-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[9px] sm:text-[10px] font-mono text-muted-foreground">
                    {step.route}
                  </span>
                </div>
              )}

              {/* Description */}
              <p className="text-[11px] sm:text-sm text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                {step.description}
              </p>

              {/* Footer: counter + buttons */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] sm:text-[11px] text-muted-foreground font-medium tabular-nums">
                  {currentStep + 1} / {totalSteps}
                </span>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {!isFirst && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 sm:h-8 px-2.5 sm:px-3 gap-1 text-[11px] sm:text-xs"
                      onClick={prev}
                    >
                      <ArrowLeft className="size-3 sm:size-3.5" />
                      Back
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="h-7 sm:h-8 px-2.5 sm:px-3 gap-1 text-[11px] sm:text-xs min-w-[68px] sm:min-w-[80px]"
                    onClick={isLast ? stop : next}
                  >
                    {isLast ? "Finish" : (
                      <>Next <ArrowRight className="size-3 sm:size-3.5" /></>
                    )}
                  </Button>
                </div>
              </div>

              {/* Skip */}
              {!isLast && (
                <div className="text-center mt-2.5 sm:mt-3">
                  <button
                    onClick={stop}
                    className="text-[10px] sm:text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                  >
                    Skip tour
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
