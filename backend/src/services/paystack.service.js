const axios = require('axios')
const crypto = require('crypto')
const User = require('../models/User')
const Subscription = require('../models/Subscription')
const { PLANS } = require('../config/constants')
const logger = require('../utils/logger')

const PAYSTACK_BASE = 'https://api.paystack.co'

const http = axios.create({
  baseURL: PAYSTACK_BASE,
  headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
})

// ─── Plans ────────────────────────────────────────────────────────────────────

/**
 * Return available paid plans with their Paystack plan codes.
 * The frontend subscription page calls this to render the pricing table.
 */
const getPlans = () =>
  Object.entries(PLANS)
    .map(([key, p]) => ({
      id: key,
      label: p.label,
      priceMonthly: p.priceMonthly,
      features: {
        postsPerMonth: p.postsPerMonth === -1 ? 'Unlimited' : p.postsPerMonth,
        aiGenerations: p.aiGenerationsPerMonth === -1 ? 'Unlimited' : p.aiGenerationsPerMonth,
        platforms: p.platforms,
        scheduling: p.scheduling,
        automation: p.automation,
        brandVoice: p.brandVoice,
      },
      paystackPlanCode: p.paystackPlanCode || null,
    }))

// ─── Initialize transaction ───────────────────────────────────────────────────

/**
 * Creates or retrieves a Paystack customer, then initializes a transaction
 * (one-time or subscription). Returns the checkout authorization_url.
 */
const initializeSubscription = async (user, planId) => {
  const plan = PLANS[planId]
  if (!plan || planId === 'free') throw new Error('Invalid plan')
  if (!plan.paystackPlanCode) throw new Error(`No Paystack plan code configured for ${planId}`)

  let customerId = user.paystackCustomerId

  // Create Paystack customer if not yet created
  if (!customerId) {
    const { data } = await http.post('/customer', {
      email: user.email,
      first_name: user.name.split(' ')[0],
      last_name: user.name.split(' ').slice(1).join(' ') || '',
    })
    customerId = data.data.customer_code
    await User.findByIdAndUpdate(user._id, { paystackCustomerId: customerId })
  }

  // Initialize subscription transaction
  const { data } = await http.post('/transaction/initialize', {
    email: user.email,
    plan: plan.paystackPlanCode,
    amount: plan.priceMonthly * 100,  // Paystack uses kobo (NGN cents)
    callback_url: `${process.env.FRONTEND_URL}/subscription/callback`,
    metadata: { userId: user._id.toString(), planId },
  })

  return {
    authorizationUrl: data.data.authorization_url,
    reference: data.data.reference,
    accessCode: data.data.access_code,
  }
}

// ─── Verify transaction ───────────────────────────────────────────────────────

const verifyTransaction = async (reference) => {
  const { data } = await http.get(`/transaction/verify/${reference}`)
  return data.data
}

// ─── Webhook handler ──────────────────────────────────────────────────────────

/**
 * Verifies Paystack webhook signature and processes the event.
 * Call this from the webhook route BEFORE parsing req.body so the raw body
 * is available. (Pass raw body buffer as `rawBody`.)
 */
const processWebhook = async (rawBody, signature) => {
  const expectedSig = crypto
    .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')

  if (expectedSig !== signature) throw new Error('Webhook signature mismatch')

  const event = JSON.parse(rawBody)
  logger.info('Paystack webhook', { event: event.event })

  switch (event.event) {
    case 'charge.success':
      await handleChargeSuccess(event.data)
      break
    case 'subscription.create':
      await handleSubscriptionCreate(event.data)
      break
    case 'subscription.disable':
    case 'subscription.not_renew':
      await handleSubscriptionEnd(event.data)
      break
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data)
      break
    default:
      logger.debug('Unhandled Paystack event', { event: event.event })
  }
}

// ─── Private event handlers ───────────────────────────────────────────────────

const handleChargeSuccess = async (data) => {
  const { metadata, plan } = data
  if (!metadata?.userId || !metadata?.planId) return

  const planId = metadata.planId
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // +30 days

  await User.findByIdAndUpdate(metadata.userId, {
    plan: planId,
    subscriptionStatus: 'active',
    subscriptionExpiresAt: expiresAt,
  })
  logger.info('Subscription activated', { userId: metadata.userId, plan: planId })
}

const handleSubscriptionCreate = async (data) => {
  const userId = data.metadata?.userId
  if (!userId) return

  await Subscription.findOneAndUpdate(
    { paystackSubscriptionCode: data.subscription_code },
    {
      user: userId,
      plan: data.plan?.plan_code,
      paystackSubscriptionCode: data.subscription_code,
      paystackCustomerCode: data.customer?.customer_code,
      paystackPlanCode: data.plan?.plan_code,
      status: 'active',
      currentPeriodStart: new Date(data.created_at),
      currentPeriodEnd: new Date(data.next_payment_date),
    },
    { upsert: true, new: true }
  )
  await User.findByIdAndUpdate(userId, {
    paystackSubscriptionCode: data.subscription_code,
  })
}

const handleSubscriptionEnd = async (data) => {
  const sub = await Subscription.findOne({
    paystackSubscriptionCode: data.subscription_code,
  })
  if (!sub) return
  sub.status = 'cancelled'
  sub.cancelledAt = new Date()
  await sub.save()
  await User.findByIdAndUpdate(sub.user, {
    plan: 'free',
    subscriptionStatus: 'inactive',
    paystackSubscriptionCode: null,
  })
  logger.info('Subscription ended', { userId: sub.user })
}

const handlePaymentFailed = async (data) => {
  const sub = await Subscription.findOne({
    paystackSubscriptionCode: data.subscription?.subscription_code,
  })
  if (!sub) return
  sub.status = 'past_due'
  await sub.save()
  await User.findByIdAndUpdate(sub.user, { subscriptionStatus: 'past_due' })
  logger.warn('Payment failed', { userId: sub.user })
}

module.exports = { getPlans, initializeSubscription, verifyTransaction, processWebhook }
