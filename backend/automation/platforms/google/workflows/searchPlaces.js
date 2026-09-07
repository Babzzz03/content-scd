/**
 * Google Maps business scraper.
 *
 * Finds local businesses for a niche + location and reports, per business,
 * whether it has a website — the core qualifying signal for this offer.
 *
 * WHY THIS IS SAFER THAN THE INSTAGRAM SCRAPER
 * ────────────────────────────────────────────
 * No login, so there is no account to restrict or checkpoint. The failure mode
 * is an IP-level CAPTCHA, which pauses the run rather than costing an asset.
 * That said, it is still automated access Google's terms prohibit, so volume
 * is kept low and paced.
 *
 * EXTRACTION STRATEGY
 * ───────────────────
 * Everything is read from the results feed in one pass. Opening each business's
 * detail panel would give marginally more data at roughly 20x the requests and
 * far more exposure, so it is deliberately avoided.
 *
 * The website signal is exact rather than inferred: Google renders
 * `a[data-value="Website"]` only for businesses that have one.
 */
const sel = require('../selectors')
const { sleep, randInt } = require('../../../utils/random')
const logger = require('../../../../src/utils/logger')

/** Nigerian and international phone shapes seen in Maps result rows. */
const PHONE_RE = /(\+?\d[\d\s()\-]{7,}\d)/

/**
 * Clear Google's consent gate.
 *
 * It redirects to consent.google.com rather than showing an overlay, and it
 * fires on every fresh browser context since there is no consent cookie to
 * carry over. Missing this yields "no results" for every query.
 */
const dismissConsent = async (page) => {
  if (!sel.consentHost.test(page.url())) return true
  try {
    const clicked = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button, input[type="submit"], div[role="button"]'))
      const target = els.find((e) => /accept all|i agree|agree to all/i.test(e.innerText || e.value || ''))
      if (!target) return false
      target.click()
      return true
    })
    if (!clicked) {
      logger.warn('searchPlaces: consent page shown but no accept button found')
      return false
    }
    await page.waitForURL(/google\.com\/maps/, { timeout: 30000 }).catch(() => {})
    await sleep(randInt(2500, 4000))
    return true
  } catch (err) {
    logger.warn('searchPlaces: consent handling failed', { err: err.message })
    return false
  }
}

/**
 * Scroll the results feed until it stops growing or we have enough.
 * Google lazy-loads roughly 20 results per scroll batch.
 */
const scrollFeed = async (page, wanted, onProgress = () => {}) => {
  let stagnant = 0
  let seen = 0

  for (let i = 0; i < 25 && seen < wanted && stagnant < 3; i++) {
    const count = await page.evaluate((feedSel) => {
      const feed = document.querySelector(feedSel)
      if (!feed) return 0
      feed.scrollTop = feed.scrollHeight
      return feed.querySelectorAll('a[href*="/maps/place/"]').length
    }, sel.feed).catch(() => 0)

    stagnant = count > seen ? 0 : stagnant + 1
    seen = count
    onProgress({ phase: 'collecting', current: seen, total: wanted, detail: `${seen} businesses loaded` })

    await sleep(randInt(1400, 2800))
  }
  return seen
}

/**
 * Read every result row currently in the feed.
 *
 * Runs entirely in the page so one round trip returns the whole set. Each row's
 * innerText carries rating, review count, category, address and often the phone;
 * they are separated by middots and newlines rather than semantic markup, so
 * the text is parsed rather than queried.
 */
const extractRows = async (page) =>
  page.evaluate((feedSel) => {
    const feed = document.querySelector(feedSel)
    if (!feed) return []

    const out = []
    // Each direct child of the feed holding exactly one place link is one
    // result. Walking up from the link instead caught shared ancestors, which
    // made one business inherit the next one's rating and address.
    for (const child of Array.from(feed.children)) {
      const links = child.querySelectorAll('a[href*="/maps/place/"]')
      if (links.length !== 1) continue

      const link = links[0]
      const name = link.getAttribute('aria-label') || ''
      if (!name) continue

      out.push({
        name,
        href: link.getAttribute('href') || '',
        text: (child.innerText || '').trim(),
      })
    }
    return out
  }, sel.feed)

/**
 * Open one place page and read the fields the results feed does not carry.
 *
 * This is the expensive half: one navigation per business. It is also the only
 * way to learn whether they have a website, which is the entire qualifying
 * signal, so it cannot be skipped — only capped.
 */
