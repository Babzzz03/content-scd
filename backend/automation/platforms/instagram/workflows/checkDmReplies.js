/**
 * Instagram DM reply checker.
 *
 * Scans the inbox and reports which of our messaged leads have written back.
 * Two things depend on this running:
 *   1. The review queue can show replies instead of you living in the IG app.
 *   2. Opt-out detection. Someone who says "not interested" must never be
 *      contacted again, and that only works if we read replies.
 *
 * Reads the inbox JSON endpoint the web app itself uses, falling back to DOM
 * scraping of the thread list if the shape changes.
 */
const { igApi } = require('../igApi')
const sel = require('../selectors')
const { sleep, randInt } = require('../../../utils/random')
const { OUTREACH } = require('../../../../src/config/constants')
const logger = require('../../../../src/utils/logger')

/**
 * Does this reply text mean "stop contacting me"?
 * Matched on word boundaries so "stop" fires but "stopped by today" does not.
 */
const isOptOut = (text) => {
  if (!text) return false
  const t = text.toLowerCase()
  return OUTREACH.dm.optOutKeywords.some((kw) => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i').test(t)
  })
}

/** Read the inbox via the web API. Returns [] on any failure. */
const fetchInboxThreads = async (page) => {
  const json = await igApi(
    page,
    '/api/v1/direct_v2/inbox/?visual_message_return_type=unseen&thread_message_limit=5&persistentBadging=true&limit=25'
  )
  const threads = json?.inbox?.threads
  if (!Array.isArray(threads)) return []

  return threads.map((t) => {
    // A thread with one other participant is a 1:1 DM, which is all we send.
    const other = (t.users || [])[0] || {}
    const items = Array.isArray(t.items) ? t.items : []

    // Their most recent message: an item whose sender is not us. viewer_id
    // is our own account id on the thread payload.
    const viewerId = String(t.viewer_id || '')
    const theirs = items.find((i) => String(i.user_id) !== viewerId)

    return {
      username:  String(other.username || '').toLowerCase(),
      threadId:  t.thread_id || '',
      unread:    t.read_state === 1 || Boolean(t.has_newer),
      lastText:  theirs?.text || t.last_permanent_item?.text || '',
      theyReplied: Boolean(theirs),
      timestamp: theirs?.timestamp ? new Date(Number(theirs.timestamp) / 1000) : null,
    }
  }).filter((t) => t.username)
}

/** DOM fallback — reads usernames and previews off the inbox thread list. */
const scrapeInboxDom = async (page) => {
  try {
    await page.goto(sel.inboxUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(randInt(2500, 4000))

    return await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('a[href^="/direct/t/"]'))
      return rows.map((row) => {
        const texts = Array.from(row.querySelectorAll('[dir="auto"], span'))
          .map((e) => (e.innerText || '').trim())
          .filter(Boolean)
        return {
          username: (texts[0] || '').toLowerCase(),
          threadId: (row.getAttribute('href') || '').split('/').filter(Boolean).pop() || '',
          lastText: texts[1] || '',
          theyReplied: texts.length > 1,
          unread: false,
          timestamp: null,
        }
      }).filter((t) => t.username && /^[\w.]+$/.test(t.username))
    })
  } catch (err) {
    logger.warn('checkDmReplies: DOM fallback failed', { err: err.message })
    return []
  }
}

/**
 * @param {object} payload
 * @param {string[]} payload.usernames - the leads we have messaged, lowercased
 * @returns {Promise<{ replies: object[], scanned: number }>}
 *   replies: [{ username, text, optOut, threadUrl, repliedAt }]
 */
const checkDmReplies = async (page, payload) => {
  const watchList = new Set((payload.usernames || []).map((u) => String(u).toLowerCase()))

  await page.goto(sel.inboxUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
  await sleep(randInt(2000, 3500))

  let threads = await fetchInboxThreads(page)
  if (!threads.length) {
    logger.debug('checkDmReplies: inbox API empty, falling back to DOM')
    threads = await scrapeInboxDom(page)
  }

  const replies = []
  for (const t of threads) {
    if (watchList.size && !watchList.has(t.username)) continue
    if (!t.theyReplied || !t.lastText) continue

    replies.push({
      username:  t.username,
      text:      t.lastText.slice(0, 500),
      optOut:    isOptOut(t.lastText),
      threadUrl: t.threadId ? `https://www.instagram.com/direct/t/${t.threadId}/` : '',
      repliedAt: t.timestamp || new Date(),
    })
  }

  logger.info('checkDmReplies: scan complete', {
    scanned: threads.length,
    replies: replies.length,
    optOuts: replies.filter((r) => r.optOut).length,
  })

  return { replies, scanned: threads.length }
}

module.exports = { checkDmReplies, isOptOut }
