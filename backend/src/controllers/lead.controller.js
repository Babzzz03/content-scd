const Lead         = require('../models/Lead')
const PlatformAccount = require('../models/PlatformAccount')
const accountHealth   = require('../services/accountHealth.service')
const LeadCampaign = require('../models/LeadCampaign')
const { getAgenda } = require('../jobs/agenda')
const { sendLeadDm, draftForLead, canSendNow, resolveDailyCap } = require('../services/leadGen.service')
const { OUTREACH } = require('../config/constants')
const { ok, created, notFound, badRequest } = require('../utils/apiResponse')
const logger = require('../utils/logger')

// ─── Campaigns ────────────────────────────────────────────────────────────────

const listCampaigns = async (req, res) => {
  const campaigns = await LeadCampaign.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .lean()

  // Attach live send-capacity so the UI can explain why nothing is going out
  const enriched = campaigns.map((c) => {
    const gate = canSendNow(c)
    return {
      ...c,
      sendState: {
        allowed:  gate.allowed,
        reason:   gate.reason,
        capToday: gate.capToday,
        sentToday: c.sentToday || 0,
      },
      // Lets the UI show a live countdown to the next batch instead of a
      // static "in 3 minutes" that never changes
      continuesAt: c.continuesAt || null,
    }
  })

  ok(res, { campaigns: enriched })
}

const getCampaign = async (req, res) => {
  const campaign = await LeadCampaign.findOne({ _id: req.params.id, user: req.user._id }).lean()
  if (!campaign) return notFound(res, 'Campaign not found')

  const gate = canSendNow(campaign)
  ok(res, {
    campaign: {
      ...campaign,
      sendState: { ...gate, sentToday: campaign.sentToday || 0 },
    },
  })
}

const createCampaign = async (req, res) => {
  const { name, platformAccountId, search = {}, filters = {}, offer = {}, icp,
          targetLeadCount, messageSettings = {} } = req.body

  const source = req.body.source === 'google_maps' ? 'google_maps' : 'instagram'

  if (!name || !name.trim()) return badRequest(res, 'Campaign name is required')
  if (source === 'instagram' && !platformAccountId) {
    return badRequest(res, 'Select the Instagram account to run this campaign from')
  }

  const niches    = (search.niches    || []).map((s) => String(s).trim()).filter(Boolean)
  const locations = (search.locations || []).map((s) => String(s).trim()).filter(Boolean)
  if (!niches.length) return badRequest(res, 'Add at least one niche to search for')

  // Without an offer the AI has nothing to judge fit against and rejects every
  // lead as unqualified, which looks exactly like "discovery found nothing".
  if (!offer.what || !offer.what.trim()) {
    return badRequest(res, 'Describe what you sell on the Offer tab. Without it the AI cannot judge which leads fit, and will reject all of them.')
  }

  // Never let a client set a cap above the safety ceiling
  const dailyCap = Math.min(
    Number(messageSettings.dailyCap) || OUTREACH.dm.dailyCapDefault,
    OUTREACH.dm.dailyCapMax
  )

  const campaign = await LeadCampaign.create({
    user: req.user._id,
    name: name.trim(),
    source,
    region: req.body.region || 'NG',
    platformAccountId: source === 'google_maps' ? undefined : platformAccountId,
    search: { niches, locations, extraHashtags: search.extraHashtags || [] },
    filters,
    offer,
    icp: icp || '',
    targetLeadCount: Math.min(Number(targetLeadCount) || 100, 1000),
    messageSettings: { ...messageSettings, dailyCap },
    status: 'draft',
  })

  created(res, { campaign }, 'Campaign created')
}

const updateCampaign = async (req, res) => {
  const campaign = await LeadCampaign.findOne({ _id: req.params.id, user: req.user._id })
  if (!campaign) return notFound(res, 'Campaign not found')

  const allowed = ['name', 'search', 'filters', 'offer', 'icp', 'targetLeadCount', 'messageSettings', 'status']
  for (const key of allowed) {
    if (req.body[key] === undefined) continue
    if (key === 'messageSettings') {
      const ms = req.body.messageSettings
      campaign.messageSettings = {
        ...campaign.messageSettings.toObject(),
        ...ms,
        dailyCap: Math.min(Number(ms.dailyCap) || campaign.messageSettings.dailyCap, OUTREACH.dm.dailyCapMax),
      }
    } else if (key === 'search') {
      // Changing the search invalidates the cached AI hashtag expansion
      const prev = JSON.stringify(campaign.search.niches) + JSON.stringify(campaign.search.locations)
      campaign.search = { ...campaign.search.toObject(), ...req.body.search }
      const next = JSON.stringify(campaign.search.niches) + JSON.stringify(campaign.search.locations)
      if (prev !== next) campaign.search.generatedQueries = []
    } else {
      campaign[key] = req.body[key]
    }
  }

  await campaign.save()
  ok(res, { campaign }, 'Campaign updated')
}

