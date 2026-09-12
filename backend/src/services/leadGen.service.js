/**
 * LeadGenService
 *
 * Orchestrates the lead pipeline. The automation layer knows how to drive a
 * browser, the scoring layer knows how to judge a profile, DeepSeek knows how
 * to write. This module is what sequences them and owns the database writes.
 *
 * Four entry points, each safe to call from a job:
 *   runDiscovery(campaignId)  → find + enrich + score + save leads
 *   draftForLead(leadId)      → AI qualify + AI draft one lead's DM
 *   sendLeadDm(leadId)        → send one approved DM, respecting every cap
 *   syncReplies(campaignId)   → read the inbox, mark replies and opt-outs
 */
const path = require('path')

const Lead            = require('../models/Lead')
const LeadCampaign    = require('../models/LeadCampaign')
const PlatformAccount = require('../models/PlatformAccount')
const User            = require('../models/User')

const { decryptObject } = require('./encryption.service')
const { passesHardFilters, scoreLead, extractContact, detectHasWebsite } = require('./leadScoring.service')
const { expandLeadQueries, qualifyLead, draftLeadDm } = require('./deepseek.service')
const { linkDuplicates } = require('./leadIdentity.service')
const AutomationHub = require('../../automation')
const accountHealth = require('./accountHealth.service')
const { OUTREACH, PLANS } = require('../config/constants')
const logger = require('../utils/logger')

// ─── Session plumbing ─────────────────────────────────────────────────────────

const sessionsDir = () => path.resolve(process.env.SESSIONS_DIR || './automation/sessions')

/**
 * Load a campaign's sending account and decrypt its cookie.
 * Throws with a user-facing message when the account is missing or unusable.
 */
const loadAccount = async (userId, platformAccountId, { kind = 'discovery' } = {}) => {
  const account = await PlatformAccount.findOne({
    _id: platformAccountId,
    user: userId,
    isActive: true,
  }).select('+encryptedCredentials')

  if (!account) throw new Error('No active Instagram account is connected to this campaign')

  // Anti-flagging gate. Nothing opens a browser without passing this.
  // Siblings are every row for the same Instagram handle across all app users:
  // budgets and checkpoints belong to the real account, not the database row.
  const siblings = await accountHealth.findSiblings(account.platform, account.username)
  const verdict = accountHealth.canRun(account, { kind, siblings })
  if (!verdict.ok) {
    const err = new Error(verdict.reason)
    err.code = 'ACCOUNT_UNAVAILABLE'
    err.retryAfterMs = verdict.retryAfterMs
    throw err
  }

  let cookie
  try {
    cookie = decryptObject(account.encryptedCredentials)
  } catch (err) {
    throw new Error(`Could not decrypt the stored session cookie: ${err.message}`)
  }

  return { account, cookie }
}

/**
 * Run one automation task against a campaign's account, then persist the
 * refreshed session file so the next run reuses it.
 */
const runTask = async (account, cookie, task, extra = {}) => {
  // Count the session before it opens, so a crash still consumes budget and
  // cannot be retried in a tight loop.
  await accountHealth.recordSessionStart(account)

  try {
    const result = await AutomationHub.runTask({
      platform: 'instagram',
      task,
      cookie,
      username: account.username,
      sessionFile: account.sessionFile ? path.resolve(sessionsDir(), account.sessionFile) : null,
      ...extra,
    })

    if (result?.sessionFile) {
      account.sessionFile = path.relative(sessionsDir(), result.sessionFile)
    }
    // Charge the profile budget for what the run actually consumed
    if (result?.stats?.enriched) {
      await accountHealth.recordProfileFetches(account, result.stats.enriched)
    }
    await accountHealth.recordSuccess(account)
    return result
  } catch (err) {
    // Classifies checkpoints, 429s and dead cookies, and applies the cooldown
    await accountHealth.recordFailure(account, err)
    throw err
  }
}

// ─── Send-window and cap arithmetic ───────────────────────────────────────────

/** Current hour (0-23) in a given IANA timezone. */
const hourIn = (timezone) => {
  try {
    return Number(new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hour: 'numeric', hour12: false,
    }).format(new Date()))
  } catch {
    return new Date().getHours()
  }
}

/** Calendar date string in a timezone, used to decide when "today" rolled over. */
const dateIn = (timezone) => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

