const router = require('express').Router()
const ctrl = require('../controllers/platform.controller')
const { authenticate } = require('../middleware/auth.middleware')
const w = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

router.use(authenticate)
router.get('/',          w(ctrl.listAccounts))
router.post('/',         w(ctrl.connectAccount))
router.patch('/:id',       w(ctrl.updateCredentials))
router.post('/:id/verify', w(ctrl.verifyCookie))
router.post('/:id/clear-health', w(ctrl.clearAccountHealth))
router.delete('/:id',      w(ctrl.disconnectAccount))

module.exports = router
