const { PLANS } = require('../config/constants')
const { forbidden } = require('../utils/apiResponse')

/**
 * Factory: returns middleware that enforces a plan feature flag.
 * Usage: requireFeature('automation')
 */
const requireFeature = (feature) => (req, res, next) => {
  if (process.env.DISABLE_PLAN_CHECKS === 'true') return next()
  const plan = PLANS[req.user.plan]
  if (!plan || !plan[feature]) {
    return forbidden(res, `Your ${req.user.plan} plan does not include "${feature}". Please upgrade.`)
  }
  next()
}

/**
 * Factory: returns middleware that enforces a minimum plan tier.
 * Usage: requirePlan('pro')
 */
const PLAN_RANK = { free: 0, starter: 1, pro: 2, agency: 3 }

const requirePlan = (minPlan) => (req, res, next) => {
  if ((PLAN_RANK[req.user.plan] || 0) < (PLAN_RANK[minPlan] || 0)) {
    return forbidden(res, `This feature requires the ${minPlan} plan or higher. Please upgrade.`)
  }
  next()
}

/**
 * Checks if user has remaining AI generation quota and increments the counter.
 * Skips check if limit is -1 (unlimited) or DISABLE_AI_QUOTA=true (dev/testing).
 */
const checkAiQuota = async (req, res, next) => {
  if (process.env.DISABLE_AI_QUOTA === 'true') return next()
  await req.user.resetUsageIfNeeded()
  const limit = PLANS[req.user.plan]?.aiGenerationsPerMonth ?? 0
  if (limit !== -1 && req.user.usage.aiGenerationsThisMonth >= limit) {
    return forbidden(res, `You have used all ${limit} AI generations this month. Upgrade for more.`)
  }
  // Increment eagerly (controller is responsible for calling save if needed)
  req.user.usage.aiGenerationsThisMonth += 1
  await req.user.save()
  next()
}

/**
 * Checks if user has remaining scheduled-post quota.
 */
const checkPostQuota = async (req, res, next) => {
  if (process.env.DISABLE_PLAN_CHECKS === 'true') return next()
  await req.user.resetUsageIfNeeded()
  const limit = PLANS[req.user.plan]?.postsPerMonth ?? 0
  if (limit !== -1 && req.user.usage.postsThisMonth >= limit) {
    return forbidden(res, `You have reached your ${limit} posts/month limit. Upgrade for more.`)
  }
  next()
}

module.exports = { requireFeature, requirePlan, checkAiQuota, checkPostQuota }
