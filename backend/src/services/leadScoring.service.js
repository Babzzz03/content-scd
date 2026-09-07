/**
 * Lead qualification: hard filters + deterministic scoring.
 *
 * Deliberately kept free of I/O so both the automation workflow (for early
 * stop during discovery) and the orchestration service (for the authoritative
 * pass) can call it on the same profile and get the same answer.
 *
 * The AI qualification pass in deepseek.service runs *after* this. This layer
 * exists to make sure we never spend an AI call on a lead that a cheap regex
 * could have rejected.
 */
const { OUTREACH } = require('../config/constants')

// ─── Contact extraction ───────────────────────────────────────────────────────

const EMAIL_RE    = /[\w.+-]+@[\w-]+\.[\w.]{2,}/
const PHONE_RE    = /(?:\+?\d[\d\s().-]{7,}\d)/
const WHATSAPP_RE = /(?:wa\.me\/|whatsapp[:\s]*)(\+?\d[\d\s-]{6,}\d)/i

/**
 * Merge contact details found in the bio with the ones Instagram exposes on
 * business accounts. Business-account fields win — they are structured data,
 * the bio ones are regex guesses.
 */
const extractContact = (profile) => {
  const bio = profile.bio || ''
  const fromBio = {
    email:    (bio.match(EMAIL_RE)    || [])[0] || '',
    phone:    (bio.match(PHONE_RE)    || [])[0] || '',
    whatsapp: (bio.match(WHATSAPP_RE) || [])[1] || '',
  }
  const existing = profile.contact || {}
  return {
    email:    existing.email    || fromBio.email,
    phone:    existing.phone    || fromBio.phone,
    whatsapp: existing.whatsapp || fromBio.whatsapp,
    address:  existing.address  || '',
  }
}

/**
 * The headline filter for a "we build websites" offer: does this business
 * already have one? Checks the link-in-bio field AND the bio text, because
 * plenty of small businesses type their domain into the bio without ever
 * filling in the external URL field.
 *
 * Link-in-bio aggregators (linktr.ee, beacons) count as having a website —
 * those businesses have already solved this problem for themselves.
 */
const detectHasWebsite = (profile) => {
  if (profile.externalLink && profile.externalLink.trim()) return true
  return OUTREACH.websitePattern.test(profile.bio || '')
}

// ─── Hard filters ─────────────────────────────────────────────────────────────

/**
 * Apply a campaign's filters to an enriched profile.
 * @returns {{ pass: boolean, reason: string }} reason is set only when pass=false
 */