const deleteCampaign = async (req, res) => {
  const campaign = await LeadCampaign.findOneAndDelete({ _id: req.params.id, user: req.user._id })
  if (!campaign) return notFound(res, 'Campaign not found')

  // Leads outlive their campaign so the dedupe guarantee holds: an account
  // messaged under a deleted campaign must still never be messaged again.
  await Lead.updateMany({ campaign: campaign._id }, { $unset: { campaign: 1 } })

  ok(res, {}, 'Campaign deleted. Discovered leads were kept.')
}

/** Queue a discovery run. Returns immediately — the job does the work. */
const startDiscovery = async (req, res) => {
  const campaign = await LeadCampaign.findOne({ _id: req.params.id, user: req.user._id })
  if (!campaign) return notFound(res, 'Campaign not found')
  if (campaign.status === 'discovering') return badRequest(res, 'Discovery is already running for this campaign')

  // Google campaigns use no Instagram account, so the health guard does not
  // apply to them at all — that is the point of the source.
  if (campaign.source !== 'google_maps') {
  // Pre-flight the account guard here as well as in the job. The job enforces
  // it either way, but queueing first and failing 12 seconds later reads as a
  // silent failure — the user sees "Discovery started" then nothing happens.
  const account = await PlatformAccount.findById(campaign.platformAccountId)
  if (!account) return badRequest(res, 'This campaign has no connected Instagram account')

  const siblings = await accountHealth.findSiblings(account.platform, account.username)
  const gate = accountHealth.canRun(account, { kind: 'discovery', siblings })
  if (!gate.ok) return badRequest(res, gate.reason)
  }

  await getAgenda().now('discover-leads', { campaignId: String(campaign._id) })
  campaign.status = 'discovering'
  await campaign.save()

  logger.info('startDiscovery: queued', { campaignId: String(campaign._id) })
  ok(res, { campaign }, 'Discovery started. Leads will appear as they are found.')
}

const setCampaignStatus = (status) => async (req, res) => {
  const campaign = await LeadCampaign.findOne({ _id: req.params.id, user: req.user._id })
  if (!campaign) return notFound(res, 'Campaign not found')
  campaign.status = status
  await campaign.save()
  ok(res, { campaign }, status === 'paused' ? 'Campaign paused' : 'Campaign resumed')
}

const syncCampaignReplies = async (req, res) => {
  const campaign = await LeadCampaign.findOne({ _id: req.params.id, user: req.user._id })
  if (!campaign) return notFound(res, 'Campaign not found')

  await getAgenda().now('check-lead-replies', {})
  ok(res, {}, 'Checking your inbox for replies')
}

// ─── Leads ────────────────────────────────────────────────────────────────────

const listLeads = async (req, res) => {
  const {
    campaign, status, minScore, hasWebsite, search,
    sort = 'score', page = 1, limit = 25,
  } = req.query

  const filter = { user: req.user._id }
  if (campaign) filter.campaign = campaign
  if (status)   filter.status = { $in: String(status).split(',') }
  if (minScore) filter.score = { $gte: Number(minScore) }
  if (hasWebsite !== undefined && hasWebsite !== '') filter.hasWebsite = hasWebsite === 'true'
  if (search) {
    const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$or = [{ username: rx }, { fullName: rx }, { bio: rx }, { category: rx }]
  }

  const sortMap = {
    score:     { score: -1, createdAt: -1 },
    followers: { followers: -1 },
    recent:    { createdAt: -1 },
    name:      { username: 1 },
  }

  const total = await Lead.countDocuments(filter)
  const leads = await Lead.find(filter)
    .sort(sortMap[sort] || sortMap.score)
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean()

  ok(res, { leads, total, page: Number(page), pages: Math.ceil(total / limit) })
}

