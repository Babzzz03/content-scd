/**
 * Instagram direct message sender.
 *
 * Sends exactly one DM to one lead, then returns. The drip pacing, daily caps,
 * and send window all live in the job layer — this workflow's only jobs are to
 * get the message delivered and to refuse to send when it should not.
 *
 * REFUSAL CASES (all return { sent: false } rather than throwing, so the job
 * can mark the lead and move on instead of retrying):
 *   - the thread already has messages (we have contacted them before)
 *   - the profile is gone, private, or has no Message button
 *
 * A thrown error means something transient went wrong and a retry is sensible.
 */
const sel = require('../selectors')
const { igApi } = require('../igApi')
const { sleep, randInt, typingDelay } = require('../../../utils/random')
const logger = require('../../../../src/utils/logger')

/**
 * Poll an in-page predicate until it returns true or the deadline passes.
 *
 * Instagram's dialogs populate asynchronously with latency that varies by
 * seconds, so any fixed sleep is a race. The predicate performs the click
 * itself, so selection happens the instant the element is present rather than
 * in a separate step that could catch a re-rendered node.
 */
const waitFor = async (page, timeoutMs, predicate, arg) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if (await page.evaluate(predicate, arg)) return true
    } catch { /* mid-render, try again */ }
    await sleep(500)
  }
  return false
}

/** Dismiss the "Turn on notifications" dialog Instagram shows after a first DM. */
const dismissDialogs = async (page) => {
  try {
    const btn = await page.$(sel.notificationsDialog)
    if (btn && await btn.isVisible()) {
      await btn.click()
      await sleep(randInt(600, 1200))
    }
  } catch { /* non-critical */ }
}

/**
 * Have we already talked to this person?
 *
 * Checks the inbox for an existing thread with them. This is authoritative:
 * a thread only appears in the inbox once a message has actually been
 * exchanged, and a never-messaged thread does not exist server-side at all
 * (its detail endpoint 500s).
 *
 * FAILS OPEN, deliberately. The database is the primary guard against
 * double-messaging (Lead.status plus the unique index on username), so this is
 * a secondary check against the two disagreeing. An earlier version failed
 * closed by counting text nodes on the page, which matched the sidebar and
 * profile card and so reported "already in conversation" for every target,
 * silently blocking all sending. An inconclusive read here risks one duplicate
 * message; the alternative risked never sending anything at all.
 */
const threadHasHistory = async (page, username) => {
  const json = await igApi(page, '/api/v1/direct_v2/inbox/?thread_message_limit=1&limit=50')
  const threads = json?.inbox?.threads

  if (!Array.isArray(threads)) {
    logger.warn('sendDm: could not read the inbox, relying on the database guard', { username })
    return false
  }

  const handle = String(username).toLowerCase()
  return threads.some((t) =>
    (t.users || []).some((u) => String(u.username || '').toLowerCase() === handle)
  )
}

