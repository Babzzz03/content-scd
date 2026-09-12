/**
 * Follow-up sequencing.
 *
 * Most replies to cold outreach arrive on the second or third touch. Before
 * this, a lead who did not answer was simply abandoned, which threw away the
 * majority of the response rate.
 *
 * The rules that matter are the ones that stop a sequence, not the ones that
 * continue it. A follow-up sent to someone who already replied, or who asked to
 * be left alone, is worse than no follow-up at all.
 */
const Lead         = require('../models/Lead')
const LeadCampaign = require('../models/LeadCampaign')
const { draftFollowUp } = require('./deepseek.service')
const { alreadyContacted } = require('./leadIdentity.service')
const logger = require('../utils/logger')

/** Statuses that permanently end a sequence. */
const TERMINAL = ['replied', 'opted_out', 'won', 'lost', 'skipped', 'failed']

/**
 * Work out when the next touch is due, or null if the sequence is finished.
 *
 * Counts the original message as touch 1, so delaysDays[0] is the gap before
 * touch 2.
 */
const nextDueAt = (lead, campaign) => {
  const cfg = campaign.followUp || {}
  if (!cfg.enabled) return null

  const maxTouches = cfg.maxTouches ?? 3
  const delays = cfg.delaysDays?.length ? cfg.delaysDays : [3, 6]

  const touches = lead.touches || 0
  if (touches < 1) return null            // never messaged, nothing to follow up
  if (touches >= maxTouches) return null  // sequence complete

  // delays[0] is the gap between touch 1 and touch 2
  const gapDays = delays[Math.min(touches - 1, delays.length - 1)]
  const from = lead.lastTouchAt ? new Date(lead.lastTouchAt).getTime() : Date.now()
  return new Date(from + gapDays * 86400000)
}

/**
 * Record that a message was delivered and schedule the next touch.
 * Called by whichever sender actually delivered it.
 */
const recordTouch = async (leadId, { text, channel = 'dm' }) => {
  const lead = await Lead.findById(leadId)
  if (!lead) return null

  lead.touches = (lead.touches || 0) + 1
  lead.lastTouchAt = new Date()
  lead.touchHistory.push({ touch: lead.touches, text, sentAt: lead.lastTouchAt, channel })

  const campaign = await LeadCampaign.findById(lead.campaign)
  lead.nextFollowUpAt = campaign ? nextDueAt(lead, campaign) : null

  await lead.save()
  logger.info('followUp: touch recorded', {
    lead: lead.username || lead.fullName,
    touch: lead.touches,
    nextDue: lead.nextFollowUpAt?.toISOString() || 'sequence complete',
  })
  return lead
}

/**
 * Stop a sequence. Called when someone replies or opts out.
 * Idempotent, so it is safe to call from a reply scan that re-reads old threads.
 */
const stopSequence = async (leadId, reason = 'replied') => {
  await Lead.updateOne({ _id: leadId }, { nextFollowUpAt: null })
  logger.info('followUp: sequence stopped', { leadId: String(leadId), reason })
}

/**
 * Every reason a due follow-up must not be sent.
 *
 * Checked at send time rather than schedule time, because a lead can reply in
 * the days between the two, and the whole point is to not message someone who
 * has already answered.
 */
const blockReason = async (lead, campaign) => {
  if (!campaign) return 'campaign deleted'
  if (!campaign.followUp?.enabled) return 'follow-ups disabled on the campaign'
  if (campaign.status === 'paused') return 'campaign paused'
  if (lead.optedOut) return 'lead opted out'
  if (TERMINAL.includes(lead.status)) return `lead is ${lead.status}`
  if ((lead.touches || 0) >= (campaign.followUp.maxTouches ?? 3)) return 'sequence complete'

  // The same business may have been reached through the other source since
  const twin = await alreadyContacted(lead)
  if (twin && String(twin._id) !== String(lead._id)) {
    return `already contacted via ${twin.source === 'google_maps' ? 'phone' : 'Instagram'}`
  }
  return null
}

/**
 * Find leads whose next touch is due and prepare a draft for each.
 *
 * Drafting here rather than at send time means a human can still read and edit
 * the follow-up before it goes, which is the same review-queue model the first
 * message uses.
 */
const prepareDueFollowUps = async ({ limit = 25 } = {}) => {
  const due = await Lead.find({
    nextFollowUpAt: { $ne: null, $lte: new Date() },
    optedOut: { $ne: true },
    status: { $nin: TERMINAL },
  })
    .sort({ nextFollowUpAt: 1 })
    .limit(limit)

  const prepared = []
  for (const lead of due) {
    const campaign = await LeadCampaign.findById(lead.campaign)
    const reason = await blockReason(lead, campaign)

    if (reason) {
      await stopSequence(lead._id, reason)
      logger.info('followUp: skipped', { lead: lead.username || lead.fullName, reason })
      continue
    }

    try {
      const offer = campaign.offer?.toObject ? campaign.offer.toObject() : (campaign.offer || {})
      const draft = await draftFollowUp({
        lead,
        offer,
        previousTouches: lead.touchHistory || [],
        touchNumber: (lead.touches || 1) + 1,
        channel: lead.source === 'google_maps' ? 'whatsapp' : 'dm',
      })

      lead.draftMessage = draft.message
      // Back into the review queue, exactly like a first-touch draft
      lead.status = lead.source === 'google_maps' ? 'to_call' : 'drafted'
      lead.nextFollowUpAt = null   // cleared so it is not re-prepared each tick
      await lead.save()

      prepared.push({ lead: lead.username || lead.fullName, touch: (lead.touches || 1) + 1, angle: draft.angle })
    } catch (err) {
      logger.warn('followUp: drafting failed, will retry next tick', {
        lead: lead.username || lead.fullName, err: err.message,
      })
    }
  }

  if (prepared.length) logger.info('followUp: prepared drafts', { count: prepared.length })
  return prepared
}

module.exports = { nextDueAt, recordTouch, stopSequence, blockReason, prepareDueFollowUps, TERMINAL }
