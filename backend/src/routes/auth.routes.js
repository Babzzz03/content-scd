const router = require('express').Router()
const ctrl = require('../controllers/auth.controller')
const { authenticate } = require('../middleware/auth.middleware')
const { handleValidation } = require('../middleware/validate.middleware')
const rateLimit = require('express-rate-limit')

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many auth attempts' })

router.post('/register', authLimiter, ctrl.registerValidation, handleValidation, asyncWrap(ctrl.register))
router.post('/login',    authLimiter, ctrl.loginValidation,    handleValidation, asyncWrap(ctrl.login))
router.post('/refresh',  asyncWrap(ctrl.refresh))
router.post('/logout',   authenticate, asyncWrap(ctrl.logout))
router.get('/me',        authenticate, asyncWrap(ctrl.me))
router.patch('/profile', authenticate, asyncWrap(ctrl.updateProfile))

function asyncWrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}

module.exports = router
