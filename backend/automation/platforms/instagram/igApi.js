/**
 * Authenticated in-page Instagram web API helper.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Scraping profile data out of Instagram's DOM is unreliable — the class names
 * are obfuscated and the follower count is rendered differently depending on
 * viewport, locale, and whether the number is abbreviated ("1.2K" vs "1,234").
 *
 * The web app itself fetches this data from JSON endpoints. Running those same
 * fetches from inside the logged-in page means:
 *   - the session cookie is sent automatically (credentials: 'include')
 *   - exact numbers instead of abbreviated display strings
 *   - one request instead of a full page render, so fewer requests overall
 *
 * If Instagram changes a response shape, every reader here returns null/[] and
 * the caller falls back to DOM scraping rather than throwing.
 */
const logger = require('../../../src/utils/logger')

/** Public web app id the Instagram site sends on its own XHRs */
const IG_APP_ID = '936619743392459'

/**
 * Run an authenticated GET against Instagram's web API from inside the page.
 * Returns parsed JSON, or null on any failure (never throws).
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Run an authenticated GET against Instagram's web API from inside the page.
 * Returns parsed JSON, or null on any failure (never throws).
 *
 * Retries once on 429. Instagram rate-limits web_profile_info aggressively and
 * answers with an HTML throttle page rather than JSON, so a 429 here is normal
 * rather than exceptional — callers are expected to fall back to DOM scraping.
 */
const igApi = async (page, path, { retryOn429 = true } = {}) => {
  const attempt = async () => {
    try {
      return await page.evaluate(
        async ({ path, appId }) => {
          try {
            // Absolute URL: a relative path throws when the page is about:blank
            const res = await fetch(new URL(path, 'https://www.instagram.com').href, {
              method: 'GET',
              credentials: 'include',
              headers: {
                'x-ig-app-id': appId,
                'x-requested-with': 'XMLHttpRequest',
                'accept': 'application/json',
              },
            })
            if (!res.ok) return { __error: `HTTP ${res.status}`, __status: res.status }
            return await res.json()
          } catch (e) {
            return { __error: e.message, __status: -1 }
          }
        },
        { path, appId: IG_APP_ID }
      )
    } catch (err) {
      return { __error: err.message, __status: -1 }
    }
  }

  let result = await attempt()

  if (result?.__status === 429 && retryOn429) {
    logger.debug('igApi: 429, backing off once', { path })
    await sleep(8000 + Math.floor(Math.random() * 7000))
    result = await attempt()
  }

  if (!result || result.__error) {
    logger.debug('igApi: request failed', { path, err: result?.__error })
    return null
  }
  return result
}

// ─── Endpoint wrappers ────────────────────────────────────────────────────────

/** Full profile record for one username. */
const fetchProfile = (page, username) =>
  igApi(page, `/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`)

/** Top + recent media for a hashtag. */
const fetchHashtag = (page, tag) =>
  igApi(page, `/api/v1/tags/web_info/?tag_name=${encodeURIComponent(tag.replace(/^#/, ''))}`)

/** Combined search: accounts, hashtags, and places matching a free-text query. */
const fetchSearch = (page, query) =>
  igApi(page, `/api/v1/web/search/topsearch/?context=blended&query=${encodeURIComponent(query)}`)

/** Media posted at a location page. */
const fetchLocation = (page, locationId) =>
  igApi(page, `/api/v1/locations/web_info/?location_id=${encodeURIComponent(locationId)}&show_nearby=false`)

// ─── Shape-tolerant readers ───────────────────────────────────────────────────

/**
 * Pull usernames out of a hashtag or location response.
 * Instagram nests media under sections → layout_content → medias, and has
 * shipped at least three variants of this shape, so we walk defensively.
 */
const extractUsernamesFromMediaResponse = (json) => {
  if (!json) return []
  const out = new Set()

  const walkSections = (sections) => {
    if (!Array.isArray(sections)) return
    for (const section of sections) {
      const medias = section?.layout_content?.medias
        || section?.layout_content?.one_by_two_item?.clips?.items
        || []
      for (const m of medias) {
        const uname = m?.media?.user?.username || m?.media?.owner?.username
        if (uname) out.add(uname.toLowerCase())
      }
    }
  }

  // Newer shape: data.{recent,top}.sections[]
  for (const bucket of ['recent', 'top']) {
    walkSections(json?.data?.[bucket]?.sections)
    walkSections(json?.[bucket]?.sections)
  }
  // Older shape: graphql edges
  const edges = json?.data?.hashtag?.edge_hashtag_to_media?.edges
    || json?.graphql?.hashtag?.edge_hashtag_to_top_posts?.edges
    || []
  for (const e of edges) {
    const uname = e?.node?.owner?.username
    if (uname) out.add(uname.toLowerCase())
  }

  return [...out]
}