/** Open a DM thread from the lead's profile. Returns true if the composer is up. */
const openThreadFromProfile = async (page, human, username) => {
  await page.goto(sel.profileUrl(username), { waitUntil: 'domcontentloaded', timeout: 30000 })
  await sleep(randInt(2000, 3800))

  // Read the profile for a moment before acting — this is what a human does
  // and it costs nothing.
  await human.scroll('down', randInt(200, 450)).catch(() => {})
  await sleep(randInt(1200, 2600))
  await human.scroll('up', randInt(100, 250)).catch(() => {})

  // Deleted / renamed / banned accounts render this string
  const notFound = await page.$('text=/Sorry, this page/i').catch(() => null)
  if (notFound) {
    logger.info('sendDm: profile unavailable', { username })
    return false
  }

  const msgBtn = await page.$(sel.profileMessageBtn)
  if (!msgBtn) {
    logger.info('sendDm: no Message button on profile', { username })
    return false
  }

  await msgBtn.click()
  await page.waitForURL(/\/direct\/t\//, { timeout: 20000 }).catch(() => {})
  await sleep(randInt(2000, 3500))
  await dismissDialogs(page)

  const composer = await page.$(sel.dmComposer)
  return Boolean(composer)
}

/**
 * Open a thread through the New Message dialog.
 *
 * This is the path that works for everyone. Many business profiles render no
 * Message button at all (it depends on the account's message settings), so the
 * profile route cannot be relied on as the primary.
 *
 * The sequence matters: /direct/new/ does NOT open the dialog on its own, the
 * compose pencil has to be clicked, and the Chat button stays aria-disabled
 * until a recipient row is actually selected.
 */
const openThreadFromNewMessage = async (page, username) => {
  try {
    // The caller usually leaves us on the inbox already, and the compose pencil
    // lives in that same chrome — no need to navigate again.
    if (!page.url().includes('/direct/')) {
      await page.goto(sel.newMessageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    }
    await sleep(randInt(2000, 3500))
    await dismissDialogs(page)

    // Poll for the compose pencil. The inbox chrome renders after the page
    // shell, and a fixed wait here was short enough to miss it intermittently.
    const opened = await waitFor(page, 15000, (pencilSel) => {
      const icon = document.querySelector(pencilSel)
      if (!icon) return false
      let el = icon
      while (el && el.tagName !== 'BUTTON' && el.getAttribute('role') !== 'button') el = el.parentElement
      if (!el) return false
      el.click()
      return true
    }, sel.dmComposePencil)

    if (!opened) {
      logger.info('sendDm: compose pencil not found', { username, url: page.url() })
      return false
    }

    const box = await page.waitForSelector(sel.dmSearchInput, { timeout: 15000 }).catch(() => null)
    if (!box) {
      logger.info('sendDm: recipient field did not appear', { username })
      return false
    }

    await box.click()
    await sleep(randInt(400, 900))
    await page.keyboard.type(username, { delay: randInt(70, 150) })

    // Poll for the matching row rather than sleeping a fixed interval.
    // Search latency varies by several seconds, and a fixed wait made sending
    // intermittently fail: the dry run would pass and the real send moments
    // later would find nothing, purely on timing.
    const picked = await waitFor(page, 20000, (uname) => {
      const dlg = document.querySelector('[role="dialog"]')
      if (!dlg) return false
      // Only rows carrying a recipient checkbox are real results
      const boxes = dlg.querySelectorAll('input[name="IGDRecipientContactSearchResultCheckbox"]')
      if (!boxes.length) return false

      // Match the exact handle on its own line, never a fuzzy neighbour
      const rows = Array.from(dlg.querySelectorAll('[role="button"], [role="option"], label'))
      const match = rows.find((r) =>
        (r.innerText || '')
          .split('\n')
          .map((t) => t.trim().toLowerCase())
          .includes(uname.toLowerCase())
      )
      if (!match) return false
      match.click()
      return true
    }, username)

    if (!picked) {
      logger.info('sendDm: username not found in the recipient search', { username })
      return false
    }

    // Chat only becomes clickable once a recipient is actually selected
    const started = await waitFor(page, 8000, () => {
      const dlg = document.querySelector('[role="dialog"]')
      if (!dlg) return false
      const btn = Array.from(dlg.querySelectorAll('button, div[role="button"]'))
        .find((b) => /^chat$/i.test((b.innerText || '').trim()))
      if (!btn) return false
      if (btn.getAttribute('aria-disabled') === 'true' || btn.disabled) return false
      btn.click()
      return true
    })

    if (!started) {
      logger.info('sendDm: Chat button never became enabled', { username })
      return false
    }

    await page.waitForURL(/\/direct\/t\//, { timeout: 20000 }).catch(() => {})
    await sleep(randInt(2500, 4000))
    await dismissDialogs(page)

    return Boolean(await page.$(sel.dmComposer))
  } catch (err) {
    logger.warn('sendDm: new-message path failed', { username, err: err.message })
    return false
  }
}

/**
 * @param {object} payload
 * @param {string} payload.username - recipient handle, no @
 * @param {string} payload.message  - the exact text to send
 * @param {boolean} [payload.dryRun] - open the thread and stop before sending
 * @returns {Promise<{ sent: boolean, reason?: string, threadUrl: string|null }>}
 */
const sendDm = async (page, human, payload) => {
  const { username, message, dryRun = false } = payload

  if (!username) throw new Error('sendDm: username is required')
  if (!message || !message.trim()) throw new Error('sendDm: message is empty')

  logger.info('sendDm: starting', { username, dryRun, chars: message.length })

  // Land on the inbox first so the history check has a same-origin page to
  // fetch from, then bail before touching anything if we have already talked.
  await page.goto(sel.inboxUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
  await sleep(randInt(2500, 4000))

  if (await threadHasHistory(page, username)) {
    logger.info('sendDm: existing conversation found, refusing to send', { username })
    return { sent: false, reason: 'Already in conversation with this account', threadUrl: null }
  }

  // Compose dialog first: it works regardless of whether the target's profile
  // renders a Message button, which many business profiles do not.
  let ready = await openThreadFromNewMessage(page, username)
  if (!ready) {
    logger.debug('sendDm: compose path failed, trying the profile button', { username })
    ready = await openThreadFromProfile(page, human, username)
  }

  if (!ready) {
    return {
      sent: false,
      reason: 'Could not open a DM thread — the account may not accept message requests',
      threadUrl: null,
    }
  }

  if (dryRun) {
    return { sent: false, reason: 'Dry run — thread opened, nothing sent', threadUrl: page.url() }
  }

  const composer = await page.waitForSelector(sel.dmComposer, { timeout: 15000 })
  await composer.click()
  await sleep(randInt(700, 1500))

  // Type the message a character at a time with human cadence. Newlines are
  // sent as shift+enter so they do not submit the message early.
  for (const line of message.split('\n')) {
    for (const ch of line) {
      await page.keyboard.type(ch, { delay: 0 })
      await sleep(typingDelay())
    }
    if (line !== message.split('\n').slice(-1)[0]) {
      await page.keyboard.down('Shift')
      await page.keyboard.press('Enter')
      await page.keyboard.up('Shift')
      await sleep(randInt(200, 500))
    }
  }

  // Pause before sending, the way a person rereads what they wrote
  await sleep(randInt(1500, 3500))

  const sendBtn = await page.$(sel.dmSendBtn)
  if (sendBtn && await sendBtn.isVisible().catch(() => false)) {
    await sendBtn.click()
  } else {
    await page.keyboard.press('Enter')
  }

  await sleep(randInt(2500, 4500))

  // Confirm the composer emptied — the reliable signal that the send landed
  const composerText = await page.evaluate((s) => {
    const el = document.querySelector(s)
    return el ? (el.innerText || el.value || '').trim() : ''
  }, sel.dmComposer).catch(() => '')

  if (composerText && composerText.length > 5) {
    throw new Error('Message text remained in the composer — send did not go through')
  }

  const threadUrl = page.url()
  logger.info('sendDm: sent', { username, threadUrl })

  return { sent: true, threadUrl }
}

module.exports = { sendDm }
