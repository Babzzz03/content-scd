const express = require('express')

const controller = require('../controllers/whatsapp.controller')

// ─── WhatsApp routes ───
//
// Mount in your app entry point:
//
//   app.use('/api/v1/whatsapp', require('./routes/whatsapp.routes'))
//
// Replace `protect` below with whatever your existing auth middleware is called.
// The webhook route is deliberately left outside it, because WAHA has no JWT.
// It is authenticated by HMAC instead, verified in whatsappInbound.service.js.

const router = express.Router()

// eslint-disable-next-line
// PostFlow's auth middleware exports `authenticate`, not `protect`
const { authenticate: protect } = require('../middleware/auth.middleware')

// ─── Public ───

// express.raw, not express.json. The HMAC is computed over the exact bytes WAHA
// sent, and a parsed then re-serialised body will not match. Key order and
// whitespace both change, and the signature check fails in a way that looks like
// a wrong secret.
router.post('/webhook', express.raw({ type: 'application/json' }), controller.webhook)

// ─── Authenticated ───

router.use(protect)

router.post('/connect', controller.connect)
router.get('/status', controller.status)
router.post('/pause', controller.pause)
router.post('/disconnect', controller.disconnect)

router.post('/send', controller.queueSend)

router.get('/conversations', controller.listConversations)
router.get('/conversations/:id/messages', controller.listMessages)

module.exports = router
