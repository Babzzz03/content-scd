const router = require('express').Router()
const ctrl = require('../controllers/contentIdea.controller')
const { authenticate } = require('../middleware/auth.middleware')
const w = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

router.use(authenticate)
router.get('/',             w(ctrl.listIdeas))
router.post('/',            w(ctrl.saveIdeas))
router.patch('/:id/toggle', w(ctrl.toggleSaved))
router.delete('/:id',       w(ctrl.deleteIdea))

module.exports = router