const getLeadStats = async (req, res) => {
  // Mongoose casts ids automatically in find(), but NOT inside an aggregation
  // pipeline — a string campaign id silently matches nothing there, which made
  // every stat card read zero while the leads existed.
  const { Types } = require('mongoose')
  const match = { user: req.user._id }
  if (req.query.campaign && Types.ObjectId.isValid(req.query.campaign)) {
    match.campaign = new Types.ObjectId(req.query.campaign)
  }

  const byStatus = await Lead.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ])

  const counts = byStatus.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {})
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const messaged = counts.messaged || 0
  const replied  = counts.replied  || 0

  ok(res, {
    total,
    counts,
    awaitingReview: counts.drafted || 0,
    replyRate: messaged + replied > 0
      ? Math.round((replied / (messaged + replied)) * 100)
      : 0,
  })
}

const getLead = async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, user: req.user._id }).lean()
  if (!lead) return notFound(res, 'Lead not found')
  ok(res, { lead })
}

const updateLead = async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, user: req.user._id })
  if (!lead) return notFound(res, 'Lead not found')

  // Editing the message is the whole point of the review queue
  if (req.body.draftMessage !== undefined) lead.draftMessage = req.body.draftMessage
  if (req.body.approvedMessage !== undefined) lead.approvedMessage = req.body.approvedMessage
  if (req.body.status !== undefined) {
    if (lead.status === 'opted_out' && req.body.status !== 'opted_out') {
      return badRequest(res, 'This lead asked not to be contacted and cannot be reactivated')
    }
    lead.status = req.body.status
  }
  if (req.body.skipReason !== undefined) lead.skipReason = req.body.skipReason

  await lead.save()
  ok(res, { lead }, 'Lead updated')
}

/** Approve a drafted lead so the dispatcher can send it. */
const approveLead = async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, user: req.user._id })
  if (!lead) return notFound(res, 'Lead not found')
  if (lead.status === 'opted_out') return badRequest(res, 'This lead asked not to be contacted')
  if (!lead.isMessageable())       return badRequest(res, 'This lead has already been contacted')

  const message = (req.body.message || lead.draftMessage || '').trim()
  if (!message) return badRequest(res, 'There is no message to approve')

  lead.approvedMessage = message
  lead.status = 'approved'
  await lead.save()

  await LeadCampaign.updateOne({ _id: lead.campaign }, { $inc: { 'stats.approved': 1 } })
  ok(res, { lead }, 'Approved. It will send inside your campaign window.')
}

const skipLead = async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, user: req.user._id })
  if (!lead) return notFound(res, 'Lead not found')

  lead.status = 'skipped'
  lead.skipReason = req.body.reason || 'Skipped manually'
  await lead.save()
  ok(res, { lead }, 'Lead skipped')
}

/** Regenerate the AI draft, optionally after the user edited the campaign offer. */
const redraftLead = async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, user: req.user._id })
  if (!lead) return notFound(res, 'Lead not found')
  if (!lead.isMessageable()) return badRequest(res, 'This lead has already been contacted')

  const result = await draftForLead(lead._id)
  const fresh = await Lead.findById(lead._id).lean()
  ok(res, { lead: fresh, result }, result.skipped ? 'Lead was skipped by qualification' : 'New draft ready')
}

/**
 * Send one DM immediately, bypassing the drip window.
 * The daily cap still applies unless force is set, because the cap is what
 * keeps the account alive.
 */
const sendLeadNow = async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, user: req.user._id })
  if (!lead) return notFound(res, 'Lead not found')

  // Refuse before persisting anything. Writing an approved message onto a lead
  // that can never be contacted leaves a misleading record behind.
  if (lead.status === 'opted_out') return badRequest(res, 'This lead asked not to be contacted')
  if (!lead.isMessageable())      return badRequest(res, 'This lead has already been contacted')

  const message = (req.body.message || lead.approvedMessage || lead.draftMessage || '').trim()
  if (!message) return badRequest(res, 'There is no message to send')

  if (req.body.message) {
    lead.approvedMessage = message
    await lead.save()
  }

  try {
    const result = await sendLeadDm(lead._id, { force: Boolean(req.body.force) })
    const fresh = await Lead.findById(lead._id).lean()
    if (!result.sent) return ok(res, { lead: fresh, result }, result.reason)
    ok(res, { lead: fresh, result }, 'Message sent')
  } catch (err) {
    return badRequest(res, `Send failed: ${err.message}`)
  }
}

