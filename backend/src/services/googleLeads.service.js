/**
 * GoogleLeadsService
 *
 * Discovery for the Google Maps source. Deliberately much simpler than the
 * Instagram pipeline because there is no account to protect:
 *
 *   - no login, so no cookie, no session, no checkpoint risk
 *   - no sending, so no daily caps, warmup ramps or send windows
 *   - the output is a scored call sheet a human works by phone
 *
 * The only shared machinery is the Lead model and the AI layer.
 */
const Lead         = require('../models/Lead')
const LeadCampaign = require('../models/LeadCampaign')
const User         = require('../models/User')

const AutomationHub = require('../../automation')
const { draftCallScript } = require('./deepseek.service')
const { PLANS } = require('../config/constants')
const logger = require('../utils/logger')

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Score a Maps business 0-100 for a "you need a website" offer.
 *
 * Weighted differently from the Instagram scorer: Google gives review counts
 * and ratings, which are a far better proxy for a real trading business than
 * follower counts ever were.
 */
const scorePlace = (place) => {
  let score = 0
  const reasons = []
  const add = (n, label) => { score += n; reasons.push(`${n > 0 ? '+' : ''}${n} ${label}`) }

  // The entire premise of the offer
  if (place.hasWebsite === false) add(35, 'No website on Google')

  // Reviews prove the business is real and trading
  const rc = place.reviewCount || 0
  if (rc >= 100)      add(20, 'Well reviewed, clearly established')
  else if (rc >= 25)  add(16, 'Solid review count')
  else if (rc >= 5)   add(10, 'Some reviews')
  else if (rc >= 1)   add(4,  'Barely reviewed')
  else                add(-5, 'No reviews, may be inactive')

  // A good rating means they care about reputation, so a website is an easier sell
  if (place.rating >= 4.5)      add(12, 'Excellent rating')
  else if (place.rating >= 4.0) add(8,  'Good rating')
  else if (place.rating > 0 && place.rating < 3.0) add(-6, 'Poor rating')

  // Contactability is the whole point of a call list
  if (place.phone) add(18, 'Phone number available')
  else             add(-15, 'No phone number, hard to reach')

  if (place.address) add(5, 'Physical address listed')
  if (place.temporarilyClosed) add(-20, 'Temporarily closed')

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons }
}

// ─── Discovery ────────────────────────────────────────────────────────────────

/**
 * Run a Google Maps discovery for a campaign and persist the results.
 * No browser session or platform account is required.
 */
