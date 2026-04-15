"use client"

import { useState } from "react"
import {
  Mic2,
  Plus,
  Edit2,
  Sparkles,
  Loader2,
  Save,
  X,
  Target,
  Users,
  MessageSquare,
  Palette,
  Hash,
  CheckCircle2,
  BookOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { analyzeBrandVoice } from "@/lib/ai-mock"
import { DUMMY_BRAND_VOICE } from "@/lib/dummy-data"
import type { BrandVoice, ContentTone } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const TONES: { value: ContentTone; label: string; description: string }[] = [
  { value: "professional", label: "Professional", description: "Authoritative and polished" },
  { value: "casual", label: "Casual", description: "Friendly and approachable" },
  { value: "humorous", label: "Humorous", description: "Witty and playful" },
  { value: "educational", label: "Educational", description: "Informative and clear" },
  { value: "inspirational", label: "Inspirational", description: "Uplifting and motivating" },
  { value: "promotional", label: "Promotional", description: "Sales-focused and compelling" },
  { value: "bold", label: "Bold", description: "Confident and direct" },
  { value: "empathetic", label: "Empathetic", description: "Warm and understanding" },
]

export default function BrandVoicePage() {
  const [brand, setBrand] = useState<Partial<BrandVoice>>(DUMMY_BRAND_VOICE)
  const [isEditing, setIsEditing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [newKeyMessage, setNewKeyMessage] = useState("")
  const [newCompetitor, setNewCompetitor] = useState("")

  const updateBrand = (updates: Partial<BrandVoice>) => {
    setBrand((prev) => ({ ...prev, ...updates }))
  }

  const toggleTone = (tone: ContentTone) => {
    const current = brand.tone ?? []
    const updated = current.includes(tone)
      ? current.filter((t) => t !== tone)
      : [...current, tone]
    updateBrand({ tone: updated })
  }

  const addKeyMessage = () => {
    if (!newKeyMessage.trim()) return
    updateBrand({ keyMessages: [...(brand.keyMessages ?? []), newKeyMessage.trim()] })
    setNewKeyMessage("")
    console.log("[BRAND VOICE] Added key message:", newKeyMessage)
  }

  const removeKeyMessage = (msg: string) => {
    updateBrand({ keyMessages: brand.keyMessages?.filter((m) => m !== msg) })
  }

  const addCompetitor = () => {
    if (!newCompetitor.trim()) return
    updateBrand({ competitors: [...(brand.competitors ?? []), newCompetitor.trim()] })
    setNewCompetitor("")
  }

  const removeCompetitor = (c: string) => {
    updateBrand({ competitors: brand.competitors?.filter((x) => x !== c) })
  }

  const handleAnalyze = async () => {
    if (!brand.brandName || !brand.targetAudience) {
      toast.error("Add your brand name and target audience first")
      return
    }

    setIsAnalyzing(true)
    try {
      const description = `${brand.brandName}: ${brand.styleNotes ?? brand.tagline ?? ""}`
      const result = await analyzeBrandVoice(description)
      updateBrand({
        keyMessages: result.suggestedMessages,
        styleNotes: result.styleNotes,
      })
      toast.success("AI analysis complete!", {
        description: "Key messages and style notes updated",
      })
    } catch {
      toast.error("Analysis failed. Please try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSave = () => {
    const payload = { ...brand, updatedAt: new Date() }
    console.log("[BRAND VOICE] Save:", payload)
    setIsEditing(false)
    toast.success("Brand Voice saved!", {
      description: "Your brand profile has been updated",
    })
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Page header */}
      <div data-tour="page-brand-voice" className="sticky top-0 z-10 bg-background flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5 border-b">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Mic2 className="size-4 sm:size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-semibold leading-tight">Brand Voice</h1>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-none">
              Define your brand's personality to power smarter AI content
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save data-icon="inline-start" />
                Save Profile
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => setIsEditing(true)}>
              <Edit2 data-icon="inline-start" />
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-7xl">
        {/* Status alert — full width */}
        {brand.brandName && !isEditing && (
          <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 mb-6">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <AlertDescription className="text-sm text-emerald-700 dark:text-emerald-400">
              <span className="font-medium">Brand Voice is active.</span> AI will use this profile
              when "Use Brand Voice" is toggled on in post creation or content ideas.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 lg:items-start">
          {/* ── Left column ── */}
          <div className="space-y-6">
            {/* Brand basics */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Target className="size-4 text-primary" />
                  <CardTitle className="text-sm">Brand Identity</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Core information about your brand
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="brand-name">Brand name</Label>
                    <Input
                      id="brand-name"
                      placeholder="Nova Studio"
                      value={brand.brandName ?? ""}
                      onChange={(e) => updateBrand({ brandName: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry / Niche</Label>
                    <Input
                      id="industry"
                      placeholder="Digital Marketing, SaaS, Fitness..."
                      value={brand.industry ?? ""}
                      onChange={(e) => updateBrand({ industry: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tagline">
                    Tagline{" "}
                    <span className="text-muted-foreground text-xs">(optional)</span>
                  </Label>
                  <Input
                    id="tagline"
                    placeholder="e.g. Ideas that move people"
                    value={brand.tagline ?? ""}
                    onChange={(e) => updateBrand({ tagline: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Brand description */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="size-4 text-primary" />
                  <CardTitle className="text-sm">About Your Brand</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Describe what your brand does, your story, and anything else the AI should know
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="brand-description">Brand description</Label>
                  <Textarea
                    id="brand-description"
                    placeholder={`Tell the AI about your brand. For example:\n\n"We are a fitness coaching brand helping busy professionals build sustainable workout habits. We offer 1-on-1 online coaching, a 12-week transformation programme, and a community app."`}
                    rows={6}
                    value={brand.description ?? ""}
                    onChange={(e) => updateBrand({ description: e.target.value })}
                    disabled={!isEditing}
                    className="resize-none text-sm leading-relaxed"
                  />
                  {!isEditing && !brand.description && (
                    <p className="text-xs text-muted-foreground italic">
                      No description added yet. Click Edit Profile to add one.
                    </p>
                  )}
                  {isEditing && (
                    <p className="text-xs text-muted-foreground">
                      The more detail you give, the more accurate and on-brand the AI content will be.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Audience */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  <CardTitle className="text-sm">Target Audience</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="audience">Who are you speaking to?</Label>
                  <Textarea
                    id="audience"
                    placeholder="e.g. Entrepreneurs and small business owners aged 25-45 who want to grow their digital presence..."
                    rows={3}
                    value={brand.targetAudience ?? ""}
                    onChange={(e) => updateBrand({ targetAudience: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Style notes */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Palette className="size-4 text-primary" />
                  <CardTitle className="text-sm">Style & Voice Notes</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="style-notes">How should the AI write for you?</Label>
                  <Textarea
                    id="style-notes"
                    placeholder="e.g. Avoid corporate language. Use short, punchy sentences. Include rhetorical questions. Speak like a trusted expert friend..."
                    rows={4}
                    value={brand.styleNotes ?? ""}
                    onChange={(e) => updateBrand({ styleNotes: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>

                {/* Competitors */}
                <div className="space-y-2">
                  <Label>Competitors to differentiate from</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {(brand.competitors ?? []).map((c) => (
                      <Badge key={c} variant="secondary" className="text-xs gap-1">
                        {c}
                        {isEditing && (
                          <button onClick={() => removeCompetitor(c)}>
                            <X className="size-2.5" />
                          </button>
                        )}
                      </Badge>
                    ))}
                  </div>
                  {isEditing && (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Competitor name..."
                        value={newCompetitor}
                        onChange={(e) => setNewCompetitor(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addCompetitor()}
                        className="text-sm"
                      />
                      <Button variant="outline" size="sm" onClick={addCompetitor}>
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Right column ── */}
          <div className="space-y-6">
            {/* Tone */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-primary" />
                  <CardTitle className="text-sm">Tone of Voice</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Select all tones that represent your brand (you can pick multiple)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {TONES.map((t) => {
                    const selected = brand.tone?.includes(t.value) ?? false
                    return (
                      <button
                        key={t.value}
                        onClick={() => isEditing && toggleTone(t.value)}
                        disabled={!isEditing}
                        className={cn(
                          "rounded-lg border-2 p-3 text-left transition-all",
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border bg-background",
                          !isEditing && "cursor-default opacity-80"
                        )}
                      >
                        <p className="text-xs font-medium">{t.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {t.description}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Key messages */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Hash className="size-4 text-primary" />
                  <CardTitle className="text-sm">Key Messages</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Core statements the AI will weave into your content
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col gap-2">
                  {(brand.keyMessages ?? []).map((msg) => (
                    <div
                      key={msg}
                      className="flex items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2"
                    >
                      <span className="size-1.5 mt-1.5 rounded-full bg-primary shrink-0" />
                      <p className="flex-1 text-sm leading-relaxed">{msg}</p>
                      {isEditing && (
                        <button
                          onClick={() => removeKeyMessage(msg)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {isEditing && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a key message..."
                      value={newKeyMessage}
                      onChange={(e) => setNewKeyMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addKeyMessage()}
                    />
                    <Button variant="outline" size="sm" onClick={addKeyMessage}>
                      <Plus className="size-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Analyze */}
            {isEditing && (
              <div className="rounded-xl border bg-primary/5 border-primary/20 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h3 className="text-sm font-semibold">AI Brand Analysis</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Let the AI analyze your brand description and suggest key messages and style notes
                  automatically.
                </p>
                <Button
                  variant="outline"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !brand.brandName}
                  className="w-full"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="size-3.5 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles data-icon="inline-start" />
                      Analyze & Suggest
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