const fetchPlaceDetails = async (page, place) => {
  try {
    await page.goto(place.mapsUri, { waitUntil: 'domcontentloaded', timeout: 40000 })
    if (!(await dismissConsent(page))) return place

    await page.waitForSelector(sel.placeTitle, { timeout: 20000 }).catch(() => {})
    await sleep(randInt(1500, 3000))

    const detail = await page.evaluate(({ websiteSel, phoneSel, addressSel }) => {
      const websiteEl = document.querySelector(websiteSel)
      const phoneEl   = document.querySelector(phoneSel)
      const addrEl    = document.querySelector(addressSel)
      const stripLabel = (s) => (s || '').replace(/^[^:]+:\s*/, '').trim()
      return {
        websiteUrl: websiteEl ? (websiteEl.getAttribute('href') || '') : '',
        phone:      phoneEl ? stripLabel(phoneEl.getAttribute('aria-label')) : '',
        address:    addrEl ? stripLabel(addrEl.getAttribute('aria-label')) : '',
      }
    }, { websiteSel: sel.placeWebsite, phoneSel: sel.placePhone, addressSel: sel.placeAddress })

    return {
      ...place,
      websiteUrl: detail.websiteUrl,
      hasWebsite: Boolean(detail.websiteUrl),
      phone: detail.phone || place.phone,
      address: detail.address || place.address,
      detailsFetched: true,
    }
  } catch (err) {
    logger.debug('fetchPlaceDetails: failed', { name: place.name, err: err.message })
    return place
  }
}

/**
 * Turn a raw row into a lead-shaped record.
 *
 * Row text looks roughly like:
 *   Ise Guest House
 *   3.4 (14)
 *   3-star hotel · 12 Obafemi Awolowo Way
 *   Open ⋅ Closes 11 pm
 *   +234 802 123 4567
 */
