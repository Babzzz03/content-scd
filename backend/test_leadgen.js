/**
 * Lead generation end-to-end probe.
 *
 * Runs the REAL pipeline (same workflows the jobs call), one stage at a time,
 * so you can find the broken layer before anything is sent to a stranger.
 *
 * Stages, in the order you should run them:
 *
 *   1. cookie    Is the stored Instagram session still valid?
 *   2. api       Do Instagram's JSON endpoints still return the shapes we read?
 *   3. discover  Full discovery run. Finds and scores leads. Sends nothing.
 *   4. draft     AI qualification + DM drafting for the best discovered lead.
 *   5. dm-dry    Opens a real DM thread with your target and STOPS before sending.
 *   6. dm-send   Actually sends one DM. Use a second account you own.
 *   7. replies   Reads the inbox and reports replies / opt-outs.
 *
 * Usage:
 *   node test_leadgen.js cookie
 *   node test_leadgen.js api --username=nike
 *   node test_leadgen.js discover --niche=bakery --location=Lagos
 *   node test_leadgen.js draft
 *   node test_leadgen.js dm-dry  --target=your_other_account
 *   node test_leadgen.js dm-send --target=your_other_account
 *   node test_leadgen.js replies
 *
 * The session comes from the Instagram account connected in the app. To use a
 * raw cookie instead:  INSTAGRAM_COOKIE="sessionid=xxxx" node test_leadgen.js api
 *
 * Watch it work by setting BROWSER_HEADLESS=false in .env (recommended).
 */
require('dotenv').config()
const path = require('path')
const mongoose = require('mongoose')

const BrowserManager = require('./automation/core/BrowserManager')
const InstagramAutomation = require('./automation/platforms/instagram/InstagramAutomation')
const igApi = require('./automation/platforms/instagram/igApi')
const { discoverLeads } = require('./automation/platforms/instagram/workflows/discoverLeads')
const { sendDm } = require('./automation/platforms/instagram/workflows/sendDm')
const { checkDmReplies } = require('./automation/platforms/instagram/workflows/checkDmReplies')
const { scoreLead, passesHardFilters } = require('./src/services/leadScoring.service')
const { qualifyLead, draftLeadDm } = require('./src/services/deepseek.service')
const { decryptObject } = require('./src/services/encryption.service')

// ─── CLI ──────────────────────────────────────────────────────────────────────

const stage = process.argv[2]
const flags = Object.fromEntries(
  process.argv.slice(3)
    .filter((a) => a.startsWith('--'))
    .map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true] })
)

const ts  = () => new Date().toISOString().slice(11, 19)
const log = (step, msg, extra) => console.log(`[${ts()}] [${step}] ${msg}`, extra ?? '')
const ok   = (msg, extra) => log('PASS', msg, extra)
const bad  = (msg, extra) => log('FAIL', msg, extra)
const info = (msg, extra) => log('····', msg, extra)

const shot = async (page, name) => {
  const file = `/tmp/leadgen_${name}.png`
  await page.screenshot({ path: file }).catch(() => {})
  info('screenshot', file)
}

// ─── Session ──────────────────────────────────────────────────────────────────

/** Cookie from env, else from the Instagram account connected in the app. */
const resolveCookie = async () => {
  if (process.env.INSTAGRAM_COOKIE) {
    const raw = process.env.INSTAGRAM_COOKIE.trim()
    const value = raw.includes('=') ? raw.split('=').slice(1).join('=') : raw
    info('using cookie from INSTAGRAM_COOKIE env var')
    return { cookie: { cookieName: 'sessionid', cookieValue: value }, account: null }
  }

  await mongoose.connect(process.env.MONGODB_URI)
  const PlatformAccount = require('./src/models/PlatformAccount')
  const account = await PlatformAccount.findOne({ platform: 'instagram', isActive: true })
    .sort({ lastUsedAt: -1 })
    .select('+encryptedCredentials')

  if (!account) {
    throw new Error(
      'No Instagram account connected. Add one in Settings, or pass INSTAGRAM_COOKIE="sessionid=..."'
    )
  }

  info(`using connected account @${account.username}`)
  return { cookie: decryptObject(account.encryptedCredentials), account }
}

/** Open a logged-in Instagram page using the real automation stack. */
const openSession = async () => {
  const { cookie, account } = await resolveCookie()
  const sessionsDir = path.resolve(process.env.SESSIONS_DIR || './automation/sessions')
  const sessionFile = account?.sessionFile ? path.resolve(sessionsDir, account.sessionFile) : null

  const { context, page, human } = await BrowserManager.newContext(sessionFile)
  const ig = new InstagramAutomation()
  ig.context = context
  ig.page = page
  ig.human = human

  await ig._injectCookie(cookie)

  return {
    page, human, ig, account,
    close: async () => {
      await BrowserManager.closeContext(context)
      if (mongoose.connection.readyState) await mongoose.disconnect()
    },
  }
}