const passesHardFilters = (profile, filters = {}) => {
  const f = {
    requireNoWebsite:       true,
    requireBusinessAccount: true,
    requireContactInfo:     false,
    excludeVerified:        true,
    excludePrivate:         true,
    minFollowers: 0,
    maxFollowers: Number.MAX_SAFE_INTEGER,
    minPosts: 0,
    activeWithinDays: 0,
    bioKeywords: [],
    excludeKeywords: [],
    ...filters,
  }

  const hasWebsite = detectHasWebsite(profile)
  const contact    = extractContact(profile)
  const haystack   = `${profile.bio || ''} ${profile.fullName || ''} ${profile.category || ''}`.toLowerCase()

  if (f.requireNoWebsite && hasWebsite) {
    return { pass: false, reason: 'Already has a website or link in bio' }
  }
  if (f.excludePrivate && profile.isPrivate) {
    return { pass: false, reason: 'Private account — cannot read or reliably DM' }
  }
  if (f.excludeVerified && profile.isVerified) {
    return { pass: false, reason: 'Verified account — unlikely to need this offer' }
  }
  // Only enforceable when the JSON API answered. DOM-scraped profiles cannot
  // be told apart from personal ones, and "unknown" must not read as "false"
  // or this filter empties the funnel every time Instagram rate-limits us.
  if (f.requireBusinessAccount && profile.enrichedVia !== 'dom' && !profile.isBusinessAccount) {
    return { pass: false, reason: 'Not a business or professional account' }
  }
  if (profile.followers < f.minFollowers) {
    return { pass: false, reason: `Only ${profile.followers} followers (min ${f.minFollowers})` }
  }
  if (profile.followers > f.maxFollowers) {
    return { pass: false, reason: `${profile.followers} followers exceeds max ${f.maxFollowers}` }
  }
  if (profile.postsCount < f.minPosts) {
    return { pass: false, reason: `Only ${profile.postsCount} posts (min ${f.minPosts})` }
  }
  if (f.requireContactInfo && !contact.email && !contact.phone && !contact.whatsapp) {
    return { pass: false, reason: 'No public contact details' }
  }
  // Activity check only applies when we actually know the last post date.
  // DOM-enriched leads have no date (reading it would cost an extra page load
  // per lead), and rejecting every one of them would silently empty the funnel
  // whenever Instagram rate-limits the JSON API.
  if (f.activeWithinDays > 0 && profile.lastPostAt) {
    const daysSince = (Date.now() - new Date(profile.lastPostAt).getTime()) / 86400000
    if (daysSince > f.activeWithinDays) {
      return { pass: false, reason: `Dormant, last post ${Math.round(daysSince)} days ago` }
    }
  }
  if (f.excludeKeywords.length && f.excludeKeywords.some((k) => haystack.includes(k.toLowerCase()))) {
    return { pass: false, reason: 'Bio matched an excluded keyword' }
  }
  if (f.bioKeywords.length && !f.bioKeywords.some((k) => haystack.includes(k.toLowerCase()))) {
    return { pass: false, reason: 'Bio matched none of the required keywords' }
  }

  return { pass: true, reason: '' }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Score a qualifying lead 0-100 so the review queue surfaces the best first.
 * Returns { score, reasons } where reasons explain the score in the UI.
 */
const scoreLead = (profile, campaign = {}) => {
  const niches = (campaign.search?.niches || []).map((n) => n.toLowerCase())
  const contact = extractContact(profile)
  const hasWebsite = detectHasWebsite(profile)

  let score = 0
  const reasons = []

  const add = (points, label) => { score += points; reasons.push(`${points > 0 ? '+' : ''}${points} ${label}`) }

  // The pitch signal: no website at all is the whole reason to contact them
  if (!hasWebsite) add(30, 'No website in bio')

  // Follower band. Too small means no budget, too large means an agency
  // already handles them. 1k-25k is the band that both needs and can pay.
  const fol = profile.followers || 0
  if (fol >= 1000 && fol <= 25000)      add(20, 'Follower count in the buying band')
  else if (fol >= 500 && fol < 1000)    add(12, 'Small but established following')
  else if (fol > 25000 && fol <= 75000) add(8,  'Large following, likely has an agency')
  else if (fol < 500)                   add(2,  'Very small following')

  if (profile.isBusinessAccount) add(10, 'Business account')

  if (contact.email)    add(6, 'Public email')
  if (contact.phone || contact.whatsapp) add(5, 'Public phone or WhatsApp')

  // Activity — a business posting weekly is running, one dormant 6 months is not
  if (profile.lastPostAt) {
    const days = (Date.now() - new Date(profile.lastPostAt).getTime()) / 86400000
    if (days <= 7)       add(15, 'Posted within the last week')
    else if (days <= 30) add(10, 'Posted within the last month')
    else if (days <= 60) add(4,  'Posted within two months')
  }

  // Category or bio matching the niche means the discovery query hit correctly
  const haystack = `${profile.category || ''} ${profile.bio || ''}`.toLowerCase()
  if (niches.some((n) => n && haystack.includes(n))) add(10, 'Category matches target niche')

  if ((profile.postsCount || 0) >= 30) add(4, 'Established post history')

  // Penalties
  if (profile.isVerified) add(-20, 'Verified account')
  if (fol > 0 && (profile.following || 0) / fol > 3) add(-10, 'Follow-heavy ratio, likely inactive or bot')
  if (!profile.bio) add(-8, 'Empty bio')

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
  }
}

module.exports = { extractContact, detectHasWebsite, passesHardFilters, scoreLead }