const parseRow = (row) => {
  if (!row.name) return null

  const lines = String(row.text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  // "4.5(193)" or "4.5 (193)"
  const ratingMatch = row.text.match(/(\d\.\d)\s*\((\d[\d,]*)\)/)
  const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0
  const reviewCount = ratingMatch ? parseInt(ratingMatch[2].replace(/,/g, ''), 10) : 0

  const phoneMatch = row.text.match(PHONE_RE)
  const phone = phoneMatch ? phoneMatch[1].trim() : ''

  // The category/address line: contains a middot, is not the rating or phone
  const detailLine = lines.find((l) =>
    l.includes('·') && !/^\d\.\d/.test(l) && !PHONE_RE.test(l)
  ) || ''
  const [category = '', address = ''] = detailLine.split('·').map((x) => x.trim())

  // Stable-ish identity: the place slug plus its hex id from the Maps URL
  const slug = decodeURIComponent((row.href.match(/\/maps\/place\/([^/]+)/) || [, ''])[1] || '')
  const hex  = (row.href.match(/(0x[0-9a-f]+:0x[0-9a-f]+)/i) || [, ''])[1] || ''
  const externalId = hex || slug || row.href

  return {
    externalId,
    name: row.name,
    category,
    address,
    phone,
    rating,
    reviewCount,
    // Unknown until the place page is opened; the feed carries no website data
    hasWebsite: null,
    websiteUrl: '',
    detailsFetched: false,
    mapsUri: row.href.startsWith('http') ? row.href : `https://www.google.com${row.href}`,
    permanentlyClosed: /permanently closed/i.test(row.text),
    temporarilyClosed: /temporarily closed/i.test(row.text),
  }
}

/**
 * @param {object} payload
 * @param {string[]} payload.niches
 * @param {string[]} payload.locations
 * @param {number}   [payload.targetQualified] - how many QUALIFYING businesses to find
 * @param {number}   [payload.maxDetailChecks] - safety ceiling on place-page opens
 * @param {string}   [payload.region] - ccTLD region hint, default NG
 * @param {string[]} [payload.knownIds] - already stored, skipped before returning
 * @param {function} [payload.onProgress]
 * @returns {Promise<{ places: object[], stats: object }>}
 */
const searchPlaces = async (page, payload) => {
  const {
    niches = [], locations = [], region = 'NG', knownIds = [],
    onProgress = () => {},
    /** How many QUALIFYING businesses to find, not how many to look at. */
    targetQualified = 10,
    /** Safety ceiling on place-page opens for one run. */
    maxDetailChecks = 120,
    /** Only businesses with no website count toward the target. */
    requireNoWebsite = true,
    /**
     * Called with each business the moment its details are read, so the caller
     * can persist it immediately. Batching saves until the end meant a run
     * interrupted at minute four lost everything it had found, and the UI
     * showed a climbing counter against an empty table.
     */
    onPlace = async () => {},
  } = payload

  if (!niches.length) throw new Error('At least one niche is required')

  // One query per niche × location. Google's own search handles the geocoding.
  const queries = []
  for (const niche of niches) {
    if (!locations.length) { queries.push(niche); continue }
    for (const loc of locations) queries.push(`${niche} in ${loc}`)
  }

  logger.info('searchPlaces: starting', { queries: queries.length, targetQualified, maxDetailChecks })
  onProgress({ phase: 'planning', current: 0, total: queries.length, detail: `${queries.length} searches queued` })

  const known = new Set(knownIds)
  const byId = new Map()
  let captchaHit = false

  // Collect a pool far larger than the target: only a fraction of businesses
  // lack a website, so finding N qualifying leads means looking at many more.
  const poolTarget = Math.min(targetQualified * 10, maxDetailChecks * 2)

  for (const [i, query] of queries.entries()) {
    if (byId.size >= poolTarget) break

    try {
      await page.goto(sel.searchUrl(query, region), { waitUntil: 'domcontentloaded', timeout: 45000 })
      await dismissConsent(page)
      await sleep(randInt(2000, 3500))

      // A CAPTCHA means stop entirely — retrying just deepens the block
      const blocked = await page.evaluate(() =>
        /unusual traffic|not a robot|recaptcha/i.test(document.body?.innerText || '')
      ).catch(() => false)
      if (blocked) {
        captchaHit = true
        logger.warn('searchPlaces: CAPTCHA shown, stopping run', { query })
        break
      }

      const hasFeed = await page.waitForSelector(sel.feed, { timeout: 15000 }).then(() => true).catch(() => false)
      if (!hasFeed) {
        logger.info('searchPlaces: no results feed', { query })
        continue
      }

      await scrollFeed(page, poolTarget - byId.size, (u) =>
        onProgress({ ...u, detail: `"${query}" — ${u.detail}` }))

      for (const raw of await extractRows(page)) {
        const place = parseRow(raw)
        if (!place || !place.externalId) continue
        if (known.has(place.externalId)) continue
        if (place.permanentlyClosed) continue
        if (!byId.has(place.externalId)) {
          byId.set(place.externalId, { ...place, niche: niches[0] || '', location: locations[0] || '', query })
        }
      }

      logger.info('searchPlaces: query done', { query, total: byId.size })
      onProgress({
        phase: 'collecting',
        current: byId.size,
        total: poolTarget,
        detail: `${byId.size} businesses gathered across ${i + 1}/${queries.length} searches`,
      })

      await sleep(randInt(3000, 7000))
    } catch (err) {
      logger.warn('searchPlaces: query failed', { query, err: err.message })
    }
  }

  // ── Phase 2: qualify until the target is met ─────────────────────────────
  // The target counts QUALIFYING businesses, so this keeps opening place pages
  // until it has enough of them, the candidate pool runs dry, or the safety
  // ceiling is reached. Stopping at "N businesses looked at" was the old
  // behaviour and it under-delivered whenever the qualifying rate was low.
  const candidates = [...byId.values()]
  const places = []
  const qualified = []
  let checked = 0

  for (const candidate of candidates) {
    if (qualified.length >= targetQualified) break
    if (checked >= maxDetailChecks) {
      logger.warn('searchPlaces: detail ceiling reached', { checked, qualified: qualified.length })
      break
    }

    const detailed = await fetchPlaceDetails(page, candidate)
    checked++
    places.push(detailed)

    const isQualified = detailed.detailsFetched &&
      (requireNoWebsite ? detailed.hasWebsite === false : true)
    if (isQualified) qualified.push(detailed)

    // Persist now, not at the end. A saved lead survives a crash and appears
    // in the table while the run is still going.
    try {
      await onPlace(detailed, isQualified)
    } catch (err) {
      logger.warn('searchPlaces: onPlace handler failed', { name: detailed.name, err: err.message })
    }

    onProgress({
      phase: 'enriching',
      // Progress tracks the goal, not the effort
      current: qualified.length,
      total: targetQualified,
      detail: `${qualified.length}/${targetQualified} found — checked ${checked} `
            + `(${detailed.name}: ${detailed.hasWebsite === false ? 'no website' : 'has a website'})`,
    })

    await sleep(randInt(2500, 6000))
  }

  const exhausted = qualified.length < targetQualified && checked < maxDetailChecks

  const stats = {
    queriesRun: queries.length,
    poolSize: candidates.length,
    found: places.length,
    detailsChecked: checked,
    withoutWebsite: qualified.length,
    targetQualified,
    targetMet: qualified.length >= targetQualified,
    /** True when the candidate pool ran dry before the target was reached */
    poolExhausted: exhausted,
    withPhone: qualified.filter((p) => p.phone).length,
    captchaHit,
  }

  logger.info('searchPlaces: complete', stats)
  if (captchaHit && !places.length) {
    throw new Error('Google showed a CAPTCHA before any results were collected. Wait a while before trying again.')
  }
  return { places, stats }
}

module.exports = { searchPlaces, parseRow }
