"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { subscriptionApi } from "@/lib/api/subscription"

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading")
  const [plan, setPlan] = useState("")

  useEffect(() => {
    const reference = searchParams.get("reference") || searchParams.get("trxref")
    if (!reference) {
      setStatus("failed")
      return
    }

    subscriptionApi
      .verifyPayment(reference)
      .then(() => subscriptionApi.getCurrentSubscription())
      .then((res) => {
        setPlan(res.data.plan)
        setStatus("success")
      })
      .catch(() => setStatus("failed"))
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-sm w-full text-center space-y-5">
        {status === "loading" && (
          <>
            <Loader2 className="size-12 animate-spin text-primary mx-auto" />
            <h2 className="text-xl font-semibold">Confirming your payment…</h2>
            <p className="text-sm text-muted-foreground">This only takes a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="size-14 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">You're all set!</h2>
            <p className="text-sm text-muted-foreground">
              Your account has been upgraded to the{" "}
              <span className="font-medium text-foreground capitalize">{plan}</span> plan.
            </p>
            <Button className="w-full" onClick={() => router.push("/dashboard")}>
              Go to dashboard
            </Button>
          </>
        )}

        {status === "failed" && (
          <>
            <XCircle className="size-14 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              We couldn't verify your payment. If you were charged, please contact support with
              your transaction reference.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => router.push("/subscription")}>
                Back to plans
              </Button>
              <Button className="flex-1" onClick={() => router.push("/dashboard")}>
                Dashboard
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function SubscriptionCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  )
}
