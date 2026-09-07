"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Check, Zap, Loader2, Crown, Rocket, Building2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { subscriptionApi, type Plan } from "@/lib/api/subscription"
import { cn } from "@/lib/utils"

const PLAN_META: Record<string, { icon: React.ReactNode; color: string; popular?: boolean }> = {
  free:    { icon: <Sparkles className="size-5" />, color: "text-muted-foreground" },
  starter: { icon: <Rocket className="size-5" />, color: "text-blue-500" },
  pro:     { icon: <Crown className="size-5" />, color: "text-violet-500", popular: true },
  agency:  { icon: <Building2 className="size-5" />, color: "text-orange-500" },
}

function SubscriptionContent() {
  const searchParams = useSearchParams()
  const [plans, setPlans] = useState<Plan[]>([])
  const [currentPlan, setCurrentPlan] = useState<string>("free")
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")

  useEffect(() => {
    Promise.all([subscriptionApi.getPlans(), subscriptionApi.getCurrentSubscription()])
      .then(([plansRes, subRes]) => {
        setPlans(plansRes.data.plans)
        setCurrentPlan(subRes.data.plan)
      })
      .catch(() => setError("Failed to load plans. Please refresh."))
  }, [])

  // Handle Paystack redirect-back with ?reference=xxx
  useEffect(() => {
    const ref = searchParams.get("reference")
    if (!ref) return
    setVerifying(true)
    subscriptionApi
      .verifyPayment(ref)
      .then(() => {
        setSuccessMsg("Payment confirmed! Your plan has been upgraded.")
        return subscriptionApi.getCurrentSubscription()
      })
      .then((res) => setCurrentPlan(res.data.plan))
      .catch(() => setError("Payment verification failed. Contact support if you were charged."))
      .finally(() => setVerifying(false))
  }, [searchParams])

  const handleSelect = async (plan: Plan) => {
    if (plan.id === "free" || plan.id === currentPlan) return
    setError("")
    setLoadingPlanId(plan.id)
    try {
      const res = await subscriptionApi.initializeCheckout(plan.id)
      window.location.href = res.data.authorizationUrl
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not start checkout. Please try again.")
      setLoadingPlanId(null)
    }
  }

  const formatFeature = (val: string | number | boolean, key: string): string => {
    if (typeof val === "boolean") return val ? "Yes" : "No"
    if (val === -1) return "Unlimited"
    if (key === "platforms") return `${val} platform${Number(val) !== 1 ? "s" : ""}`
    return String(val)
  }

  const featureLabels: Record<string, string> = {
    postsPerMonth: "Posts / month",
    aiGenerations: "AI generations",
    platforms: "Connected platforms",
    scheduling: "Post scheduling",
    automation: "Auto-publishing",
    brandVoice: "Brand voice AI",
  }

  if (verifying) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
        <p className="text-sm">Verifying your payment…</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Zap className="size-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Choose your plan</h1>
        </div>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Scale your social media presence. Upgrade or downgrade at any time.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-600 dark:text-green-400 text-center">
          {successMsg}
        </div>
      )}

      {/* Plans grid */}
      {plans.length === 0 && !error ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const meta = PLAN_META[plan.id] ?? PLAN_META.free
            const isCurrent = plan.id === currentPlan
            const isFree = plan.id === "free"
            const isLoading = loadingPlanId === plan.id

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative flex flex-col overflow-hidden transition-shadow",
                  meta.popular && "ring-2 ring-primary shadow-lg",
                  isCurrent && "ring-2 ring-green-500"
                )}
              >
                {meta.popular && !isCurrent && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500" />
                )}
                {isCurrent && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-green-500" />
                )}

                <CardHeader className="pb-3 pt-5 px-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className={cn("flex items-center gap-2 font-semibold", meta.color)}>
                      {meta.icon}
                      <span className="capitalize text-foreground">{plan.label}</span>
                    </div>
                    {meta.popular && !isCurrent && (
                      <Badge variant="secondary" className="text-xs">Popular</Badge>
                    )}
                    {isCurrent && (
                      <Badge className="text-xs bg-green-500 hover:bg-green-500">Current</Badge>
                    )}
                  </div>

                  <div className="mt-3">
                    {plan.priceMonthly === 0 ? (
                      <div className="text-2xl font-bold">Free</div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold">
                          ₦{plan.priceMonthly.toLocaleString()}
                        </span>
                        <span className="text-sm text-muted-foreground">/mo</span>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 px-4 pb-4 gap-4">
                  {/* Feature list */}
                  <ul className="space-y-2 flex-1">
                    {(Object.keys(featureLabels) as (keyof typeof plan.features)[]).map((key) => {
                      const val = plan.features[key]
                      const formatted = formatFeature(val as string | number | boolean, key)
                      const disabled = val === false || val === 0
                      return (
                        <li key={key} className={cn("flex items-start gap-2 text-sm", disabled && "opacity-40")}>
                          <Check
                            className={cn(
                              "size-4 mt-0.5 shrink-0",
                              disabled ? "text-muted-foreground" : "text-green-500"
                            )}
                          />
                          <span>
                            <span className="font-medium">{formatted}</span>{" "}
                            <span className="text-muted-foreground">{featureLabels[key]}</span>
                          </span>
                        </li>
                      )
                    })}
                  </ul>

                  {/* CTA */}
                  <Button
                    className="w-full"
                    variant={meta.popular ? "default" : "outline"}
                    disabled={isCurrent || isFree || isLoading}
                    onClick={() => handleSelect(plan)}
                  >
                    {isLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
                    {isCurrent
                      ? "Current plan"
                      : isFree
                      ? "Free forever"
                      : `Upgrade to ${plan.label}`}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Footer note */}
      <p className="text-center text-xs text-muted-foreground">
        Payments are processed securely via Paystack. Cancel anytime from your account settings.
      </p>
    </div>
  )
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <SubscriptionContent />
    </Suspense>
  )
}