/**
 * How many DMs this campaign may send today.
 *
 * Warmup matters more than it looks: a connected account that has never sent a
 * DM and suddenly sends 40 in a day is the exact pattern Instagram's spam
 * heuristics look for. The ramp buys the account a reputation first.
 */
const resolveDailyCap = (campaign) => {
  const ceiling = Math.min(
    campaign.messageSettings?.dailyCap || OUTREACH.dm.dailyCapDefault,
    OUTREACH.dm.dailyCapMax
  )
  if (!campaign.messageSettings?.useWarmup) return ceiling

  const schedule = OUTREACH.dm.warmupSchedule
  if (!campaign.firstSentAt) return Math.min(ceiling, schedule[0])

  const dayIndex = Math.floor((Date.now() - new Date(campaign.firstSentAt).getTime()) / 86400000)
  const warmCap  = schedule[Math.min(dayIndex, schedule.length - 1)]
  return Math.min(ceiling, warmCap)
}

/** Zero the daily counter when the campaign's local date has moved on. */
const resetDailyCounterIfNeeded = async (campaign) => {
  const tz = campaign.messageSettings?.timezone || 'UTC'
  const lastReset = campaign.sentTodayResetAt ? new Date(campaign.sentTodayResetAt) : null
  const lastDate = lastReset
    ? new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(lastReset)
    : null

  if (lastDate !== dateIn(tz)) {
    campaign.sentToday = 0
    campaign.sentTodayResetAt = new Date()
    await campaign.save()
  }
}

/**
 * Is this campaign allowed to send right now?
 * @returns {{ allowed: boolean, reason: string, capToday: number }}
 */
const canSendNow = (campaign) => {
  const tz = campaign.messageSettings?.timezone || 'UTC'
  const capToday = resolveDailyCap(campaign)

  if (campaign.status === 'paused')  return { allowed: false, reason: 'Campaign is paused', capToday }
  if (campaign.status === 'completed') return { allowed: false, reason: 'Campaign is complete', capToday }

  if (campaign.sentToday >= capToday) {
    return { allowed: false, reason: `Daily cap reached (${campaign.sentToday}/${capToday})`, capToday }
  }

  const { start = 9, end = 18 } = campaign.messageSettings?.sendWindow || {}
  const hour = hourIn(tz)
  if (hour < start || hour >= end) {
    return { allowed: false, reason: `Outside send window (${start}:00-${end}:00 ${tz}, now ${hour}:00)`, capToday }
  }

  return { allowed: true, reason: '', capToday }
}

/**
 * Build a throttled progress writer for one campaign.
 *
 * Discovery emits progress on every hashtag and every profile, which would be
 * dozens of writes a minute. Throttling to one write every few seconds keeps
 * the UI responsive without turning progress reporting into its own load.
 */
const makeProgressWriter = (campaignId, { minGapMs = 2500 } = {}) => {
  let lastWrite = 0
  let pending = null

  const flush = async () => {
    if (!pending) return
    const snapshot = pending
    pending = null
    lastWrite = Date.now()
    try {
      await LeadCampaign.updateOne(
        { _id: campaignId },
        { $set: { progress: { ...snapshot, updatedAt: new Date() } } }
      )
    } catch (err) {
      logger.debug('progress write failed', { err: err.message })
    }
  }

  const write = async (update) => {
    pending = { phase: 'idle', message: '', current: 0, total: 0, detail: '', ...update }
    if (Date.now() - lastWrite >= minGapMs) await flush()
  }

  // force() bypasses the throttle for terminal states, which must not be lost
  write.force = async (update) => {
    pending = { phase: 'idle', message: '', current: 0, total: 0, detail: '', ...update }
    await flush()
  }
  return write
}

// ─── 1. Discovery ─────────────────────────────────────────────────────────────

/**
 * Find and store new leads for a campaign.
 * Idempotent with respect to leads already in the database: existing usernames
 * are passed to the scraper so it never spends a profile fetch on them.
 */