/** Pull account usernames out of a topsearch response. */
const extractUsernamesFromSearch = (json) => {
  if (!json) return []
  const users = json?.users || []
  return users
    .map((u) => u?.user?.username)
    .filter(Boolean)
    .map((u) => u.toLowerCase())
}

/** Pull location ids out of a topsearch response. */
const extractPlacesFromSearch = (json) => {
  if (!json) return []
  return (json?.places || [])
    .map((p) => ({
      id:   p?.place?.location?.pk,
      name: p?.place?.location?.name || '',
      city: p?.place?.location?.city || '',
    }))
    .filter((p) => p.id)
}

/**
 * Normalise a web_profile_info response into the fields the Lead model wants.
 * Returns null if the response has no user (private redirect, deleted, banned).
 */
const normaliseProfile = (json) => {
  const u = json?.data?.user || json?.user
  if (!u || !u.username) return null

  const timeline = u.edge_owner_to_timeline_media?.edges || []
  const latestTs = timeline[0]?.node?.taken_at_timestamp

  return {
    username:      String(u.username).toLowerCase(),
    fullName:      u.full_name || '',
    bio:           u.biography || '',
    category:      u.category_name || u.business_category_name || '',
    externalLink:  u.external_url || '',
    followers:     u.edge_followed_by?.count ?? 0,
    following:     u.edge_follow?.count ?? 0,
    postsCount:    u.edge_owner_to_timeline_media?.count ?? 0,
    isBusinessAccount: Boolean(u.is_business_account || u.is_professional_account),
    isVerified:    Boolean(u.is_verified),
    isPrivate:     Boolean(u.is_private),
    profilePicUrl: u.profile_pic_url_hd || u.profile_pic_url || '',
    contact: {
      email:   u.business_email        || '',
      phone:   u.business_phone_number || '',
      address: u.business_address_json
        ? (() => { try { return JSON.parse(u.business_address_json).street_address || '' } catch { return '' } })()
        : '',
      whatsapp: '',
    },
    lastPostAt: latestTs ? new Date(latestTs * 1000) : null,
  }
}

// ─── DOM fallback for profile enrichment ──────────────────────────────────────

/**
 * Parse an Instagram count string into a number.
 * Handles "559", "1,234", "1.2K", "12.3M" — the abbreviated forms the page
 * uses once a number gets large.
 */
const parseCount = (raw) => {
  if (!raw) return 0
  const s = String(raw).trim().replace(/,/g, '')
  const m = s.match(/^([\d.]+)\s*([KMB])?$/i)
  if (!m) return 0
  const n = parseFloat(m[1])
  if (Number.isNaN(n)) return 0
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1
  return Math.round(n * mult)
}

/** Instagram wraps outbound links as l.instagram.com/?u=<encoded>. Unwrap them. */
const unwrapExternalLink = (href) => {
  if (!href) return ''
  try {
    const url = new URL(href)
    if (url.hostname === 'l.instagram.com' || url.hostname === 'l.facebook.com') {
      const target = url.searchParams.get('u')
      return target ? decodeURIComponent(target) : ''
    }
    if (url.hostname.endsWith('instagram.com') || url.hostname.endsWith('facebook.com')) return ''
    return href
  } catch {
    return ''
  }
}

/**
 * Scrape a profile by loading its page instead of calling the JSON API.
 *
 * Slower than the API (a full page render per profile) but it survives the
 * web_profile_info rate limit, which in practice throttles far sooner than
 * page loads do. The counts come from the og:description meta tag, which Meta
 * maintains for link previews and therefore changes far less often than the
 * obfuscated class names on the visible page.
 *
 * Returns the same shape as normaliseProfile(), with lastPostAt null — the
 * page does not expose post dates without opening a post, which is not worth
 * an extra navigation per lead.
 */