/** Approve or skip many leads at once — the main review-queue action. */
const bulkAction = async (req, res) => {
  const { ids = [], action } = req.body
  if (!Array.isArray(ids) || !ids.length) return badRequest(res, 'No leads selected')
  if (!['approve', 'skip'].includes(action)) return badRequest(res, 'Action must be approve or skip')

  const leads = await Lead.find({ _id: { $in: ids }, user: req.user._id })
  let changed = 0
  let blocked = 0

  for (const lead of leads) {
    if (!lead.isMessageable()) { blocked++; continue }

    if (action === 'approve') {
      const message = (lead.approvedMessage || lead.draftMessage || '').trim()
      if (!message) { blocked++; continue }
      lead.approvedMessage = message
      lead.status = 'approved'
    } else {
      lead.status = 'skipped'
      lead.skipReason = req.body.reason || 'Skipped in bulk review'
    }
    await lead.save()
    changed++
  }

  ok(res, { changed, blocked },
    `${changed} lead${changed === 1 ? '' : 's'} ${action === 'approve' ? 'approved' : 'skipped'}` +
    (blocked ? `, ${blocked} skipped (already contacted or no draft)` : ''))
}

/** Generate a phone or WhatsApp opener for one Google lead. */
const generateScript = async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, user: req.user._id })
  if (!lead) return notFound(res, 'Lead not found')

  const channel = req.body.channel === 'whatsapp' ? 'whatsapp' : 'call'
  const { scriptForLead } = require('../services/googleLeads.service')
  const result = await scriptForLead(lead._id, channel)
  const fresh = await Lead.findById(lead._id).lean()
  ok(res, { lead: fresh, script: result.script, hook: result.hook, objection: result.objection },
    'Script ready')
}

/**
 * Record the result of a call. This is the whole point of a call list: it is
 * worked by a human, so the app's job is to remember what happened.
 */
const recordOutcome = async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, user: req.user._id })
  if (!lead) return notFound(res, 'Lead not found')

  const OUTCOMES = ['interested', 'callback', 'not_interested', 'no_answer', 'wrong_number']
  const { outcome, method = 'call', notes } = req.body
  if (outcome && !OUTCOMES.includes(outcome)) return badRequest(res, 'Unknown call outcome')

  if (outcome) {
    lead.callOutcome = outcome
    lead.contactedAt = new Date()
    lead.contactMethod = method === 'whatsapp' ? 'whatsapp' : 'call'
    // Map the outcome onto the pipeline status
    lead.status = outcome === 'interested'      ? 'won'
                : outcome === 'not_interested'  ? 'lost'
                : outcome === 'callback'        ? 'callback'
                : 'contacted'
  }
  if (notes !== undefined) lead.notes = String(notes).slice(0, 2000)

  await lead.save()
  ok(res, { lead }, 'Saved')
}

/** CSV export of the current filter set, for working leads outside the app. */
const exportLeads = async (req, res) => {
  const filter = { user: req.user._id }
  if (req.query.campaign) filter.campaign = req.query.campaign
  if (req.query.status)   filter.status = { $in: String(req.query.status).split(',') }

  const leads = await Lead.find(filter).sort({ score: -1 }).limit(5000).lean()

  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const header = [
    'username', 'name', 'category', 'followers', 'has_website', 'email', 'phone',
    'location', 'score', 'ai_fit', 'status', 'profile_url', 'bio',
  ].join(',')

  const rows = leads.map((l) => [
    l.username, l.fullName, l.category, l.followers, l.hasWebsite ? 'yes' : 'no',
    l.contact?.email, l.contact?.phone, l.location, l.score, l.aiFit, l.status,
    l.profileUrl, (l.bio || '').replace(/\n/g, ' '),
  ].map(esc).join(','))

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="leads-${Date.now()}.csv"`)
  res.send([header, ...rows].join('\n'))
}

module.exports = {
  listCampaigns, getCampaign, createCampaign, updateCampaign, deleteCampaign,
  startDiscovery, syncCampaignReplies,
  pauseCampaign:  setCampaignStatus('paused'),
  resumeCampaign: setCampaignStatus('ready'),
  listLeads, getLeadStats, getLead, updateLead,
  approveLead, skipLead, redraftLead, sendLeadNow, bulkAction, exportLeads,
  generateScript, recordOutcome,
}
