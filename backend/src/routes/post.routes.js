const router = require('express').Router()
const ctrl = require('../controllers/post.controller')
const { authenticate } = require('../middleware/auth.middleware')
const { checkPostQuota, requireFeature } = require('../middleware/plan.middleware')
const { upload, handleUploadError } = require('../middleware/upload.middleware')

const w = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

router.use(authenticate)

router.get('/',              w(ctrl.listPosts))
router.get('/stats',         w(ctrl.getStats))
router.get('/:id',           w(ctrl.getPost))

router.post(
  '/',
  checkPostQuota,
  handleUploadError(upload.array('media', 10)),
  w(ctrl.createPost)
)

router.patch('/:id',         w(ctrl.updatePost))
router.delete('/:id',        w(ctrl.deletePost))
router.post('/:id/publish',  requireFeature('automation'), w(ctrl.publishNow))
router.post('/engage',       requireFeature('automation'), w(ctrl.engageNow))

module.exports = router
