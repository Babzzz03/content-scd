const router = require('express').Router()
const ctrl = require('../controllers/brandVoice.controller')
const { authenticate } = require('../middleware/auth.middleware')
const w = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

router.use(authenticate)
router.get('/',     w(ctrl.getBrandVoice))
router.put('/',     w(ctrl.saveBrandVoice))
router.delete('/',  w(ctrl.deleteBrandVoice))

module.exports = router
