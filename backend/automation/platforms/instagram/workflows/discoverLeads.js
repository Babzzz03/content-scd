/**
 * Instagram lead discovery.
 *
 * Finds business accounts in a niche + location that match a campaign's
 * filters, and returns them enriched and ready to score.
 *
 * TWO-PHASE DESIGN
 * ────────────────
 * Phase 1 (cheap, broad): collect candidate usernames from hashtag pages,
 *   account search, and location pages. One request per query, hundreds of
 *   usernames out. No per-profile cost.
 * Phase 2 (expensive, narrow): enrich each unseen candidate with a full
 *   profile fetch. This is the rate-limited part, so candidates are shuffled
 *   and capped, and we stop the moment we have enough passing leads.
 *
 * Everything is filtered against `knownUsernames` before enrichment so a
 * rerun never spends requests on accounts already in the database.
 */
const {
  enrichProfile, fetchHashtag, fetchSearch, fetchLocation,
  extractUsernamesFromMediaResponse, extractUsernamesFromSearch,
  extractPlacesFromSearch,
} = require('../igApi')
const sel = require('../selectors')
const { sleep, randInt, pick } = require('../../../utils/random')
const { OUTREACH } = require('../../../../src/config/constants')
const { passesHardFilters } = require('../../../../src/services/leadScoring.service')
const logger = require('../../../../src/utils/logger')

// ─── Query planning ───────────────────────────────────────────────────────────

/** Strip a string down to a valid hashtag body. */
const toTag = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Build the hashtag and search queries for a niche × location matrix.
 *
 * For "bakery" × "Lagos" this produces #bakerylagos, #lagosbakery,
 * #lagosbakeries and the search phrase "bakery Lagos". Instagram's tag
 * conventions are inconsistent, so we try both orders and let the empty ones
 * come back with nothing.
 */
const buildQueryPlan = ({ niches = [], locations = [], extraHashtags = [], generatedQueries = [] }) => {
  const hashtags = new Set()
  const searches = new Set()

  for (const raw of extraHashtags)     if (toTag(raw)) hashtags.add(toTag(raw))
  for (const raw of generatedQueries)  if (toTag(raw)) hashtags.add(toTag(raw))

  for (const niche of niches) {
    const n = toTag(niche)
    if (!n) continue
    if (!locations.length) hashtags.add(n)

    for (const loc of locations) {
      const l = toTag(loc)
      if (!l) continue
      hashtags.add(`${n}${l}`)
      hashtags.add(`${l}${n}`)
      hashtags.add(`${n}sin${l}`)
      searches.add(`${niche} ${loc}`)
    }
  }

  return { hashtags: [...hashtags], searches: [...searches] }
}

// ─── Phase 1: candidate collection ────────────────────────────────────────────

/**
 * DOM fallback for a hashtag page, used when the JSON endpoint returns nothing.
 * Reads post links off the grid and resolves each to its author. Much slower
 * than the API path, so it is capped hard.
 */
