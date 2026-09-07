const Agenda = require('agenda')
const logger = require('../utils/logger')

let agenda = null

const getAgenda = () => {
  if (!agenda) throw new Error('Agenda not initialized — call initAgenda() first')
  return agenda
}

const initAgenda = async () => {
  agenda = new Agenda({
    db: { address: process.env.MONGODB_URI, collection: 'agenda_jobs' },
    processEvery: '30 seconds',
    maxConcurrency: 3,
    defaultConcurrency: 1,
  })

  // ── Publish a scheduled/draft post ───────────────────────────────────────
  agenda.define('publish-post', { concurrency: 1 }, async (job) => {
    const { publishPost } = require('../services/posting.service')
    const { postId, attempt = 0 } = job.attrs.data
    try {
      await publishPost(postId)
    } catch (err) {
      const retryDisabled = process.env.DISABLE_AUTO_RETRY === 'true'
      if (!retryDisabled && attempt < 3) {
        const delayMs = (attempt + 1) * 5 * 60 * 1000  // 5 min, 10 min, 15 min
        await agenda.schedule(new Date(Date.now() + delayMs), 'publish-post', { postId, attempt: attempt + 1 })
        logger.info('publish-post: retry scheduled', { postId, attempt: attempt + 1 })
      } else {
        logger.error('publish-post: max retries reached or retry disabled', { postId, retryDisabled })
      }
      throw err
    }
  })

  // ── Engagement automation (reply to top tweets) ───────────────────────────
  agenda.define('engage', { concurrency: 2 }, async (job) => {
    const AutomationHub = require('../../automation')
    const { attempt = 0, ...payload } = job.attrs.data
    try {
      await AutomationHub.publish(payload)
    } catch (err) {
      const retryDisabled = process.env.DISABLE_AUTO_RETRY === 'true'
      if (!retryDisabled && attempt < 2) {
        const delayMs = (attempt + 1) * 3 * 60 * 1000  // 3 min, 6 min
        await agenda.schedule(new Date(Date.now() + delayMs), 'engage', { ...payload, attempt: attempt + 1 })
        logger.info('engage: retry scheduled', { platform: payload.platform, attempt: attempt + 1 })
      }
      throw err
    }
  })

  // ── Check and queue due scheduled posts ──────────────────────────────────
  agenda.define('check-scheduled-posts', { concurrency: 1 }, async () => {
    const Post = require('../models/Post')
    const { SCHEDULER_BATCH_SIZE } = require('../config/constants')
    const duePosts = await Post.find({
      status: 'scheduled',
      scheduledAt: { $lte: new Date() },
    })
      .sort({ scheduledAt: 1 })
      .limit(SCHEDULER_BATCH_SIZE)
      .lean()
      .select('_id')

    for (const { _id } of duePosts) {
      await agenda.now('publish-post', { postId: _id })
    }

    if (duePosts.length > 0) {
      logger.info(`Scheduler: queued ${duePosts.length} post(s)`)
    }
  })

  // ── Lead discovery for one campaign ──────────────────────────────────────
  agenda.define('discover-leads', { concurrency: 1 }, async (job) => {
    const { campaignId } = job.attrs.data
    const LeadCampaignModel = require('../models/LeadCampaign')
    const c = await LeadCampaignModel.findById(campaignId).select('source').lean()

    // Google campaigns need no account, no cookie and no drafting queue, so
    // they take an entirely separate path.
    if (c?.source === 'google_maps') {
      const { runGoogleDiscovery } = require('../services/googleLeads.service')
      const gResult = await runGoogleDiscovery(campaignId)

      // Keep going until the campaign has the number of qualifying businesses
      // the user asked for. One run is capped for safety, the target is not.
      const LC = require('../models/LeadCampaign')
      const gc = await LC.findById(campaignId)
      if (!gc) return

      gc.emptyRuns = (gResult.saved || 0) > 0 ? 0 : (gc.emptyRuns || 0) + 1
      const wanted = gc.targetLeadCount - gc.stats.qualified
      // A drained candidate pool means more searching will not help
      const giveUp = gc.emptyRuns >= 3 || gResult.poolExhausted

      if (wanted > 0 && !giveUp && gc.status !== 'paused') {
        const nextAt = new Date(Date.now() + 3 * 60 * 1000)
        gc.continuesAt = nextAt
        // Stay "discovering" while a batch is queued. Flipping to "ready"
        // told the user it had finished and stopped the page polling, so the
        // count froze and the next batch appeared never to run.
        gc.status = 'discovering'
        await gc.save()
        await agenda.schedule(nextAt, 'discover-leads', { campaignId })
        await LC.updateOne({ _id: campaignId }, { $set: {
          'progress.phase': 'done',
          'progress.message': `${gc.stats.qualified} of ${gc.targetLeadCount} businesses to call`,
          'progress.current': gc.stats.qualified,
          'progress.total': gc.targetLeadCount,
          'progress.detail': `Batch done. Searching again at ${nextAt.toLocaleTimeString()} for the remaining ${wanted}.`,
          'progress.updatedAt': new Date(),
        } })
        logger.info('discover-leads: google continuation queued', {
          campaignId, have: gc.stats.qualified, want: gc.targetLeadCount,
        })
      } else {
        gc.continuesAt = null
        if (wanted <= 0) gc.status = 'ready'
        await gc.save()
      }
      return
    }

    const { runDiscovery } = require('../services/leadGen.service')
    const result = await runDiscovery(campaignId)

    // Draft messages for everything that was just found, spaced out so the
    // AI calls do not all land at once.
    const Lead = require('../models/Lead')
    const fresh = await Lead.find({ campaign: campaignId, status: 'enriched' })
      .sort({ score: -1 })
      .limit(result.saved || 0)
      .select('_id')
      .lean()

    let delayMs = 0
    for (const { _id } of fresh) {
      await agenda.schedule(new Date(Date.now() + delayMs), 'draft-lead-dm', { leadId: _id })
      delayMs += 8000
    }
    logger.info('discover-leads: queued drafting', { campaignId, leads: fresh.length })

    // ── Continue toward the campaign target ────────────────────────────────
    // A single run stops at the per-run safety caps, which are deliberately
    // well below the hourly budget. Asking for 100 leads therefore takes
    // several runs. Queue the next one automatically so the target means what
    // the user expects, rather than silently falling short.
    const LeadCampaign = require('../models/LeadCampaign')
    const { BUDGET } = require('../services/accountHealth.service')
    const campaign = await LeadCampaign.findById(campaignId)
    if (!campaign) return

    const saved = result.saved || 0
    campaign.emptyRuns = saved > 0 ? 0 : (campaign.emptyRuns || 0) + 1

    const stillWanted = campaign.targetLeadCount - campaign.stats.qualified
    const exhausted = campaign.emptyRuns >= 3

    if (stillWanted > 0 && !exhausted && campaign.status !== 'paused') {
      const nextAt = new Date(Date.now() + BUDGET.minSessionGapMs)
      campaign.continuesAt = nextAt
      campaign.status = 'discovering'   // keep the UI polling between batches
      await campaign.save()
      await agenda.schedule(nextAt, 'discover-leads', { campaignId })

      await LeadCampaign.updateOne({ _id: campaignId }, {
        $set: {
          'progress.phase': 'done',
          'progress.message': `${campaign.stats.qualified} of ${campaign.targetLeadCount} leads found`,
          'progress.current': campaign.stats.qualified,
          'progress.total': campaign.targetLeadCount,
          'progress.detail': `Batch done. Searching again at ${nextAt.toLocaleTimeString()}. `
            + 'Runs are spaced out to keep the account safe.',
          'progress.updatedAt': new Date(),
        },
      })
      logger.info('discover-leads: continuation queued', {
        campaignId, have: campaign.stats.qualified, want: campaign.targetLeadCount, nextAt,
      })
    } else {
      campaign.continuesAt = null
      if (stillWanted <= 0) campaign.status = 'ready'
      await campaign.save()

      if (exhausted) {
        await LeadCampaign.updateOne({ _id: campaignId }, {
          $set: {
            'progress.phase': 'done',
            'progress.message': `Stopped at ${campaign.stats.qualified} leads`,
            'progress.detail': 'Three runs in a row found nothing new. Try widening the niche, '
              + 'adding locations, or relaxing the filters.',
            'progress.updatedAt': new Date(),
          },
        })
      }
    }
  })

  // ── AI qualification + DM drafting for one lead ──────────────────────────
  agenda.define('draft-lead-dm', { concurrency: 2 }, async (job) => {
    const { draftForLead } = require('../services/leadGen.service')
    await draftForLead(job.attrs.data.leadId)
  })

  // ── Send one approved DM ─────────────────────────────────────────────────
  agenda.define('send-lead-dm', { concurrency: 1 }, async (job) => {
    const { sendLeadDm } = require('../services/leadGen.service')
    const { leadId, attempt = 0 } = job.attrs.data
    try {
      const result = await sendLeadDm(leadId)
      // A deferred send is not a failure. The dispatcher will pick it up in
      // the next window rather than burning a retry now.
      if (result.deferred) logger.info('send-lead-dm: deferred', { leadId, reason: result.reason })
    } catch (err) {
      const { OUTREACH } = require('../config/constants')
      if (process.env.DISABLE_AUTO_RETRY !== 'true' && attempt < OUTREACH.dm.maxSendAttempts - 1) {
        const delayMs = (attempt + 1) * 10 * 60 * 1000  // 10 min, 20 min
        await agenda.schedule(new Date(Date.now() + delayMs), 'send-lead-dm', { leadId, attempt: attempt + 1 })
        logger.info('send-lead-dm: retry scheduled', { leadId, attempt: attempt + 1 })
      }
      throw err
    }
  })

  // ── Drip dispatcher: release approved DMs inside each campaign's window ──
  agenda.define('dispatch-dm-queue', { concurrency: 1 }, async () => {
    const LeadCampaign = require('../models/LeadCampaign')
    const Lead = require('../models/Lead')
    const { OUTREACH } = require('../config/constants')
    const { canSendNow, resetDailyCounterIfNeeded } = require('../services/leadGen.service')

    const active = await LeadCampaign.find({ status: { $in: ['ready', 'sending'] } })

    for (const campaign of active) {
      await resetDailyCounterIfNeeded(campaign)

      const gate = canSendNow(campaign)
      if (!gate.allowed) continue

      // In review mode only human-approved leads go out. In autoSend mode a
      // finished draft is enough.
      const sendableStatuses = campaign.messageSettings?.autoSend
        ? ['approved', 'drafted']
        : ['approved']

      const budget = gate.capToday - campaign.sentToday
      if (budget <= 0) continue

      const queue = await Lead.find({
        campaign: campaign._id,
        status: { $in: sendableStatuses },
      })
        .sort({ score: -1 })
        .limit(budget)
        .select('_id')
        .lean()

      if (!queue.length) continue

      // Stagger sends across the rest of the window with random gaps. Sending
      // the whole day's batch back to back is the fastest way to get flagged.
      let offset = randomGap()
      for (const { _id } of queue) {
        await agenda.schedule(new Date(Date.now() + offset), 'send-lead-dm', { leadId: _id })
        offset += randomGap()
      }

      if (campaign.status !== 'sending') {
        campaign.status = 'sending'
        await campaign.save()
      }

      logger.info('dispatch-dm-queue: scheduled sends', {
        campaignId: String(campaign._id),
        queued: queue.length,
        capToday: gate.capToday,
      })
    }

    function randomGap() {
      const { minGapMs, maxGapMs } = OUTREACH.dm
      return Math.floor(Math.random() * (maxGapMs - minGapMs + 1)) + minGapMs
    }
  })

  // ── Poll the inbox for replies and opt-outs ──────────────────────────────
  agenda.define('check-lead-replies', { concurrency: 1 }, async () => {
    const LeadCampaign = require('../models/LeadCampaign')
    const { syncReplies } = require('../services/leadGen.service')

    // One inbox read per sending account covers all of that account's
    // campaigns, so only the most recent campaign per account is polled.
    const campaigns = await LeadCampaign.find({
      status: { $in: ['ready', 'sending', 'paused'] },
    }).sort({ updatedAt: -1 })

    const seenAccounts = new Set()
    for (const campaign of campaigns) {
      const key = String(campaign.platformAccountId)
      if (seenAccounts.has(key)) continue
      seenAccounts.add(key)
      try {
        await syncReplies(campaign._id)
      } catch (err) {
        logger.warn('check-lead-replies: sync failed', { campaignId: String(campaign._id), err: err.message })
      }
    }
  })

  // ── Nightly: reset daily platform post counts ─────────────────────────────
  agenda.define('reset-daily-counts', { concurrency: 1 }, async () => {
    const PlatformAccount = require('../models/PlatformAccount')
    await PlatformAccount.updateMany({}, { dailyPostCount: 0, dailyCountResetAt: new Date() })
    logger.info('Daily post counts reset')
  })

  // ── Delete completed jobs immediately to keep MongoDB clean ───────────────
  agenda.on('complete', (job) => {
    job.remove().catch(() => {})
  })

  agenda.on('fail', (err, job) => {
    logger.error(`Job failed: ${job.attrs.name}`, { err: err.message, jobId: job.attrs._id })
    job.remove().catch(() => {})
  })

  await agenda.start()

  // Schedule recurring jobs (idempotent — Agenda skips if already scheduled)
  await agenda.every('1 minute', 'check-scheduled-posts', {}, { skipImmediate: true })
  await agenda.every('1 day', 'reset-daily-counts', {}, { skipImmediate: true })
  await agenda.every('10 minutes', 'dispatch-dm-queue', {}, { skipImmediate: true })
  await agenda.every('30 minutes', 'check-lead-replies', {}, { skipImmediate: true })

  logger.info('Agenda job queue started')
  return agenda
}

module.exports = { getAgenda, initAgenda }