const runDiscovery = async (campaignId) => {
  const campaign = await LeadCampaign.findById(campaignId)
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`)

  const user = await User.findById(campaign.user)
  if (!user) throw new Error('Campaign owner not found')
  await user.resetUsageIfNeeded()

  const plan = PLANS[user.plan] || {}
  const leadLimit = plan.leadsPerMonth ?? 0
  if (leadLimit !== -1 && user.usage.leadsThisMonth >= leadLimit) {
    throw new Error(`Monthly lead limit reached (${leadLimit}). Upgrade for more.`)
  }

  campaign.status = 'discovering'
  campaign.lastError = null
  await campaign.save()

  const progress = makeProgressWriter(campaign._id)
  await progress.force({ phase: 'planning', message: 'Preparing search', detail: 'Working out which hashtags to scan' })

  try {
    const { account, cookie } = await loadAccount(campaign.user, campaign.platformAccountId)

    // Ask DeepSeek for real-world hashtags once, then cache them on the
    // campaign so repeat runs cost nothing.
    if (!campaign.search.generatedQueries?.length) {
      try {
        await progress.force({ phase: 'planning', message: 'Preparing search', detail: 'Asking AI for local hashtags' })
        const generated = await expandLeadQueries({
          niches: campaign.search.niches,
          locations: campaign.search.locations,
        })
        campaign.search.generatedQueries = generated
        await campaign.save()
        logger.info('runDiscovery: query expansion cached', { campaignId, count: generated.length })
      } catch (err) {
        logger.warn('runDiscovery: query expansion failed, using mechanical tags only', { err: err.message })
      }
    }

    const known = await Lead.find({ user: campaign.user, platform: 'instagram' })
      .select('username').lean()

    // Respect whichever runs out first: the campaign target or the plan quota
    const remainingQuota = leadLimit === -1
      ? Number.MAX_SAFE_INTEGER
      : leadLimit - user.usage.leadsThisMonth
    const targetCount = Math.min(
      Math.max(campaign.targetLeadCount - campaign.stats.qualified, 0),
      remainingQuota
    )

    if (targetCount <= 0) {
      campaign.status = 'ready'
      await campaign.save()
      return { saved: 0, rejected: 0, reason: 'Campaign already has its target number of leads' }
    }

    const result = await runTask(account, cookie, 'discover-leads', {
      niches:           campaign.search.niches,
      locations:        campaign.search.locations,
      extraHashtags:    campaign.search.extraHashtags,
      generatedQueries: campaign.search.generatedQueries,
      filters:          campaign.filters.toObject ? campaign.filters.toObject() : campaign.filters,
      knownUsernames:   known.map((l) => l.username),
      targetCount,
      onProgress: (u) => progress({ ...u, message: u.phase === 'collecting' ? 'Finding accounts' : 'Checking profiles' }),
    })

    // Persist each lead. insertMany would be faster but a single duplicate
    // username would abort the batch, and duplicates are expected here.
    await progress.force({
      phase: 'saving',
      message: 'Saving leads',
      current: 0,
      total: result.leads.length,
      detail: `${result.leads.length} qualified from ${result.stats.enriched} checked`,
    })

    let saved = 0
    for (const profile of result.leads) {
      const { score, reasons } = scoreLead(profile, campaign)
      try {
        const created = await Lead.create({
          user:     campaign.user,
          campaign: campaign._id,
          source:   'instagram',
          platform: 'instagram',
          externalId: profile.username,
          ...profile,
          contact:      extractContact(profile),
          hasWebsite:   detectHasWebsite(profile),
          score,
          scoreReasons: reasons,
          status: 'enriched',
        })
        saved++
        // Same-business detection across Instagram and Google Maps
        linkDuplicates(created._id).catch(() => {})
      } catch (err) {
        if (err.code !== 11000) logger.warn('runDiscovery: lead save failed', { err: err.message })
        // 11000 = duplicate username, which just means another campaign found them first
      }
    }

    campaign.stats.discovered += result.stats.candidates
    campaign.stats.enriched   += result.stats.enriched
    campaign.stats.qualified  += saved
    campaign.stats.skipped    += result.rejected.length
    campaign.lastDiscoveryAt  = new Date()
    campaign.status = 'ready'
    await campaign.save()

    user.usage.leadsThisMonth += saved
    await user.save()

    await progress.force({
      phase: 'done',
      message: saved ? `${saved} new lead${saved === 1 ? '' : 's'} found` : 'No qualifying leads this run',
      current: saved,
      total: result.stats.enriched,
      detail: `${result.stats.candidates} accounts seen, ${result.stats.enriched} profiles checked, `
            + `${result.rejected.length} filtered out`
            + (result.stats.domFallbacks ? `, ${result.stats.domFallbacks} via fallback` : ''),
    })

    logger.info('runDiscovery: complete', { campaignId, saved, rejected: result.rejected.length })
    return { saved, rejected: result.rejected.length, stats: result.stats, rejections: result.rejected }

  } catch (err) {
    campaign.status = 'error'
    campaign.lastError = err.message
    await campaign.save()
    await progress.force({ phase: 'error', message: 'Discovery stopped', detail: err.message })
    logger.error('runDiscovery: failed', { campaignId, err: err.message })
    throw err
  }
}

// ─── 2. Qualification + drafting ──────────────────────────────────────────────

/**
 * Run the AI passes for one lead: judge fit, then write the DM.
 * A lead judged "unqualified" is skipped rather than drafted, so no AI budget
 * or human review time is spent on it.
 */
const draftForLead = async (leadId) => {
  const lead = await Lead.findById(leadId)
  if (!lead) throw new Error(`Lead ${leadId} not found`)
  if (!lead.isMessageable()) return { skipped: true, reason: 'Lead already contacted or opted out' }

  const campaign = await LeadCampaign.findById(lead.campaign)
  if (!campaign) throw new Error('Lead has no parent campaign')

  const offer = campaign.offer?.toObject ? campaign.offer.toObject() : campaign.offer

  const verdict = await qualifyLead({ lead, offer, icp: campaign.icp })
  lead.aiFit       = verdict.fit
  lead.aiAngle     = verdict.angle
  lead.aiReasoning = verdict.reasoning

  if (verdict.fit === 'unqualified') {
    lead.status = 'skipped'
    lead.skipReason = verdict.reasoning || 'AI judged this lead unqualified'
    await lead.save()
    campaign.stats.skipped += 1
    await campaign.save()
    return { skipped: true, reason: lead.skipReason }
  }

  lead.status = 'qualified'
  await lead.save()

  // Brand voice is optional; drafting works without it
  let brandVoice = null
  try {
    const BrandVoice = require('../models/BrandVoice')
    brandVoice = await BrandVoice.findOne({ user: lead.user, isGenerated: true })
  } catch { /* no brand voice configured */ }

  const draft = await draftLeadDm({ lead, offer, brandVoice, angle: verdict.angle })

  lead.draftMessage = draft.message
  lead.status = 'drafted'
  await lead.save()

  campaign.stats.drafted += 1
  await campaign.save()

  logger.info('draftForLead: drafted', { leadId, fit: verdict.fit, chars: draft.message.length })
  return { skipped: false, fit: verdict.fit, message: draft.message }
}

// ─── 3. Sending ───────────────────────────────────────────────────────────────

/**
 * Send one lead's DM.
 *
 * Every refusal path here is deliberate. Sending twice to the same person, or
 * to someone who asked to be left alone, is worse than not sending at all, so
 * each guard fails closed and marks the lead rather than retrying.
 */
const sendLeadDm = async (leadId, { force = false } = {}) => {
  const lead = await Lead.findById(leadId)
  if (!lead) throw new Error(`Lead ${leadId} not found`)

  if (lead.status === 'opted_out') return { sent: false, reason: 'Lead opted out' }
  if (['messaged', 'replied'].includes(lead.status)) return { sent: false, reason: 'Already messaged' }

  // The same business may exist under another source with its own row. DMing
  // someone who was phoned this morning reads as spam, so refuse.
  const { alreadyContacted } = require('./leadIdentity.service')
  const twin = await alreadyContacted(lead)
  if (twin) {
    return {
      sent: false,
      reason: `Already contacted via ${twin.source === 'google_maps' ? 'phone' : 'Instagram'} on `
            + `${new Date(twin.contactedAt || twin.messagedAt || twin.updatedAt).toDateString()}`,
    }
  }

  const message = (lead.approvedMessage || lead.draftMessage || '').trim()
  if (!message) return { sent: false, reason: 'No approved message to send' }

  const campaign = await LeadCampaign.findById(lead.campaign)
  if (!campaign) throw new Error('Lead has no parent campaign')

  await resetDailyCounterIfNeeded(campaign)

  if (!force) {
    const gate = canSendNow(campaign)
    if (!gate.allowed) return { sent: false, reason: gate.reason, deferred: true }
  }

  const user = await User.findById(lead.user)
  if (user) await user.resetUsageIfNeeded()

  const { account, cookie } = await loadAccount(lead.user, campaign.platformAccountId, { kind: 'dm' })

  lead.sendAttempts += 1
  lead.status = 'queued'
  await lead.save()

  try {
    const result = await runTask(account, cookie, 'send-dm', {
      username: lead.username,
      message,
      warmUp:      campaign.messageSettings?.engageBeforeDm !== false,
      warmUpLikes: campaign.messageSettings?.engageLikes ?? 2,
    })

    if (!result.sent) {
      // A refusal is a permanent condition (no thread, prior contact), not a
      // transient error, so the lead is closed out rather than retried.
      lead.status = 'skipped'
      lead.skipReason = result.reason || 'Could not send'
      lead.threadUrl = result.threadUrl || ''
      await lead.save()
      campaign.stats.skipped += 1
      await campaign.save()
      return { sent: false, reason: lead.skipReason }
    }

    lead.status = 'messaged'
    lead.messagedAt = new Date()
    lead.approvedMessage = message
    lead.threadUrl = result.threadUrl || ''
    lead.sendError = null
    await lead.save()

    // Records the touch and schedules the next one, if the sequence continues
    const { recordTouch } = require('./followUp.service')
    await recordTouch(lead._id, { text: message, channel: 'dm' })

    campaign.sentToday += 1
    campaign.stats.sent += 1
    if (!campaign.firstSentAt) campaign.firstSentAt = new Date()
    await campaign.save()

    if (user) {
      user.usage.dmsThisMonth += 1
      await user.save()
    }

    logger.info('sendLeadDm: sent', { leadId, username: lead.username })
    return { sent: true, threadUrl: lead.threadUrl }

  } catch (err) {
    lead.sendError = err.message
    lead.status = lead.sendAttempts >= OUTREACH.dm.maxSendAttempts ? 'failed' : 'approved'
    await lead.save()

    if (lead.status === 'failed') {
      campaign.stats.failed += 1
      await campaign.save()
    }

    logger.error('sendLeadDm: failed', { leadId, attempt: lead.sendAttempts, err: err.message })
    throw err
  }
}

// ─── 4. Reply sync ────────────────────────────────────────────────────────────

/**
 * Read the inbox and update every lead that has written back.
 *
 * Opt-outs are applied across ALL of the user's campaigns, not just this one.
 * Someone who says "not interested" to one pitch must not receive another from
 * a different campaign next week.
 */
const syncReplies = async (campaignId) => {
  const campaign = await LeadCampaign.findById(campaignId)
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`)

  const messaged = await Lead.find({
    user: campaign.user,
    status: { $in: ['messaged', 'replied'] },
  }).select('username status').lean()

  if (!messaged.length) return { replies: 0, optOuts: 0 }

  const { account, cookie } = await loadAccount(campaign.user, campaign.platformAccountId, { kind: 'check' })

  const result = await runTask(account, cookie, 'check-replies', {
    usernames: messaged.map((l) => l.username),
  })

  let replies = 0
  let optOuts = 0

  for (const reply of result.replies) {
    const lead = await Lead.findOne({ user: campaign.user, username: reply.username })
    if (!lead) continue

    const wasNew = lead.status !== 'replied' && lead.status !== 'opted_out'

    lead.replyPreview = reply.text
    lead.repliedAt = reply.repliedAt
    if (reply.threadUrl) lead.threadUrl = reply.threadUrl

    if (reply.optOut) {
      lead.status = 'opted_out'
      lead.optedOut = true
      lead.optedOutAt = new Date()
      lead.skipReason = 'Recipient asked not to be contacted'
      if (wasNew) optOuts++
    } else {
      lead.status = 'replied'
      if (wasNew) replies++
    }
    // Someone who answered must never receive a scheduled follow-up
    lead.nextFollowUpAt = null
    await lead.save()
  }

  campaign.stats.replied += replies
  await campaign.save()

  logger.info('syncReplies: complete', { campaignId, replies, optOuts, scanned: result.scanned })
  return { replies, optOuts, scanned: result.scanned }
}

module.exports = {
  runDiscovery,
  draftForLead,
  sendLeadDm,
  syncReplies,
  canSendNow,
  resolveDailyCap,
  resetDailyCounterIfNeeded,
}