const collectFromHashtagDom = async (page, tag, limit) => {
  const found = new Set()
  try {
    await page.goto(sel.hashtagUrl(tag), { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(randInt(2000, 3500))

    for (let i = 0; i < 3 && found.size < limit; i++) {
      const links = await page.$$eval('a[href*="/p/"]', (els) =>
        els.map((e) => e.getAttribute('href')).filter(Boolean)
      ).catch(() => [])

      for (const href of links.slice(0, limit)) {
        // Post grid links do not carry the author, so open the post and read
        // the header link — the first profile link inside the article.
        if (found.size >= limit) break
        try {
          await page.goto(`https://www.instagram.com${href}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
          await sleep(randInt(1200, 2200))
          const uname = await page.$eval(
            'article header a[href^="/"], header a[href^="/"]',
            (a) => a.getAttribute('href')?.replace(/\//g, '') || ''
          ).catch(() => '')
          if (uname && /^[\w.]+$/.test(uname)) found.add(uname.toLowerCase())
        } catch { /* skip this post */ }
      }

      await page.goto(sel.hashtagUrl(tag), { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2)).catch(() => {})
      await sleep(randInt(1500, 2800))
    }
  } catch (err) {
    logger.debug('discoverLeads: DOM fallback failed', { tag, err: err.message })
  }
  return [...found]
}

/**
 * Walk every planned query and collect candidate usernames.
 * Stops early once maxCandidates is reached.
 */
const collectCandidates = async (page, plan, maxCandidates, onProgress = () => {}) => {
  const candidates = new Set()
  const sources = new Map()   // username → { type, query }

  const note = (uname, type, query, postedAt = null) => {
    const prev = sources.get(uname)
    if (!prev) sources.set(uname, { type, query, postedAt })
    else if (postedAt && (!prev.postedAt || postedAt > prev.postedAt)) prev.postedAt = postedAt
    candidates.add(uname)
  }

  // Hashtag pages
  for (const tag of plan.hashtags) {
    if (candidates.size >= maxCandidates) break
    const json = await fetchHashtag(page, tag)
    let names = extractUsernamesFromMediaResponse(json)

    if (!names.length) {
      logger.debug('discoverLeads: hashtag API empty, trying DOM', { tag })
      // DOM fallback yields bare handles with no date
      names = (await collectFromHashtagDom(page, tag, 15)).map((u) => ({ username: u, postedAt: null }))
    }

    for (const n of names) note(n.username, 'hashtag', `#${tag}`, n.postedAt)
    logger.info('discoverLeads: hashtag scanned', { tag, found: names.length, total: candidates.size })
    onProgress({
      phase: 'collecting',
      current: candidates.size,
      total: maxCandidates,
      detail: `#${tag} — ${candidates.size} accounts found so far`,
    })
    await sleep(randInt(1800, 4200))
  }

  // Account search + location pages
  for (const query of plan.searches) {
    if (candidates.size >= maxCandidates) break
    const json = await fetchSearch(page, query)

    for (const n of extractUsernamesFromSearch(json)) note(n, 'search', query)

    // A matching place page surfaces businesses that geotag their posts —
    // usually the most locally-rooted accounts in the set.
    const places = extractPlacesFromSearch(json).slice(0, 2)
    for (const place of places) {
      if (candidates.size >= maxCandidates) break
      const locJson = await fetchLocation(page, place.id)
      for (const n of extractUsernamesFromMediaResponse(locJson)) {
        note(n.username, 'location', place.name || query, n.postedAt)
      }
      await sleep(randInt(1500, 3500))
    }

    logger.info('discoverLeads: search scanned', { query, total: candidates.size })
    onProgress({
      phase: 'collecting',
      current: candidates.size,
      total: maxCandidates,
      detail: `"${query}" — ${candidates.size} accounts found so far`,
    })
    await sleep(randInt(2000, 4500))
  }

  return { candidates: [...candidates], sources }
}

// ─── Phase 2: enrichment ──────────────────────────────────────────────────────

/** Fisher-Yates. Shuffling avoids hammering one hashtag's accounts in order. */
const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * @param {object} payload
 * @param {string[]} payload.niches
 * @param {string[]} payload.locations
 * @param {string[]} [payload.extraHashtags]
 * @param {string[]} [payload.generatedQueries]
 * @param {object}   payload.filters
 * @param {string[]} [payload.knownUsernames] - already in the DB, never re-enriched
 * @param {number}   [payload.targetCount]    - stop once this many pass
 * @returns {Promise<{ leads: object[], rejected: object[], stats: object }>}
 */
const discoverLeads = async (page, payload) => {
  const {
    niches = [], locations = [], extraHashtags = [], generatedQueries = [],
    filters = {}, knownUsernames = [], targetCount = 100,
    onProgress = () => {},
  } = payload

  const cfg = OUTREACH.discovery
  const plan = buildQueryPlan({ niches, locations, extraHashtags, generatedQueries })

  if (!plan.hashtags.length && !plan.searches.length) {
    throw new Error('No searchable niches or locations were provided')
  }

  logger.info('discoverLeads: plan built', {
    hashtags: plan.hashtags.length,
    searches: plan.searches.length,
  })
  onProgress({
    phase: 'planning',
    current: 0,
    total: plan.hashtags.length + plan.searches.length,
    detail: `${plan.hashtags.length} hashtags and ${plan.searches.length} searches to scan`,
  })

  // Warm the session — going straight to API endpoints from a cold page looks
  // nothing like a real browsing session.
  await page.goto(sel.HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
  await sleep(randInt(2000, 4000))

  const { candidates, sources } = await collectCandidates(page, plan, cfg.maxCandidatesPerRun, onProgress)

  const known = new Set(knownUsernames.map((u) => String(u).toLowerCase()))
  const fresh = shuffle(candidates.filter((u) => !known.has(u)))

  logger.info('discoverLeads: candidates collected', {
    total: candidates.length,
    fresh: fresh.length,
    alreadyKnown: candidates.length - fresh.length,
  })

  const leads = []
  const rejected = []
  let enriched = 0
  let domFallbacks = 0

  for (const username of fresh) {
    if (leads.length >= targetCount) break
    if (enriched >= cfg.maxProfilesPerRun) break

    // Stop rather than keep loading full pages. A sustained API throttle means
    // the account is already under scrutiny, and answering that with heavier
    // traffic is how a soft limit becomes a checkpoint.
    if (domFallbacks >= cfg.maxDomFallbacksPerRun) {
      logger.warn('discoverLeads: DOM fallback cap reached, ending run early', {
        domFallbacks, enriched, qualified: leads.length,
      })
      break
    }

    // Prefers the JSON API, falls back to scraping the profile page when
    // Instagram rate-limits it. The fallback costs a page load per lead.
    const profile = await enrichProfile(page, username)
    enriched++
    if (profile?.enrichedVia === 'dom') domFallbacks++

    if (!profile) {
      rejected.push({ username, reason: 'Profile unavailable (private, deleted, or rate limited)' })
      await sleep(randInt(cfg.profileGapMinMs, cfg.profileGapMaxMs))
      continue
    }

    const src = sources.get(username) || { type: 'hashtag', query: '' }
    const enrichedLead = {
      ...profile,
      // DOM enrichment cannot read post dates, so fall back to the date of the
      // post that surfaced them. It is a floor, not the exact latest post, but
      // it proves recent activity and lets the recency score actually fire.
      lastPostAt: profile.lastPostAt || src.postedAt || null,
      profileUrl: `https://www.instagram.com/${profile.username}/`,
      niche:    pick(niches) || '',
      location: pick(locations) || '',
      discoveredVia: { type: src.type, query: src.query },
    }

    const verdict = passesHardFilters(enrichedLead, filters)
    if (verdict.pass) {
      leads.push(enrichedLead)
      logger.debug('discoverLeads: lead qualified', { username, followers: profile.followers })
    } else {
      rejected.push({ username, reason: verdict.reason })
    }

    onProgress({
      phase: 'enriching',
      current: enriched,
      total: Math.min(cfg.maxProfilesPerRun, fresh.length),
      detail: `@${username} — ${verdict.pass ? 'qualified' : verdict.reason}`
        + ` (${leads.length} kept, ${rejected.length} rejected)`,
    })

    await sleep(randInt(cfg.profileGapMinMs, cfg.profileGapMaxMs))
  }

  const stats = {
    queriesRun: plan.hashtags.length + plan.searches.length,
    candidates: candidates.length,
    enriched,
    domFallbacks,
    passed: leads.length,
    rejected: rejected.length,
  }

  logger.info('discoverLeads: run complete', stats)
  return { leads, rejected, stats }
}

module.exports = { discoverLeads, buildQueryPlan }
