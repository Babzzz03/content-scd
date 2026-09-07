const router = require('express').Router()
const ctrl = require('../controllers/generate.controller')
const { authenticate } = require('../middleware/auth.middleware')
const { checkAiQuota } = require('../middleware/plan.middleware')
const rateLimit = require('express-rate-limit')

const genLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: 'Generation rate limit exceeded' })
const w = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

router.use(authenticate, genLimiter, checkAiQuota)

router.post('/post',          w(ctrl.generatePost))
router.post('/ideas',         w(ctrl.generateIdeas))
router.post('/post-ideas',    w(ctrl.generatePostIdeas))
router.post('/brand-voice',   w(ctrl.generateBrandVoice))
router.post('/strategy',      w(ctrl.generateStrategy))
router.post('/reply',         w(ctrl.generateReply))
router.post('/engagements',   w(ctrl.generateEngagements))

module.exports = router
