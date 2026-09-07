const paystackService = require('../services/paystack.service')
const { ok, error: apiError } = require('../utils/apiResponse')

const getPlans = async (req, res) => {
  const plans = paystackService.getPlans()
  ok(res, { plans })
}

const initializeCheckout = async (req, res) => {
  const { planId } = req.body
  const result = await paystackService.initializeSubscription(req.user, planId)
  ok(res, result, 'Checkout initialized')
}

const verifyPayment = async (req, res) => {
  const { reference } = req.params
  const data = await paystackService.verifyTransaction(reference)
  ok(res, { transaction: data })
}

const getCurrentSubscription = async (req, res) => {
  const Subscription = require('../models/Subscription')
  const sub = await Subscription.findOne({ user: req.user._id, status: 'active' })
  ok(res, {
    plan: req.user.plan,
    subscriptionStatus: req.user.subscriptionStatus,
    subscriptionExpiresAt: req.user.subscriptionExpiresAt,
    subscription: sub || null,
  })
}

/**
 * Paystack webhook — raw body is needed for signature verification.
 * Make sure to add express.raw() BEFORE this route in the router.
 */
const handleWebhook = async (req, res) => {
  const signature = req.headers['x-paystack-signature']
  if (!signature) return res.status(400).send('Missing signature')

  try {
    await paystackService.processWebhook(req.rawBody || req.body, signature)
    res.sendStatus(200)
  } catch (err) {
    apiError(res, err.message, 400)
  }
}

module.exports = { getPlans, initializeCheckout, verifyPayment, getCurrentSubscription, handleWebhook }