const runGoogleDiscovery = async (campaignId) => {
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

  const writeProgress = async (update) => {
    await LeadCampaign.updateOne({ _id: campaignId },
      { $set: { progress: { message: '', current: 0, total: 0, detail: '', ...update, updatedAt: new Date() } } })
  }

  try {
    await writeProgress({ phase: 'planning', message: 'Searching Google Maps', detail: 'Building searches' })

    const known = await Lead.find({ user: campaign.user, source: 'google_maps' })
      .select('externalId').lean()

    const remaining = leadLimit === -1
      ? Number.MAX_SAFE_INTEGER
      : leadLimit - user.usage.leadsThisMonth

    // How many QUALIFYING businesses are still wanted. The scraper keeps
    // looking until it has this many, however many it has to check.
    const targetQualified = Math.min(
      Math.max(campaign.targetLeadCount - campaign.stats.qualified, 0),
      remaining
    )
    if (targetQualified <= 0) {
      campaign.status = 'ready'
      await campaign.save()
      return { saved: 0, reason: 'Campaign already has its target number of leads' }
    }

    const requireNoWebsite = campaign.filters?.requireNoWebsite !== false
    const requirePhone = Boolean(campaign.filters?.requireContactInfo)
    let saved = 0
    let alsoSaved = 0

    /**
     * Persist one business as soon as it has been checked.
     *
     * Everything checked is kept so the work stays visible and a business with
     * a website can still be called. Only ones with no website count toward
     * the campaign target.
     */
    const persist = async (place, isQualified) => {
      if (!place.detailsFetched) return

      const qualifies = isQualified && !(requirePhone && !place.phone)
      const status = qualifies ? 'to_call' : 'skipped'
      const skipReason = qualifies ? ''
        : place.hasWebsite ? 'Already has a website'
        : 'No phone number listed'

      const { score, reasons } = scorePlace(place)

      try {
        await Lead.create({
          user:       campaign.user,
          campaign:   campaign._id,
          source:     'google_maps',
          platform:   'google_maps',
          externalId: place.externalId,
          fullName:   place.name,
          category:   place.category,
          hasWebsite: Boolean(place.hasWebsite),
          externalLink: place.websiteUrl || '',
          niche:      place.niche,
          location:   place.location,
          discoveredVia: { type: 'search', query: place.query || '' },
          contact:    { phone: place.phone || '' },
          google: {
            placeId: place.externalId,
            formattedAddress: place.address,
            phone: place.phone,
            rating: place.rating,
            reviewCount: place.reviewCount,
            primaryType: place.category,
            mapsUri: place.mapsUri,
            businessStatus: place.temporarilyClosed ? 'TEMPORARILY_CLOSED' : 'OPERATIONAL',
            detailsFetchedAt: new Date(),
          },
          score,
          scoreReasons: reasons,
          status,
          skipReason,
        })
        if (qualifies) saved++
        else alsoSaved++

        // Keep the campaign counters live so the UI reflects reality mid-run
        await LeadCampaign.updateOne({ _id: campaign._id }, {
          $inc: { 'stats.qualified': qualifies ? 1 : 0, 'stats.skipped': qualifies ? 0 : 1 },
        })
      } catch (err) {
        // 11000 means this business is already stored, which is expected on a
        // rerun. Everything else is a real failure and must be visible: an
        // earlier version swallowed all errors here, which hid a stale unique
        // index that was silently rejecting every lead after the first.
        if (err.code === 11000) {
          logger.debug('runGoogleDiscovery: already stored', { name: place.name })
        } else {
          logger.warn('runGoogleDiscovery: save failed', { code: err.code, err: err.message })
        }
      }
    }

    const { places, stats } = await AutomationHub.searchGoogleMaps({
      niches:    campaign.search.niches,
      locations: campaign.search.locations,
      region:    campaign.region || 'NG',
      targetQualified,
      maxDetailChecks: 60,
      requireNoWebsite,
      knownIds:  known.map((l) => l.externalId),
      onPlace:   persist,
      onProgress: (u) => writeProgress({
        ...u,
        message: u.phase === 'collecting' ? 'Finding businesses' : 'Checking for websites',
      }).catch(() => {}),
    })

    // Counters were incremented as each lead landed, so re-read rather than
    // adding the totals again
    await campaign.populate([])
    const fresh = await LeadCampaign.findById(campaign._id)
    campaign.stats.qualified = fresh.stats.qualified
    campaign.stats.skipped   = fresh.stats.skipped

    campaign.stats.discovered += stats.found
    campaign.stats.enriched   += stats.detailsChecked
    campaign.lastDiscoveryAt = new Date()
    campaign.status = 'ready'
    await campaign.save()

    user.usage.leadsThisMonth += saved
    await user.save()

    await writeProgress({
      phase: 'done',
      message: saved
        ? `${campaign.stats.qualified} of ${campaign.targetLeadCount} businesses to call`
        : 'No qualifying businesses this run',
      current: campaign.stats.qualified,
      total: campaign.targetLeadCount,
      detail: `Checked ${stats.detailsChecked} businesses from ${stats.poolSize} found. `
            + `${saved} had no website, ${alsoSaved} already had one (kept under "Has website").`
            + (stats.captchaHit ? ' Google showed a CAPTCHA, so the run stopped early.' : '')
            + (stats.poolExhausted && !stats.targetMet
                ? ' Ran out of businesses matching this search, try more areas or types.' : ''),
    })

    logger.info('runGoogleDiscovery: complete', { campaignId, saved, ...stats })
    return { saved, stats, poolExhausted: stats.poolExhausted, targetMet: stats.targetMet }

  } catch (err) {
    campaign.status = 'error'
    campaign.lastError = err.message
    await campaign.save()
    await writeProgress({ phase: 'error', message: 'Search stopped', detail: err.message })
    logger.error('runGoogleDiscovery: failed', { campaignId, err: err.message })
    throw err
  }
}

/** Generate the call / WhatsApp opener for one lead. */
const scriptForLead = async (leadId, channel = 'call') => {
  const lead = await Lead.findById(leadId)
  if (!lead) throw new Error('Lead not found')

  const campaign = await LeadCampaign.findById(lead.campaign)
  const offer = campaign?.offer?.toObject ? campaign.offer.toObject() : (campaign?.offer || {})

  const draft = await draftCallScript({ lead, offer, channel })
  lead.callScript = draft.script
  if (draft.objection) lead.notes = `Likely objection: ${draft.objection}`
  await lead.save()

  return { lead, ...draft }
}

module.exports = { runGoogleDiscovery, scriptForLead, scorePlace }
