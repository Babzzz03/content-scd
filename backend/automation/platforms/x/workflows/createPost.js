const sel = require('../selectors')
const { sleep, randInt } = require('../../../utils/random')
const logger = require('../../../../src/utils/logger')
const path = require('path')

/**
 * Dismiss the autocomplete dropdown that appears when typing @mentions or #hashtags.
 * Uses Home key to move cursor to start — avoids clicking outside the box which
 * can trigger X's "Save draft?" modal and steal keyboard focus.
 */
const dismissAutocomplete = async (page) => {
  try {
    const dropdown = await page.$('[data-testid="typeaheadDropdown"]')
    if (dropdown && await dropdown.isVisible()) {
      await page.keyboard.press('Escape')
      await sleep(200)
    }
  } catch { /* no autocomplete */ }
}

const createPost = async (page, human, { content, hashtags = [], mediaUrls = [], threadParts = [], postType }) => {
  const alreadyOnCompose = page.url().includes('x.com/compose')

  if (!alreadyOnCompose) {
    // Go to /home first to dismiss the cookie banner safely.
    // Dismissing on /home does not redirect; dismissing on /compose/post redirects away.
    if (!page.url().includes('x.com/home')) {
      await page.goto(sel.HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await sleep(randInt(1500, 2500))
    }

    // Dismiss cookie banner if present
    for (const s of [
      'button:has-text("Accept all cookies")',
      'button:has-text("Refuse non-essential cookies")',
      '[data-testid="cookieBanner"] button',
    ]) {
      try {
        const el = await page.$(s)
        if (el && await el.isVisible()) { await el.click(); await sleep(1200); break }
      } catch { /* not present */ }
    }

    // Navigate to compose
    await page.goto(sel.COMPOSE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector(sel.tweetTextArea, { timeout: 20000 })
    await sleep(randInt(800, 1400))
  } else {
    // isLoggedIn() already landed on compose and confirmed the textbox — skip reload
    await page.waitForSelector(sel.tweetTextArea, { timeout: 10000 })
    await sleep(randInt(500, 900))
  }

  // Dismiss "Save draft?" modal from a previous unfinished session.
  // Click "Discard" only at startup — doing it mid-thread would wipe the compose content.
  try {
    const discardBtn = page.locator('button:has-text("Discard")').first()
    if (await discardBtn.isVisible({ timeout: 2000 })) {
      await discardBtn.click()
      logger.debug('X: dismissed save-draft modal')
      await sleep(randInt(400, 700))
    }
  } catch { /* no modal */ }

  logger.info('X: compose modal ready')

  const isThread = postType === 'thread' && threadParts.length > 0
  const firstTweetText = isThread ? threadParts[0] : content

  const firstBox = page.locator(sel.tweetTextArea).first()
  await firstBox.waitFor({ state: 'visible', timeout: 10000 })
  await firstBox.click({ force: true })
  await sleep(200)
  await page.keyboard.insertText(firstTweetText)
  await sleep(randInt(300, 600))
  await dismissAutocomplete(page)
  await sleep(400)
  logger.info('X: first tweet typed')

  // Attach media to the first tweet.
  if (mediaUrls.length > 0) {
    const firstFiles = isThread && mediaUrls.length >= threadParts.length
      ? [path.resolve(mediaUrls[0])]
      : mediaUrls.map(u => path.resolve(u))
    const fileInput = page.locator(sel.mediaUploadButton).first()
    await fileInput.setInputFiles(firstFiles)
    await sleep(randInt(2000, 4000))
    // Re-focus compose after file picker interaction
    await firstBox.click({ force: true })
    logger.info('X: media attached to tweet 1', { files: firstFiles.length })
  }

  // Thread: start from index 1
  if (isThread && threadParts.length > 1) {
    for (let i = 1; i < threadParts.length; i++) {
      // Re-focus the PREVIOUS slot by exact testid before looking for the + button.
      // The compose modal overlays the home feed, which has its own tweetTextarea_0.
      // Using a generic .last() selector lands on the background timeline element,
      // pulling focus out of the compose modal — X then removes addButton from the DOM.
      // Targeting tweetTextarea_{i-1} is unambiguous: only the compose modal has slots > 0.
      const prevBox = page.locator(`div[data-testid="tweetTextarea_${i - 1}"]`).first()
      await prevBox.click({ force: true })
      await sleep(400)

      // Dismiss any "Save post?" modal that appeared after the previous slot was filled.
      try {
        const savePostModal = page.locator('text="Save post?"')
        if (await savePostModal.isVisible({ timeout: 800 })) {
          logger.debug(`X thread: Save post? modal before slot ${i} — pressing Escape`)
          await page.keyboard.press('Escape')
          await sleep(600)
          const stillVisible = await savePostModal.isVisible({ timeout: 400 }).catch(() => false)
          if (stillVisible) {
            const discardBtn = page.locator('[data-testid="confirmationSheetConfirm"]').first()
            await discardBtn.click().catch(() => page.keyboard.press('Escape'))
            await sleep(400)
          }
        }
      } catch { /* no modal */ }

      const addBtn = page.locator(sel.addTweetButton).last()
      await addBtn.waitFor({ state: 'attached', timeout: 10000 })
      await addBtn.scrollIntoViewIfNeeded()
      await addBtn.waitFor({ state: 'visible', timeout: 5000 })
      await sleep(300)

      await addBtn.click({ force: true })
      logger.debug(`X thread: clicked addButton for slot ${i}`)

      // "Save post?" modal can also appear right after clicking +.
      await sleep(600)
      try {
        const savePostModal = page.locator('text="Save post?"')
        if (await savePostModal.isVisible({ timeout: 1000 })) {
          logger.debug('X thread: Save post? modal after + click — pressing Escape')
          await page.keyboard.press('Escape')
          await sleep(600)
          const stillVisible = await savePostModal.isVisible({ timeout: 400 }).catch(() => false)
          if (stillVisible) {
            const discardBtn = page.locator('[data-testid="confirmationSheetConfirm"]').first()
            await discardBtn.click().catch(() => page.keyboard.press('Escape'))
            await sleep(400)
          }
        }
      } catch { /* no modal */ }

      // Wait for the specific slot textarea to appear by exact index.
      // This avoids false positives from background timeline elements.
      await page.waitForSelector(`div[data-testid="tweetTextarea_${i}"]`, { timeout: 10000 })
      await sleep(randInt(400, 700))

      const newBox = page.locator(`div[data-testid="tweetTextarea_${i}"]`).first()
      await newBox.scrollIntoViewIfNeeded()
      await newBox.click({ force: true })
      await newBox.focus()
      await sleep(300)

      await page.keyboard.insertText(threadParts[i])
      await sleep(randInt(300, 600))
      await dismissAutocomplete(page)
      await sleep(400)

      // Attach per-tweet image if distributing one image per thread part
      if (isThread && mediaUrls.length >= threadParts.length && mediaUrls[i]) {
        const fileInputs = page.locator(sel.mediaUploadButton)
        const inputCount = await fileInputs.count()
        if (inputCount > i) {
          await fileInputs.nth(i).setInputFiles(path.resolve(mediaUrls[i]))
          await sleep(randInt(2000, 3500))
          // Re-focus the compose area after file picker — prevents text going to search bar
          await newBox.click({ force: true })
          await newBox.focus()
          await sleep(400)
          logger.debug(`X thread: image attached to slot ${i}`)
        }
      }

      logger.debug(`X thread: slot ${i} filled`)
    }
  }

  await sleep(randInt(1000, 2000))

  const postBtn = page.locator(sel.postSubmitButton).last()
  await postBtn.waitFor({ state: 'visible', timeout: 15000 })
  await postBtn.click({ force: true })
  logger.info('X: Post button clicked')

  await page.waitForFunction(() => !window.location.pathname.includes('/compose'), { timeout: 60000 })
  await sleep(randInt(1000, 2000))

  logger.info('X: post submitted successfully')
  return { postId: null }
}

module.exports = { createPost }
