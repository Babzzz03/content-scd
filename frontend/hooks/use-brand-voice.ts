"use client"

import { useEffect, useState } from "react"
import { brandVoiceApi, createEmptyBrandVoice } from "@/lib/api/brand-voice"
import type { BrandVoice } from "@/lib/types"

export function useBrandVoice() {
  const [brandVoice, setBrandVoice] = useState<BrandVoice | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const data = await brandVoiceApi.get()
        const hasData = Boolean(
          data.brandName ||
          data.industry ||
          data.targetAudience ||
          data.description ||
          (data.keyMessages?.length ?? 0) > 0
        )
        setBrandVoice(hasData ? data : null)
      } catch {
        setBrandVoice(null)
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [])

  return {
    brandVoice: brandVoice ?? createEmptyBrandVoice(),
    hasBrandVoice: !!brandVoice,
    isLoading,
  }
}
