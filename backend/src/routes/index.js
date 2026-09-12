const router = require('express').Router()

router.use('/auth',         require('./auth.routes'))
router.use('/posts',        require('./post.routes'))
router.use('/generate',     require('./generate.routes'))
router.use('/platforms',    require('./platform.routes'))
router.use('/subscription', require('./subscription.routes'))
router.use('/brand-voice',  require('./brandVoice.routes'))
router.use('/ideas',        require('./contentIdea.routes'))
router.use('/leads',        require('./lead.routes'))
router.use('/whatsapp',     require('./whatsapp.routes'))

module.exports = router
