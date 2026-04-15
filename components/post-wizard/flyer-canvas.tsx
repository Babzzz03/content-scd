"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { FlyerTemplate } from "@/lib/types"

const BASE_DIMS: Record<FlyerTemplate["aspectRatio"], { w: number; h: number }> = {
  "1:1":  { w: 400, h: 400 },
  "4:5":  { w: 400, h: 500 },
  "9:16": { w: 360, h: 640 },
  "16:9": { w: 640, h: 360 },
}

const BOTTOM_GRADIENT = "linear-gradient(to top, rgba(0,0,0,.97) 0%, rgba(0,0,0,.88) 18%, rgba(0,0,0,.55) 35%, rgba(0,0,0,.1) 55%, transparent 72%)"
const TOP_VIGNETTE    = "linear-gradient(to bottom, rgba(0,0,0,.45) 0%, transparent 28%)"

function splitText(text: string): [string, string] {
  const words = text.split(" ")
  const mid   = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")]
}

// ─── Logo pill ────────────────────────────────────────────────────────────────
// Renders the user logo (if provided) or falls back to the brandText placeholder.
// Position is relative to the parent — caller controls absolute positioning.
function LogoPill({ logoUrl, brandText, light = false }: { logoUrl?: string | null; brandText: string; light?: boolean }) {
  if (logoUrl) {
    return (
      <div style={{ display:"inline-flex", alignItems:"center", background: light ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.18)", backdropFilter:"blur(8px)", borderRadius:6, padding:"3px 8px" }}>
        <img src={logoUrl} alt="logo" style={{ height:22, maxWidth:72, width:"auto", objectFit:"contain" }} />
      </div>
    )
  }
  return (
    <span style={{ color: light ? "rgba(0,0,0,.35)" : "rgba(255,255,255,.32)", fontSize:10, fontWeight:600, letterSpacing:".06em" }}>
      {brandText}
    </span>
  )
}

// ─── Shared types ─────────────────────────────────────────────────────────────
interface LayoutProps {
  w: number; h: number
  imageUrl?: string | null
  text: string
  subtext?: string
  template: FlyerTemplate
  fontFamily?: string
  headlineColor?: string
  accentColor?: string
  categoryLabel?: string
  logoUrl?: string | null
  hideTag?: boolean
  hideHeadline?: boolean
  hideSubtext?: boolean
  hideLogo?: boolean
}

function BgImage({ src, fallback }: { src?: string | null; fallback: string }) {
  return src
    ? <img src={src} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} crossOrigin="anonymous" />
    : <div style={{ position:"absolute", inset:0, background:fallback }} />
}

// ─── 1. HEADLINE DROP ─────────────────────────────────────────────────────────
function HeadlineDrop({ w, h, imageUrl, text, subtext, template, fontFamily, headlineColor, accentColor, categoryLabel, logoUrl, hideTag, hideHeadline, hideSubtext, hideLogo }: LayoutProps) {
  const font=fontFamily??"system-ui,-apple-system,sans-serif",accent=accentColor??template.accentColor??"#fff",hColor=headlineColor??"white",catLbl=categoryLabel??template.categoryLabel??"BREAKING"
  return (
    <div style={{ width:w, height:h, position:"relative", overflow:"hidden", fontFamily:font }}>
      <BgImage src={imageUrl} fallback="linear-gradient(160deg,#1b2537 0%,#0d1117 100%)" />
      <div style={{ position:"absolute", inset:0, background:BOTTOM_GRADIENT }} />
      <div style={{ position:"absolute", inset:0, background:TOP_VIGNETTE }} />
      {!hideTag && (
        <div style={{ position:"absolute", top:20, left:20 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(255,255,255,.12)", backdropFilter:"blur(10px)", border:"1px solid rgba(255,255,255,.22)", borderRadius:100, padding:"5px 14px" }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:accent, flexShrink:0 }} />
            <span style={{ color:"white", fontSize:10, fontWeight:700, letterSpacing:".14em", textTransform:"uppercase" }}>{catLbl}</span>
          </div>
        </div>
      )}
      {!hideLogo && (
        <div style={{ position:"absolute", top:18, right:18 }}><LogoPill logoUrl={logoUrl} brandText="PostFlow" /></div>
      )}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 22px 20px" }}>
        <div style={{ width:40, height:3, background:accent, borderRadius:2, marginBottom:10 }} />
        {!hideHeadline && <p style={{ color:hColor, fontSize:36, fontWeight:900, lineHeight:1.15, letterSpacing:"-.025em", margin:0, textShadow:"0 2px 20px rgba(0,0,0,.6)" }}>{text}</p>}
        {!hideSubtext && subtext && <p style={{ color:"rgba(255,255,255,.65)", fontSize:13, lineHeight:1.4, margin:"7px 0 0" }}>{subtext}</p>}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:10 }}>
          <div style={{ display:"flex", gap:4 }}>{[0,1,2,3,4].map(i=><div key={i} style={{ width:i===0?16:5, height:5, borderRadius:3, background:i===0?"rgba(255,255,255,.75)":"rgba(255,255,255,.22)" }} />)}</div>
          <span style={{ color:"rgba(255,255,255,.38)", fontSize:9, fontWeight:600, letterSpacing:".14em", textTransform:"uppercase" }}>SWIPE ›</span>
        </div>
      </div>
    </div>
  )
}

