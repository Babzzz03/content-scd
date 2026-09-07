import { get, post } from './client'

export interface Plan {
  id: string
  label: string
  priceMonthly: number
  features: {
    postsPerMonth: string | number
    aiGenerations: string | number
    platforms: number
    scheduling: boolean
    automation: boolean
    brandVoice: boolean
  }
  paystackPlanCode: string | null
}

export const subscriptionApi = {
  getPlans: () => get<{ data: { plans: Plan[] } }>('/subscription/plans'),

  getCurrentSubscription: () =>
    get<{ data: { plan: string; subscriptionStatus: string; subscriptionExpiresAt: string | null } }>(
      '/subscription/current'
    ),

  initializeCheckout: (planId: string) =>
    post<{ data: { authorizationUrl: string; reference: string } }>('/subscription/checkout', { planId }),

  verifyPayment: (reference: string) =>
    get<{ data: { transaction: unknown } }>(`/subscription/verify/${reference}`),
}
