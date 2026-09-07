const router = require('express').Router()
const ctrl = require('../controllers/lead.controller')
const { authenticate } = require('../middleware/auth.middleware')
const { requireFeature } = require('../middleware/plan.middleware')
const rateLimit = require('express-rate-limit')

const w = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// Discovery and sending both drive a real browser — throttle them hard so a
// runaway client cannot queue dozens of concurrent automation runs.
const automationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many automation requests, please wait a moment',
})

router.use(authenticate, requireFeature('leads'))

// ── Campaigns ────────────────────────────────────────────────────────────────
router.get('/campaigns',            w(ctrl.listCampaigns))
router.post('/campaigns',           w(ctrl.createCampaign))
router.get('/campaigns/:id',        w(ctrl.getCampaign))
router.patch('/campaigns/:id',      w(ctrl.updateCampaign))
router.delete('/campaigns/:id',     w(ctrl.deleteCampaign))
router.post('/campaigns/:id/discover',     automationLimiter, w(ctrl.startDiscovery))
router.post('/campaigns/:id/pause',        w(ctrl.pauseCampaign))
router.post('/campaigns/:id/resume',       w(ctrl.resumeCampaign))
router.post('/campaigns/:id/sync-replies', automationLimiter, w(ctrl.syncCampaignReplies))

// ── Leads ────────────────────────────────────────────────────────────────────
// Static paths must precede /:id or "stats" and "export" match as ids
router.get('/stats',    w(ctrl.getLeadStats))
router.get('/export',   w(ctrl.exportLeads))
router.post('/bulk',    w(ctrl.bulkAction))

router.get('/',            w(ctrl.listLeads))
router.get('/:id',         w(ctrl.getLead))
router.patch('/:id',       w(ctrl.updateLead))
router.post('/:id/approve', w(ctrl.approveLead))
router.post('/:id/skip',    w(ctrl.skipLead))
router.post('/:id/draft',   automationLimiter, w(ctrl.redraftLead))
router.post('/:id/send',    automationLimiter, w(ctrl.sendLeadNow))

// ── Google Maps call list ────────────────────────────────────────────────────
router.post('/:id/script',  automationLimiter, w(ctrl.generateScript))
router.post('/:id/outcome', w(ctrl.recordOutcome))

module.exports = router
