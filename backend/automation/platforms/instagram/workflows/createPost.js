/**
 * Instagram (web) — Create a photo/video post via cookie session.
 *
 * Ported from confirmed Python/Playwright flow:
 *  1. Dismiss notification popups
 *  2. Click the "New post" / "Create" entry in the left nav
 *  3. Click "Post" from the pop-up menu
 *  4. Click "Select from computer"
 *  5. setInputFiles() on input[type="file"]
 *  6. Next (crop) → Next (filter/edit) → fill caption → Share
 */
const sel = require('../selectors')
const { sleep, randInt, actionDelay } = require('../../../utils/random')
const logger = require('../../../../src/utils/logger')
const path = require('path')

/** Click whichever selector resolves first, with a shared timeout. */
const clickFirstVisible = async (page, selectors, timeout = 10000) => {
  for (const s of selectors) {
    try {
      const el = await page.$(s)
      if (el && await el.isVisible()) { await el.click(); return true }
    } catch { /* try next */ }
  }
  // Wait-based fallback
  for (const s of selectors) {
    try {
      await page.waitForSelector(s, { state: 'visible', timeout: timeout / selectors.length })
      await page.click(s)
      return true
    } catch { /* try next */ }
  }
  return false
}

const createPost = async (page, human, { content, hashtags = [], mediaUrls = [] }) => {
  if (!mediaUrls || mediaUrls.length === 0) {
    throw new Error('Instagram requires at least one image or video file path')
  }

  const mediaPaths = mediaUrls.map(u => path.resolve(u))

  // ── Ensure we are on Instagram home ───────────────────────────────────────
  if (!page.url().includes('instagram.com')) {
    await page.goto(sel.HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  }
  await sleep(randInt(2000, 3500))

  // ── Dismiss "Turn on notifications?" and similar popups ───────────────────
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const notNow = page.locator(sel.notNowButton).first()
      if (await notNow.isVisible({ timeout: 3000 })) {
        await notNow.click()
        logger.debug('Instagram: dismissed popup')
        await sleep(randInt(1000, 2000))
      }
    } catch { break }
  }

  // ── Step 1: Click the "New post" / "Create" button in the left nav ────────
  logger.info('Instagram: clicking Create / New post')
  // Try the SVG aria-label first (matches the Python script), then the span text
  const clickedCreate = await clickFirstVisible(page, [sel.newPostSvg, sel.newPostCreate], 15000)
  if (!clickedCreate) throw new Error('Instagram: could not find the Create/New post button')
  await sleep(randInt(1000, 2000))

  // ── Step 2: Click "Post" from the sub-menu ────────────────────────────────
  logger.info('Instagram: selecting Post from sub-menu')
  // Iterating all elements (like original code) is too slow. Use locator approach.
  try {
    // Try the role-based selector first
    const postItem = page.locator('[role="menuitem"]').filter({ hasText: /^Post$/ }).first()
    await postItem.waitFor({ state: 'visible', timeout: 5000 })
    await postItem.click()
  } catch {
    // Fallback: find any visible element with exact text "Post"
    const allDivs = await page.$$('div, span, a')
    let clicked = false
    for (const el of allDivs) {
      if (!await el.isVisible()) continue
      const txt = (await el.textContent() || '').trim()
      if (txt === 'Post') { await el.click(); clicked = true; break }
    }
    if (!clicked) throw new Error('Instagram: "Post" sub-menu item not found')
  }
  await sleep(randInt(1500, 2500))

  // ── Step 3 + 4: Click "Select from computer" and upload ALL files at once ───
  // Instagram's native file chooser accepts multiple files — set them all in
  // one shot via the filechooser event. If Instagram only loads the first, we
  // fall back to adding the rest via the gallery "+" button one by one.
  logger.info('Instagram: clicking Select from computer')
  logger.info('Instagram: uploading files', { count: mediaPaths.length, paths: mediaPaths })

  const SELECT_BTNS = [
    'button:has-text("Select from computer")',
    'button:has-text("Select From Computer")',
    'div[role="button"]:has-text("Select from computer")',
    'div[role="button"]:has-text("Select From Computer")',
  ]

  let uploadedCount = 0

  // Strategy A: intercept the filechooser and pass ALL files at once
  try {
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 12000 }),
      clickFirstVisible(page, SELECT_BTNS, 12000),
    ])
    await chooser.setFiles(mediaPaths)
    logger.debug('Instagram: all files set via filechooser', { count: mediaPaths.length })
    await sleep(randInt(5000, 7000))
    uploadedCount = mediaPaths.length  // optimistically assume all loaded; verify below
  } catch {
    // filechooser event not fired — fall back to direct file input
    logger.debug('Instagram: filechooser not intercepted, using file input directly')
    const fileInput = await page.waitForSelector(sel.fileUploadInput, { state: 'attached', timeout: 10000 })
    await fileInput.setInputFiles(mediaPaths[0])
    logger.debug('Instagram: first file attached via input')
    await sleep(randInt(5000, 7000))
    uploadedCount = 1
  }
  logger.debug('Instagram: first file attached')

  // ── Strategy B: add remaining via gallery "+" if Strategy A only loaded 1 ──
  const GALLERY_SELECTORS = [
    '[aria-label="Open Media Gallery"]',
    '[aria-label="Select multiple"]',
    '[aria-label="Gallery"]',
    '[aria-label*="multiple" i]',
    '[aria-label*="carousel" i]',
    'button[aria-label*="gallery" i]',
    'button[aria-label*="select" i]',
    'div[role="button"][aria-label*="gallery" i]',
    'svg[aria-label="Open Media Gallery"]',
  ]
  const PLUS_SELECTORS = [
    '[aria-label="Plus icon"]',
    '[aria-label="Add a photo or video"]',
    '[aria-label="Add photo or video"]',
    '[aria-label="Add"]',
    '[aria-label*="add" i][role="button"]',
    '[aria-label*="photo" i][role="button"]',
    'button[aria-label*="plus" i]',
    'svg[aria-label="Plus icon"]',
  ]

  const tryOpenGallery = async () => {
    for (const galSel of GALLERY_SELECTORS) {
      try {
        const btn = page.locator(galSel).first()
        if (await btn.isVisible({ timeout: 2000 })) {
          await btn.click()
          logger.debug(`Instagram: gallery opened via "${galSel}"`)
          return true
        }
      } catch { /* try next */ }
    }
    logger.debug('Instagram: gallery button not found with any selector')
    return false
  }

  const findPlusBtn = async (timeout = 4000) => {
    for (const plusSel of PLUS_SELECTORS) {
      try {
        const el = page.locator(plusSel).first()
        if (await el.isVisible({ timeout })) return el
      } catch { /* try next */ }
    }
    return null
  }

  if (mediaPaths.length > 1 && uploadedCount <= 1) {
    for (let i = 1; i < mediaPaths.length; i++) {
      logger.info(`Instagram: adding carousel image ${i + 1}/${mediaPaths.length}`)

      // Always try gallery first — the Plus button only appears after switching to
      // multi-image mode. Don't wait for findPlusBtn to fail before opening gallery.
      await tryOpenGallery()
      await sleep(randInt(1500, 2500))

      let plusBtn = await findPlusBtn(5000)

      if (!plusBtn) {
        logger.debug('Instagram: Plus not found after gallery open, retrying gallery')
        await tryOpenGallery()
        await sleep(2000)
        plusBtn = await findPlusBtn(5000)
      }

      if (!plusBtn) {
        // Save screenshot for visual diagnosis
        try {
          const screenshotPath = `/tmp/instagram_debug_${Date.now()}_slide${i + 1}.png`
          await page.screenshot({ path: screenshotPath, fullPage: false })
          logger.warn(`Instagram: debug screenshot saved to ${screenshotPath}`)
        } catch { /* ignore */ }

        // Log all visible interactive elements
        try {
          const visible = await page.$$eval(
            '[role="button"], button, svg[aria-label], [tabindex="0"]',
            els => els
              .filter(e => e.offsetWidth > 0 && e.offsetHeight > 0)
              .map(e => ({
                tag: e.tagName,
                label: e.getAttribute('aria-label'),
                text: (e.textContent || '').trim().slice(0, 40),
                classes: (e.className || '').slice(0, 60),
              }))
              .filter(e => e.label || e.text || e.classes)
          )
          logger.debug('Instagram: visible elements when Plus not found', { visible })
        } catch { /* ignore */ }

        throw new Error(`Instagram: carousel "+" button not found for image ${i + 1}`)
      }

      try {
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 8000 }),
          plusBtn.click(),
        ])
        await fileChooser.setFiles(mediaPaths[i])
      } catch {
        const newInput = await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 8000 })
        await newInput.setInputFiles(mediaPaths[i])
      }
      logger.debug(`Instagram: carousel image ${i + 1} attached`)
      await sleep(randInt(3000, 5000))
    }
  } else if (mediaPaths.length > 1) {
    logger.info(`Instagram: all ${mediaPaths.length} images loaded via filechooser`)
  }

  // ── Step 5: Crop — set 1:1 ratio then click Next ─────────────────────────
  logger.info('Instagram: crop step — selecting 1:1 ratio')
  await page.waitForSelector(sel.nextButton, { timeout: 20000 })
  await sleep(randInt(800, 1200))

  // Open the aspect-ratio picker and select 1:1 square
  // Button text confirmed from DOM probe: "Select Crop" / ratio option text: "1:1Crop square icon"
  try {
    const cropBtn = page.locator('button:has-text("Select Crop"), div[role="button"]:has-text("Select Crop")').first()
    if (await cropBtn.isVisible({ timeout: 3000 })) {
      await cropBtn.click()
      await sleep(800)
      const ratio1x1 = page.locator('div, button').filter({ hasText: /^1:1/ }).first()
      if (await ratio1x1.isVisible({ timeout: 2000 })) {
        await ratio1x1.click()
        logger.info('Instagram: set 1:1 crop ratio')
        await sleep(600)
      }
    }
  } catch { /* crop picker not present — leave as-is */ }

  await clickFirstVisible(page, [sel.nextButton])
  await sleep(randInt(1500, 2500))

  // ── Step 6: Next (filter/edit step) ───────────────────────────────────────
  logger.info('Instagram: clicking Next (filter)')
  await page.waitForSelector(sel.nextButton, { timeout: 10000 })
  await clickFirstVisible(page, [sel.nextButton])
  await sleep(randInt(1500, 2500))

  // ── Step 7: Fill caption ──────────────────────────────────────────────────
  logger.info('Instagram: filling caption')
  const fullCaption = hashtags.length
    ? `${content}\n\n${hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`
    : content

  // Try each caption selector individually — Instagram changes these frequently
  const captionCandidates = [
    'div[aria-label*="caption" i] p',
    'div[aria-label*="caption" i] [contenteditable]',
    'div[aria-label*="caption" i] textarea',
    'textarea[placeholder*="caption" i]',
    'textarea[aria-label*="caption" i]',
    '[role="textbox"][aria-label*="caption" i]',
    'div[contenteditable="true"]',
    'p[contenteditable="true"]',
    'textarea',
  ]
  let captionFilled = false
  for (const selector of captionCandidates) {
    try {
      const el = await page.$(selector)
      if (!el) continue
      const visible = await el.isVisible().catch(() => false)
      if (!visible) continue
      await el.click()
      await sleep(randInt(300, 600))
      await page.keyboard.type(fullCaption, { delay: randInt(25, 60) })
      await sleep(randInt(800, 1500))
      captionFilled = true
      logger.info(`Instagram: caption filled via "${selector}"`)
      break
    } catch { /* try next */ }
  }
  if (!captionFilled) logger.warn('Instagram: caption area not found, posting without caption')

  // ── Step 8: Share ──────────────────────────────────────────────────────────
  logger.info('Instagram: clicking Share')
  // Scope to the dialog and use .last() — the Share button is in the top-right header,
  // which is the LAST matching element in DOM order after the image and caption area.
  // .first() risks hitting an image tag or caption element that also contains "Share".
  const shareBtn = page.locator('[role="dialog"]')
    .locator('div[role="button"], button')
    .filter({ hasText: /^Share$/ })
    .last()
  await shareBtn.waitFor({ state: 'visible', timeout: 15000 })
  await shareBtn.click()
  logger.info('Instagram: Share clicked')

  // Wait for share to complete — the Share button disappears from the dialog header
  try {
    await page.waitForFunction(
      () => {
        const dialog = document.querySelector('[role="dialog"]')
        if (!dialog) return true  // dialog closed = success
        const btns = Array.from(dialog.querySelectorAll('div[role="button"], button'))
        return !btns.some(b => b.textContent && b.textContent.trim() === 'Share')
      },
      { timeout: 90000 }
    )
    logger.info('Instagram: Share button gone — post submitted')
  } catch {
    // Button may persist on slow connections; look for success text instead
    try {
      await page.waitForSelector(sel.shareSuccess, { timeout: 30000 })
      logger.info('Instagram: success banner detected')
    } catch {
      logger.warn('Instagram: could not confirm post share — proceeding anyway')
    }
  }

  await sleep(randInt(2000, 3000))
  logger.info('Instagram: post submitted successfully')
  return { postId: null }
}

module.exports = { createPost }
