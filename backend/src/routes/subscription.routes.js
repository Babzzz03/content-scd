const router = require('express').Router()
const express = require('express')
const ctrl = require('../controllers/subscription.controller')
const { authenticate } = require('../middleware/auth.middleware')
const w = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// Webhook needs raw body for signature verification — mount BEFORE json middleware
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body
  next()
}, w(ctrl.handleWebhook))

router.use(authenticate)
router.get('/plans',                     w(ctrl.getPlans))
router.get('/current',                   w(ctrl.getCurrentSubscription))
router.post('/checkout',                 w(ctrl.initializeCheckout))
router.get('/verify/:reference',         w(ctrl.verifyPayment))

module.exports = router