const fetchProfileViaDom = async (page, username) => {
  try {
    await page.goto(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    // Poll for the profile content rather than sleeping a fixed interval.
    // The header renders after the shell, and a fixed wait produced leads with
    // empty bios — which then fed "no bio" into AI qualification and got real
    // businesses rejected. Same race that broke the DM compose flow.
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      const ready = await page.evaluate(() => {
        const og = document.querySelector('meta[property="og:description"]')?.content || ''
        const header = document.querySelector('header')
        const notFound = /Sorry, this page/i.test(document.body?.innerText || '')
        if (notFound) return true
        // Counts present AND some header text means the profile has painted
        return /Followers/i.test(og) && Boolean(header && (header.innerText || '').trim().length > 20)
      }).catch(() => false)
      if (ready) break
      await sleep(700)
    }
    await sleep(400 + Math.floor(Math.random() * 900))

    const raw = await page.evaluate(() => {
      const meta = (prop) =>
        document.querySelector(`meta[property="${prop}"]`)?.content || ''
      const header = document.querySelector('header')

      return {
        ogTitle:       meta('og:title'),
        ogDescription: meta('og:description'),
        profilePic:    meta('og:image'),
        headerText:    header ? header.innerText : '',
        headerLinks:   header
          ? Array.from(header.querySelectorAll('a[href]')).map((a) => a.href)
          : [],
        isVerified: Boolean(document.querySelector('svg[aria-label="Verified"]')),
        isPrivate:  /This account is private|This Account is Private/i.test(document.body.innerText || ''),
        notFound:   /Sorry, this page/i.test(document.body.innerText || ''),
      }
    })

    if (!raw || raw.notFound) return null

    // "559 Followers, 110 Following, 75 Posts - See Instagram photos and videos from X (@handle)"
    const counts = raw.ogDescription.match(
      /([\d.,KMB]+)\s+Followers?,\s*([\d.,KMB]+)\s+Following,\s*([\d.,KMB]+)\s+Posts?/i
    )
    // "BAKERY IN IPAJA, LAGOS (@feedritebakery) • Instagram photos and videos"
    const fullName = (raw.ogTitle.split('(@')[0] || '').trim()

    // Header text is: handle, name, "N posts", "N followers", "N following",
    // then the bio lines, then button labels. Strip the parts we can identify
    // and whatever remains is the bio.
    const UI_NOISE = /^(follow|following|message|more|contact|email|call|directions|edit profile|\.\.\.)$/i
    const bioLines = raw.headerText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => l.toLowerCase() !== String(username).toLowerCase())
      .filter((l) => l !== fullName)
      .filter((l) => !/^[\d.,KMB]+\s+(posts?|followers?|following)$/i.test(l))
      .filter((l) => !UI_NOISE.test(l))

    const externalLink = raw.headerLinks
      .map(unwrapExternalLink)
      .find(Boolean) || ''

    // og:description carries a trailing "... from <name> (@handle)" segment; when
    // the header gave us nothing, it is still better than recording an empty bio,
    // because an empty bio is indistinguishable from a business with no bio.
    let bio = bioLines.join('\n').slice(0, 1000)
    if (!bio) {
      const tail = raw.ogDescription.split(' - ').slice(1).join(' - ').trim()
      if (tail && !/^See Instagram photos/i.test(tail)) bio = tail.slice(0, 1000)
    }

    if (!counts && !bio) return null

    return {
      username:   String(username).toLowerCase(),
      fullName,
      bio,
      category:   '',
      externalLink,
      followers:  parseCount(counts?.[1]),
      following:  parseCount(counts?.[2]),
      postsCount: parseCount(counts?.[3]),
      // The page does not mark business accounts distinctly enough to be sure,
      // so this stays false and campaigns that require it must use the API path.
      isBusinessAccount: false,
      isVerified: raw.isVerified,
      isPrivate:  raw.isPrivate,
      profilePicUrl: raw.profilePic || '',
      contact: { email: '', phone: '', address: '', whatsapp: '' },
      lastPostAt: null,
      enrichedVia: 'dom',
    }
  } catch (err) {
    logger.debug('fetchProfileViaDom: failed', { username, err: err.message })
    return null
  }
}

/**
 * Enrich one profile, preferring the JSON API and falling back to the page.
 * This is what callers should use.
 */
const enrichProfile = async (page, username) => {
  const json = await fetchProfile(page, username)
  const viaApi = normaliseProfile(json)
  if (viaApi) return { ...viaApi, enrichedVia: 'api' }

  logger.debug('enrichProfile: API path unavailable, using DOM', { username })
  return fetchProfileViaDom(page, username)
}

module.exports = {
  igApi,
  parseCount,
  fetchProfileViaDom,
  enrichProfile,
  fetchProfile,
  fetchHashtag,
  fetchSearch,
  fetchLocation,
  extractUsernamesFromMediaResponse,
  extractUsernamesFromSearch,
  extractPlacesFromSearch,
  normaliseProfile,
}