// ─── 2. ACCENT HEADLINE ───────────────────────────────────────────────────────
function AccentHeadline({ w, h, imageUrl, text, template, fontFamily, headlineColor, accentColor, categoryLabel, logoUrl, hideTag, hideHeadline, hideLogo }: LayoutProps) {
  const [first, second]=splitText(text)
  const font=fontFamily??"system-ui,-apple-system,sans-serif",accent=accentColor??template.accentColor??"#22c55e",hColor=headlineColor??"white",catLbl=categoryLabel??template.categoryLabel??"TRENDING"
  return (
    <div style={{ width:w, height:h, position:"relative", overflow:"hidden", fontFamily:font }}>
      <BgImage src={imageUrl} fallback="linear-gradient(160deg,#0d1f0d 0%,#060f06 100%)" />
      <div style={{ position:"absolute", inset:0, background:BOTTOM_GRADIENT }} />
      <div style={{ position:"absolute", inset:0, background:TOP_VIGNETTE }} />
      {!hideTag && (
        <div style={{ position:"absolute", top:22, left:0, right:0, display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
          <span style={{ color:"rgba(255,255,255,.65)", fontSize:10, fontWeight:600, letterSpacing:".28em", textTransform:"uppercase" }}>{catLbl}</span>
          <div style={{ width:22, height:1.5, background:"rgba(255,255,255,.28)", borderRadius:1 }} />
        </div>
      )}
      {!hideLogo && (
        <div style={{ position:"absolute", top:18, right:18 }}><LogoPill logoUrl={logoUrl} brandText="PostFlow" /></div>
      )}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 22px 22px" }}>
        <div style={{ width:36, height:3, background:accent, borderRadius:2, marginBottom:10 }} />
        {!hideHeadline && <>
          <p style={{ color:accent, fontSize:40, fontWeight:900, lineHeight:1.1, letterSpacing:"-.02em", margin:"0 0 2px", textTransform:"uppercase", textShadow:`0 0 28px ${accent}40,0 2px 8px rgba(0,0,0,.5)` }}>{first}</p>
          <p style={{ color:hColor, fontSize:40, fontWeight:900, lineHeight:1.1, letterSpacing:"-.02em", margin:0, textTransform:"uppercase", textShadow:"0 2px 8px rgba(0,0,0,.5)" }}>{second}</p>
        </>}
      </div>
    </div>
  )
}

// ─── 3. EDITORIAL LIGHT ───────────────────────────────────────────────────────
function EditorialLight({ w, h, imageUrl, text, template, fontFamily, accentColor, categoryLabel, logoUrl, hideTag, hideHeadline, hideLogo }: LayoutProps) {
  const font=fontFamily??"system-ui,-apple-system,sans-serif",accent=accentColor??template.accentColor??"#3b82f6",catLbl=categoryLabel??template.categoryLabel??"FEATURED"
  return (
    <div style={{ width:w, height:h, position:"relative", overflow:"hidden", background:"#f8fafc", fontFamily:font }}>
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(145deg,#f8fafc 0%,#f1f5f9 55%,#e2e8f0 100%)" }} />
      {imageUrl && <img src={imageUrl} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity:.12 }} crossOrigin="anonymous" />}
      <div style={{ position:"absolute", top:-24, right:-24, width:150, height:150, background:accent, opacity:.07, borderRadius:"50%" }} />
      <div style={{ position:"absolute", bottom:-30, left:-30, width:110, height:110, background:accent, opacity:.05, borderRadius:"50%" }} />
      {(!hideTag || !hideLogo) && (
        <div style={{ position:"absolute", top:22, left:22, right:22, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          {!hideTag && (
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <div style={{ width:20, height:3, background:accent, borderRadius:2 }} />
              <span style={{ color:accent, fontSize:10, fontWeight:700, letterSpacing:".2em", textTransform:"uppercase" }}>{catLbl}</span>
            </div>
          )}
          {!hideLogo && <LogoPill logoUrl={logoUrl} brandText="PostFlow" light />}
        </div>
      )}
      {!hideHeadline && (
        <div style={{ position:"absolute", top:"50%", left:0, right:0, transform:"translateY(-55%)", padding:"0 30px", textAlign:"center" }}>
          <div style={{ width:32, height:3, background:accent, margin:"0 auto 14px", borderRadius:2 }} />
          <p style={{ color:"#0f172a", fontSize:30, fontWeight:800, lineHeight:1.25, letterSpacing:"-.02em", margin:0 }}>{text}</p>
          <div style={{ width:20, height:2, background:"#cbd5e1", margin:"14px auto 0", borderRadius:1 }} />
        </div>
      )}
      <div style={{ position:"absolute", bottom:18, left:0, right:0, textAlign:"center" }}>
        <span style={{ color:"#94a3b8", fontSize:10, letterSpacing:".14em", textTransform:"uppercase", fontWeight:500 }}>Tap to read more →</span>
      </div>
    </div>
  )
}

// ─── 4. BOLD IMPACT ───────────────────────────────────────────────────────────
function BoldImpact({ w, h, imageUrl, text, subtext, template, fontFamily, headlineColor, accentColor, categoryLabel, logoUrl, hideTag, hideHeadline, hideSubtext, hideLogo }: LayoutProps) {
  const [first, second]=splitText(text)
  const font=fontFamily??"system-ui,-apple-system,sans-serif",accent=accentColor??template.accentColor??"#f59e0b",hColor=headlineColor??"white",catLbl=categoryLabel??template.categoryLabel??"EXCLUSIVE"
  return (
    <div style={{ width:w, height:h, position:"relative", overflow:"hidden", fontFamily:font }}>
      <BgImage src={imageUrl} fallback="linear-gradient(160deg,#1a0e00 0%,#0a0a0a 100%)" />
      <div style={{ position:"absolute", inset:0, background:BOTTOM_GRADIENT }} />
      <div style={{ position:"absolute", inset:0, background:TOP_VIGNETTE }} />
      {!hideTag && (
        <div style={{ position:"absolute", top:20, left:20 }}>
          <div style={{ display:"inline-flex", alignItems:"center", background:accent, borderRadius:6, padding:"4px 12px" }}>
            <span style={{ color:"#0a0a0a", fontSize:9, fontWeight:800, letterSpacing:".14em", textTransform:"uppercase" }}>{catLbl}</span>
          </div>
        </div>
      )}
      {!hideLogo && (
        <div style={{ position:"absolute", top:18, right:18 }}><LogoPill logoUrl={logoUrl} brandText="StartupHours" /></div>
      )}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 22px 20px" }}>
        <div style={{ width:36, height:3, background:accent, borderRadius:2, marginBottom:10 }} />
        {!hideHeadline && <>
          <p style={{ color:accent, fontSize:44, fontWeight:900, lineHeight:1.05, letterSpacing:"-.03em", margin:"0 0 3px", textShadow:`0 0 40px ${accent}45,0 2px 8px rgba(0,0,0,.7)` }}>{first}</p>
          <p style={{ color:hColor, fontSize:27, fontWeight:700, lineHeight:1.18, letterSpacing:"-.02em", margin:"0 0 6px", textShadow:"0 2px 6px rgba(0,0,0,.7)" }}>{second}</p>
        </>}
        {!hideSubtext && subtext && <p style={{ color:"rgba(255,255,255,.6)", fontSize:12, lineHeight:1.4, margin:"0 0 10px" }}>{subtext}</p>}
      </div>
    </div>
  )
}

// ─── 5. CINEMATIC ─────────────────────────────────────────────────────────────
function Cinematic({ w, h, imageUrl, text, subtext, template, fontFamily, headlineColor, categoryLabel, logoUrl, hideTag, hideHeadline, hideSubtext, hideLogo }: LayoutProps) {
  const font=fontFamily??"system-ui,-apple-system,sans-serif",tint=template.tintColor||"rgba(140,18,18,.45)",hColor=headlineColor??"white",catLbl=categoryLabel??template.categoryLabel??"Ai"
  return (
    <div style={{ width:w, height:h, position:"relative", overflow:"hidden", fontFamily:font }}>
      <BgImage src={imageUrl} fallback="linear-gradient(160deg,#1f0808 0%,#0a0505 100%)" />
      <div style={{ position:"absolute", inset:0, background:`linear-gradient(160deg,${tint} 0%,rgba(0,0,0,.5) 100%)` }} />
      <div style={{ position:"absolute", inset:0, background:BOTTOM_GRADIENT }} />
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at center,transparent 35%,rgba(0,0,0,.42) 100%)" }} />
      {!hideTag && (
        <div style={{ position:"absolute", top:22, left:22 }}>
          <span style={{ color:"rgba(255,255,255,.6)", fontSize:11, fontWeight:600, letterSpacing:".2em", textTransform:"uppercase" }}>{catLbl}</span>
        </div>
      )}
      {!hideLogo && (
        <div style={{ position:"absolute", top:18, right:18 }}><LogoPill logoUrl={logoUrl} brandText="PostFlow" /></div>
      )}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 22px 24px" }}>
        <div style={{ width:36, height:3, background:"rgba(255,255,255,.5)", borderRadius:2, marginBottom:10 }} />
        {!hideHeadline && <p style={{ color:hColor, fontSize:32, fontWeight:700, lineHeight:1.28, letterSpacing:"-.015em", margin:0, textShadow:"0 2px 14px rgba(0,0,0,.8),0 1px 3px rgba(0,0,0,1)" }}>{text}</p>}
        {!hideSubtext && subtext && <p style={{ color:"rgba(255,255,255,.6)", fontSize:13, lineHeight:1.4, margin:"7px 0 0" }}>{subtext}</p>}
      </div>
    </div>
  )
}

// ─── 6. BADGE DROP ────────────────────────────────────────────────────────────
function BadgeDrop({ w, h, imageUrl, text, subtext, template, fontFamily, headlineColor, accentColor, categoryLabel, logoUrl, hideTag, hideHeadline, hideSubtext, hideLogo }: LayoutProps) {
  const font=fontFamily??"system-ui,-apple-system,sans-serif",accent=accentColor??template.accentColor??"#eab308",hColor=headlineColor??"white",catLbl=categoryLabel??template.categoryLabel??"BUSINESS"
  return (
    <div style={{ width:w, height:h, position:"relative", overflow:"hidden", fontFamily:font }}>
      <BgImage src={imageUrl} fallback="linear-gradient(160deg,#1a1500 0%,#0d0d00 100%)" />
      <div style={{ position:"absolute", inset:0, background:BOTTOM_GRADIENT }} />
      <div style={{ position:"absolute", inset:0, background:TOP_VIGNETTE }} />
      {!hideLogo && (
        <div style={{ position:"absolute", top:18, right:18 }}><LogoPill logoUrl={logoUrl} brandText="PostFlow" /></div>
      )}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 22px 20px" }}>
        <div style={{ width:40, height:3, background:accent, borderRadius:2, marginBottom:10 }} />
        {!hideTag && (
          <div style={{ marginBottom:10 }}>
            <div style={{ display:"inline-flex", background:accent, borderRadius:100, padding:"5px 16px", boxShadow:`0 3px 16px ${accent}50` }}>
              <span style={{ color:"#0a0a0a", fontSize:10, fontWeight:800, letterSpacing:".14em", textTransform:"uppercase" }}>{catLbl}</span>
            </div>
          </div>
        )}
        {!hideHeadline && <p style={{ color:hColor, fontSize:38, fontWeight:900, lineHeight:1.1, letterSpacing:"-.01em", textTransform:"uppercase", margin:`0 0 ${subtext&&!hideSubtext?6:16}px`, textShadow:"0 2px 20px rgba(0,0,0,.8)" }}>{text}</p>}
        {!hideSubtext && subtext && <p style={{ color:"rgba(255,255,255,.6)", fontSize:13, lineHeight:1.4, margin:"0 0 12px" }}>{subtext}</p>}
      </div>
    </div>
  )
}

// ─── 7. GRADIENT TEXT ─────────────────────────────────────────────────────────
function GradientText({ w, h, imageUrl: _img, text, template, fontFamily, headlineColor, categoryLabel, logoUrl, hideTag, hideHeadline, hideLogo }: LayoutProps) {
  const font=fontFamily??"system-ui,-apple-system,sans-serif",hColor=headlineColor??"white",catLbl=categoryLabel??template.categoryLabel??"INSIGHT"
  const gradients: Record<string,string> = { "flyer-gradient":"linear-gradient(145deg,#4f46e5 0%,#7c3aed 45%,#1d4ed8 100%)" }
  const bg=gradients[template.id]||"linear-gradient(145deg,#4f46e5 0%,#7c3aed 100%)"
  return (
    <div style={{ width:w, height:h, position:"relative", overflow:"hidden", fontFamily:font }}>
      <div style={{ position:"absolute", inset:0, background:bg }} />
      <div style={{ position:"absolute", bottom:-55, right:-55, width:230, height:230, borderRadius:"50%", background:"rgba(255,255,255,.06)" }} />
      <div style={{ position:"absolute", top:-50, left:-50, width:190, height:190, borderRadius:"50%", background:"rgba(255,255,255,.04)" }} />
      {!hideLogo && (
        <div style={{ position:"absolute", top:18, right:18 }}><LogoPill logoUrl={logoUrl} brandText="PostFlow" /></div>
      )}
      {!hideTag && (
        <div style={{ position:"absolute", top:24, left:0, right:0, display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
          <span style={{ color:"rgba(255,255,255,.5)", fontSize:10, fontWeight:600, letterSpacing:".28em", textTransform:"uppercase" }}>{catLbl}</span>
          <div style={{ width:18, height:1.5, background:"rgba(255,255,255,.28)", borderRadius:1 }} />
        </div>
      )}
      {!hideHeadline && (
        <div style={{ position:"absolute", top:"50%", left:0, right:0, transform:"translateY(-50%)", padding:"0 32px", textAlign:"center" }}>
          <p style={{ color:hColor, fontSize:38, fontWeight:900, lineHeight:1.12, letterSpacing:"-.025em", margin:0, textShadow:"0 2px 18px rgba(0,0,0,.22)" }}>{text}</p>
          <div style={{ width:38, height:3, background:"rgba(255,255,255,.36)", margin:"14px auto 0", borderRadius:2 }} />
        </div>
      )}
      <div style={{ position:"absolute", bottom:20, left:0, right:0, display:"flex", justifyContent:"center", gap:7, alignItems:"center" }}>
        <div style={{ width:4, height:4, borderRadius:"50%", background:"rgba(255,255,255,.3)" }} />
        <span style={{ color:"rgba(255,255,255,.38)", fontSize:10, fontWeight:600, letterSpacing:".2em", textTransform:"uppercase" }}>PostFlow</span>
        <div style={{ width:4, height:4, borderRadius:"50%", background:"rgba(255,255,255,.3)" }} />
      </div>
    </div>
  )
}

// ─── 8. STORY IMPACT ─────────────────────────────────────────────────────────
function StoryImpact({ w, h, imageUrl, text, template, fontFamily, headlineColor, accentColor, categoryLabel, logoUrl, hideTag, hideHeadline, hideLogo }: LayoutProps) {
  const font=fontFamily??"system-ui,-apple-system,sans-serif",accent=accentColor??template.accentColor??"#06b6d4",hColor=headlineColor??"white",catLbl=categoryLabel??template.categoryLabel??"STORY"
  return (
    <div style={{ width:w, height:h, position:"relative", overflow:"hidden", fontFamily:font }}>
      <BgImage src={imageUrl} fallback="linear-gradient(180deg,#0a1628 0%,#051120 50%,#020a16 100%)" />
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom,rgba(0,0,0,.38) 0%,transparent 22%,transparent 42%,rgba(0,0,0,.78) 65%,rgba(0,0,0,.96) 85%,rgba(0,0,0,1) 100%)" }} />
      <div style={{ position:"absolute", top:15, left:14, right:14, display:"flex", gap:3 }}>
        {[0,1,2,3].map(i=><div key={i} style={{ flex:1, height:2.5, borderRadius:2, background:i===0?"white":"rgba(255,255,255,.28)" }} />)}
      </div>
      {!hideTag && (
        <div style={{ position:"absolute", top:28, left:16, right:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", background:`${accent}28`, border:`2px solid ${accent}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              {!hideLogo && logoUrl
                ? <img src={logoUrl} alt="logo" style={{ width:20, height:20, objectFit:"contain", borderRadius:"50%" }} />
                : <span style={{ color:accent, fontSize:10, fontWeight:800 }}>P</span>
              }
            </div>
            <div>
              <span style={{ color:"white", fontSize:11, fontWeight:700, display:"block", lineHeight:1.2 }}>PostFlow</span>
              <span style={{ color:"rgba(255,255,255,.48)", fontSize:9, letterSpacing:".1em", textTransform:"uppercase" }}>{catLbl}</span>
            </div>
          </div>
          <span style={{ color:"rgba(255,255,255,.52)", fontSize:18, letterSpacing:".04em" }}>···</span>
        </div>
      )}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 20px 38px" }}>
        <div style={{ width:36, height:3, background:accent, borderRadius:2, marginBottom:12 }} />
        {!hideHeadline && <p style={{ color:hColor, fontSize:50, fontWeight:900, lineHeight:1.05, letterSpacing:"-.025em", margin:"0 0 16px", textShadow:"0 2px 22px rgba(0,0,0,.75)" }}>{text}</p>}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"10px 20px", background:"rgba(255,255,255,.1)", backdropFilter:"blur(8px)", borderRadius:100, border:"1px solid rgba(255,255,255,.14)" }}>
          <span style={{ color:"white", fontSize:12, fontWeight:600, letterSpacing:".08em" }}>SWIPE UP FOR MORE</span>
          <span style={{ color:"white", fontSize:14 }}>↑</span>
        </div>
      </div>
    </div>
  )
}

const LAYOUT_COMPONENTS: Record<string, React.ComponentType<LayoutProps>> = {
  "breaking":      HeadlineDrop,
  "color-pop":     AccentHeadline,
  "editorial":     EditorialLight,
  "impact":        BoldImpact,
  "dramatic":      Cinematic,
  "badge":         BadgeDrop,
  "gradient-text": GradientText,
  "story":         StoryImpact,
}

// ─── Public handle ────────────────────────────────────────────────────────────
export interface FlyerCanvasHandle {
  downloadImage: (filename?: string) => Promise<void>
}

interface FlyerCanvasProps {
  template: FlyerTemplate
  imageUrl?: string | null
  text?: string | null
  subtext?: string | null
  logoUrl?: string | null
  fontFamily?: string
  headlineColor?: string
  accentColor?: string
  categoryLabel?: string
  hideTag?: boolean
  hideHeadline?: boolean
  hideSubtext?: boolean
  hideLogo?: boolean
  previewMode?: boolean
  clipHeight?: number
  enableDownload?: boolean
  className?: string
}

export const FlyerCanvas = forwardRef<FlyerCanvasHandle, FlyerCanvasProps>(function FlyerCanvas(
  { template, imageUrl, text, subtext, logoUrl, fontFamily, headlineColor, accentColor, categoryLabel, hideTag, hideHeadline, hideSubtext, hideLogo, previewMode=false, clipHeight, enableDownload=false, className },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const nativeRef    = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    setContainerWidth(containerRef.current.getBoundingClientRect().width)
    const ro = new ResizeObserver(([e]) => setContainerWidth(e.contentRect.width))
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useImperativeHandle(ref, () => ({
    async downloadImage(filename = "flyer.png") {
      const target = nativeRef.current
      if (!target) { console.warn("[FlyerCanvas] enableDownload prop must be true"); return }

      const { w: bW, h: bH } = BASE_DIMS[template.aspectRatio]

      // html-to-image requires the element to be in the visible viewport to render
      // correctly. We briefly move it to (0,0) with near-zero opacity, capture, then
      // restore — this avoids the blank-PNG issue caused by off-screen rendering.
      const saved = {
        left:    target.style.left,
        top:     target.style.top,
        opacity: target.style.opacity,
        zIndex:  target.style.zIndex,
      }
      target.style.left    = "0px"
      target.style.top     = "0px"
      target.style.opacity = "0.01"   // invisible to user but composited by browser
      target.style.zIndex  = "9999"

      // Two animation frames ensure the browser has painted the moved element
      await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))

      try {
        const { toPng } = await import("html-to-image")
        const dataUrl = await toPng(target, { width: bW, height: bH, pixelRatio: 2 })
        const link = document.createElement("a")
        link.download = filename
        link.href = dataUrl
        link.click()
      } catch (err) {
        console.error("[FlyerCanvas] download error:", err)
        throw err
      } finally {
        target.style.left    = saved.left
        target.style.top     = saved.top
        target.style.opacity = saved.opacity
        target.style.zIndex  = saved.zIndex
      }
    },
  }), [template.aspectRatio])

  const { w: baseW, h: baseH } = BASE_DIMS[template.aspectRatio]
  const scale         = containerWidth > 0 ? containerWidth / baseW : 0
  const naturalHeight = baseH * scale

  const clipped    = clipHeight !== undefined && clipHeight < naturalHeight
  let topOffset    = 0
  if (clipped && clipHeight !== undefined) {
    const anchor = template.previewAnchor ?? "bottom"
    if (anchor === "bottom")      topOffset = naturalHeight - clipHeight
    else if (anchor === "center") topOffset = (naturalHeight - clipHeight) / 2
  }
  const containerHeight = clipped && clipHeight !== undefined ? clipHeight : naturalHeight

  const displayText = previewMode ? (template.demoText ?? "Your headline goes here") : (text ?? "")

  const Renderer = LAYOUT_COMPONENTS[template.layout]
  if (!Renderer) return null

  const rendererProps: LayoutProps = {
    w: baseW, h: baseH, imageUrl, text: displayText, subtext: subtext ?? undefined,
    template, fontFamily, headlineColor, accentColor, categoryLabel, logoUrl,
    hideTag, hideHeadline, hideSubtext, hideLogo,
  }

  return (
    <>
      <div
        ref={containerRef}
        className={cn("relative overflow-hidden w-full", className)}
        style={{ height: containerWidth > 0 ? containerHeight : undefined, minHeight: containerWidth > 0 ? undefined : "6rem" }}
      >
        {containerWidth > 0 && (
          <div style={{ position:"absolute", top:-topOffset, left:0, width:baseW, height:baseH, transform:`scale(${scale})`, transformOrigin:"top left" }}>
            <Renderer {...rendererProps} />
          </div>
        )}
      </div>

      {/* Off-screen full-size node for PNG export */}
      {enableDownload && (
        <div
          ref={nativeRef}
          aria-hidden="true"
          style={{ position:"fixed", left:-9999, top:0, width:baseW, height:baseH, pointerEvents:"none" }}
        >
          <Renderer {...rendererProps} w={baseW} h={baseH} />
        </div>
      )}
    </>
  )
})