// ─── Stages ───────────────────────────────────────────────────────────────────

const stages = {
  /** 1. Is the session cookie still good? Everything else depends on this. */
  async cookie() {
    const s = await openSession()
    try {
      const loggedIn = await s.ig.isLoggedIn()
      await shot(s.page, 'cookie')
      if (loggedIn) ok('session is valid, Instagram sees you as logged in')
      else bad('session is INVALID or expired. Refresh the cookie in Settings.')
      return loggedIn
    } finally { await s.close() }
  },

  /**
   * 2. Probe the JSON endpoints directly.
   *
   * This is the stage most likely to fail after an Instagram change, and the
   * one that would otherwise show up as "discovery mysteriously finds nothing".
   */
  async api() {
    const s = await openSession()
    try {
      if (!(await s.ig.isLoggedIn())) { bad('not logged in, fix stage 1 first'); return false }

      const username = flags.username || 'instagram'
      const tag = flags.tag || 'bakery'
      let passes = 0

      info(`enriching profile @${username} (API first, DOM fallback)`)
      const profile = await igApi.enrichProfile(s.page, username)
      if (profile) {
        passes++
        ok(`profile enrichment works via ${profile.enrichedVia.toUpperCase()}`, JSON.stringify({
          username: profile.username,
          followers: profile.followers,
          category: profile.category || '(none)',
          externalLink: profile.externalLink || '(none)',
          isBusiness: profile.isBusinessAccount,
          lastPost: profile.lastPostAt?.toDateString() || '(unknown)',
        }))
      } else {
        bad('profile enrichment failed on BOTH the API and the DOM fallback')
      }

      info(`fetching hashtag #${tag}`)
      const tagJson = await igApi.fetchHashtag(s.page, tag)
      const tagUsers = igApi.extractUsernamesFromMediaResponse(tagJson)
      if (tagUsers.length) {
        passes++
        ok(`hashtag endpoint works, ${tagUsers.length} usernames`, tagUsers.slice(0, 5).join(', '))
      } else {
        bad('hashtag endpoint gave no usernames — discovery will fall back to slow DOM scraping')
      }

      info(`searching "${flags.query || 'bakery lagos'}"`)
      const searchJson = await igApi.fetchSearch(s.page, flags.query || 'bakery lagos')
      const searchUsers = igApi.extractUsernamesFromSearch(searchJson)
      const places = igApi.extractPlacesFromSearch(searchJson)
      if (searchUsers.length || places.length) {
        passes++
        ok(`search endpoint works, ${searchUsers.length} accounts, ${places.length} places`,
          searchUsers.slice(0, 5).join(', '))
      } else {
        bad('search endpoint returned nothing')
      }

      console.log(`\n  ${passes}/3 endpoints healthy\n`)
      return passes === 3
    } finally { await s.close() }
  },

  /** 3. Full discovery run. Read-only against Instagram, nothing is sent. */
  async discover() {
    const s = await openSession()
    try {
      if (!(await s.ig.isLoggedIn())) { bad('not logged in, fix stage 1 first'); return false }

      const niches    = String(flags.niche    || 'bakery').split(',')
      const locations = String(flags.location || 'Lagos').split(',')
      const target    = Number(flags.count || 5)

      info('discovering', JSON.stringify({ niches, locations, target }))
      console.time('  discovery took')

      const result = await discoverLeads(s.page, {
        niches, locations,
        filters: {
          requireNoWebsite: flags.anyWebsite ? false : true,
          requireBusinessAccount: false,
          excludeVerified: true,
          excludePrivate: true,
          minFollowers: Number(flags.minFollowers || 200),
          maxFollowers: Number(flags.maxFollowers || 100000),
          minPosts: 3,
          activeWithinDays: 0,
        },
        knownUsernames: [],
        targetCount: target,
      })

      console.timeEnd('  discovery took')
      console.log()
      info('stats', JSON.stringify(result.stats))

      if (!result.leads.length) {
        bad('no qualifying leads found')
        if (result.rejected.length) {
          console.log('\n  Why candidates were rejected:')
          const tally = {}
          for (const r of result.rejected) tally[r.reason] = (tally[r.reason] || 0) + 1
          for (const [reason, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
            console.log(`    ${String(n).padStart(3)}  ${reason}`)
          }
        }
        return false
      }

      ok(`found ${result.leads.length} qualifying lead(s)`)
      console.log()
      for (const lead of result.leads) {
        const { score, reasons } = scoreLead(lead, { search: { niches } })
        console.log(`  @${lead.username}  score ${score}`)
        console.log(`    ${lead.fullName || '(no name)'} | ${lead.followers} followers | ${lead.category || 'no category'}`)
        console.log(`    website: ${lead.externalLink || 'NONE'} | bio: ${(lead.bio || '').slice(0, 70).replace(/\n/g, ' ')}`)
        console.log(`    ${reasons.join(', ')}`)
        console.log()
      }

      // Stash for the draft stage so you do not have to rediscover
      require('fs').writeFileSync('/tmp/leadgen_leads.json', JSON.stringify(result.leads, null, 2))
      info('saved to /tmp/leadgen_leads.json for the draft stage')
      return true
    } finally { await s.close() }
  },

  /** 4. AI passes. No browser needed — uses the leads discover() stashed. */
  async draft() {
    let leads
    try {
      leads = JSON.parse(require('fs').readFileSync('/tmp/leadgen_leads.json', 'utf8'))
    } catch {
      bad('no /tmp/leadgen_leads.json — run the discover stage first')
      return false
    }
    if (!leads.length) { bad('no leads in the stash'); return false }

    // --all drafts every stashed lead, --index=N picks one. Default is the first.
    const picked = flags.all
      ? leads
      : [leads[Number(flags.index || 0)]].filter(Boolean)
    if (!picked.length) { bad(`no lead at index ${flags.index}`); return false }

    const offer = {
      what:         flags.offer || 'I build simple websites with online ordering for small businesses',
      painPoint:    flags.pain  || 'no website means orders get lost in DMs and customers cannot buy at night',
      proof:        flags.proof || '',
      callToAction: flags.cta   || 'open to a quick look at a demo?',
    }

    let drafted = 0
    for (const lead of picked) {
      info(`qualifying @${lead.username}`)
      const verdict = await qualifyLead({ lead, offer, icp: flags.icp || '' })
      console.log(`    fit: ${verdict.fit} | ${verdict.reasoning}`)

      if (verdict.fit === 'unqualified') {
        info(`skipping @${lead.username}, AI judged it unqualified`)
        console.log()
        continue
      }

      const draft = await draftLeadDm({ lead, offer, angle: verdict.angle })
      drafted++
      console.log(`\n  ─── DM for @${lead.username} ${'─'.repeat(Math.max(0, 28 - lead.username.length))}`)
      console.log(`  ${draft.message.replace(/\n/g, '\n  ')}`)
      console.log(`  ${'─'.repeat(52)}`)
      console.log(`  ${draft.message.length} chars | em dash: ${draft.message.includes('—')} | ` +
        `${draft.message.length > 400 ? 'TOO LONG for a phone' : 'good length'}\n`)
    }

    if (!drafted) { info('nothing drafted, every lead was judged unqualified'); return true }
    ok(`drafted ${drafted} DM(s)`)
    return true
  },

  /** 5. Open a real DM thread and stop before sending. The safe rehearsal. */
  async 'dm-dry'() {
    if (!flags.target) { bad('pass --target=username (use a second account you own)'); return false }
    const s = await openSession()
    try {
      if (!(await s.ig.isLoggedIn())) { bad('not logged in, fix stage 1 first'); return false }

      info(`opening a thread with @${flags.target} (DRY RUN, nothing will send)`)
      const result = await sendDm(s.page, s.human, {
        username: flags.target,
        message: 'This message is never sent during a dry run.',
        dryRun: true,
      })
      await shot(s.page, 'dm_dry')

      if (result.threadUrl) {
        ok('DM thread opened, composer found', result.threadUrl)
        info('reason given: ' + result.reason)
        return true
      }
      bad('could not open a DM thread', result.reason)
      info('check /tmp/leadgen_dm_dry.png — the Message button selector may have changed')
      return false
    } finally { await s.close() }
  },

  /** 6. Send one real DM. */
  async 'dm-send'() {
    if (!flags.target) { bad('pass --target=username (use a second account you own)'); return false }
    const s = await openSession()
    try {
      if (!(await s.ig.isLoggedIn())) { bad('not logged in, fix stage 1 first'); return false }

      const message = flags.message || `PostFlow automation test, please ignore. [${Date.now()}]`
      info(`sending to @${flags.target}`)
      console.log(`  message: ${message}\n`)

      const result = await sendDm(s.page, s.human, { username: flags.target, message })
      await shot(s.page, 'dm_send')

      if (result.sent) { ok('DM sent, check the recipient inbox', result.threadUrl); return true }
      bad('not sent', result.reason)
      return false
    } finally { await s.close() }
  },

  /** 8. Google Maps scrape. No login, no account risk. */
  async maps() {
    const AutomationHub = require('./automation')
    const niches = String(flags.niche || 'bakery').split(',')
    const locations = String(flags.location || 'Ikeja, Lagos').split(',')

    info('searching Google Maps', JSON.stringify({ niches, locations }))
    console.time('  search took')

    const { places, stats } = await AutomationHub.searchGoogleMaps({
      niches, locations,
      targetQualified: Number(flags.count || 10),
      maxDetailChecks: Number(flags.maxChecks || 60),
      region: flags.region || 'NG',
      onProgress: (u) => info(u.phase, u.detail),
    })

    console.timeEnd('  search took')
    console.log()
    info('stats', JSON.stringify(stats))

    if (!places.length) { bad('no businesses found'); return false }

    const noSite = places.filter((p) => !p.hasWebsite)
    ok(`${places.length} businesses, ${noSite.length} with NO website`)
    console.log()
    for (const p of places.slice(0, Number(flags.show || 12))) {
      console.log(`  ${p.hasWebsite ? '   ' : '★  '}${p.name}`)
      console.log(`     ${p.category || 'no category'} | ${p.rating || '-'}★ (${p.reviewCount}) | ${p.phone || 'no phone'}`)
      console.log(`     ${p.address || 'no address'}`)
      console.log(`     website: ${p.hasWebsite ? p.websiteUrl.slice(0, 60) : 'NONE  <- lead'}`)
      console.log()
    }
    console.log('  ★ = no website, i.e. a qualifying lead')
    require('fs').writeFileSync('/tmp/leadgen_places.json', JSON.stringify(places, null, 2))
    info('saved to /tmp/leadgen_places.json')
    return true
  },

  /** 7. Read the inbox. Run after dm-send and after the recipient replies. */
  async replies() {
    const s = await openSession()
    try {
      if (!(await s.ig.isLoggedIn())) { bad('not logged in, fix stage 1 first'); return false }

      const watch = flags.target ? [flags.target] : []
      info(watch.length ? `watching @${watch[0]}` : 'scanning the whole inbox')

      const result = await checkDmReplies(s.page, { usernames: watch })
      await shot(s.page, 'replies')

      info(`scanned ${result.scanned} thread(s)`)
      if (!result.replies.length) {
        info('no replies found from the watched accounts')
        if (result.scanned === 0) bad('inbox read returned zero threads — the inbox endpoint may have changed')
        return result.scanned > 0
      }

      ok(`${result.replies.length} repl(y/ies)`)
      for (const r of result.replies) {
        console.log(`  @${r.username}${r.optOut ? '  [OPT OUT]' : ''}`)
        console.log(`    ${r.text.slice(0, 120)}`)
      }
      return true
    } finally { await s.close() }
  },
}

// ─── Run ──────────────────────────────────────────────────────────────────────

;(async () => {
  if (!stage || !stages[stage]) {
    console.log('\nUsage: node test_leadgen.js <stage> [--flags]\n')
    console.log('Stages, in the order to run them:')
    console.log('  cookie     is the stored session still valid')
    console.log('  api        do Instagram JSON endpoints still work        [--username= --tag= --query=]')
    console.log('  discover   full discovery run, sends nothing             [--niche= --location= --count=]')
    console.log('  draft      AI qualify + draft, uses the discover stash   [--offer= --pain= --cta=]')
    console.log('  dm-dry     open a real thread, stop before sending       [--target= REQUIRED]')
    console.log('  dm-send    send one real DM                              [--target= REQUIRED --message=]')
    console.log('  replies    read the inbox for replies and opt-outs       [--target=]')
  console.log('  maps       scrape Google Maps, no login needed           [--niche= --location= --count=]')
    console.log('\nTip: set BROWSER_HEADLESS=false in .env to watch it run.\n')
    process.exit(1)
  }

  console.log(`\n══ stage: ${stage} ${'═'.repeat(Math.max(0, 50 - stage.length))}\n`)
  try {
    const passed = await stages[stage]()
    console.log(`\n══ ${passed ? 'STAGE PASSED' : 'STAGE FAILED'} ${'═'.repeat(40)}\n`)
    process.exit(passed ? 0 : 1)
  } catch (err) {
    console.error(`\n[FAIL] ${err.message}`)
    if (flags.trace) console.error(err.stack)
    process.exit(1)
  }
})()
