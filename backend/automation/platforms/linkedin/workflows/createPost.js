/**
 * LinkedIn — Create a standard post (cookie-based session).
 *
 * Flow:
 *  1. Navigate to feed
 *  2. Click the "Start a post" trigger to open the composer modal
 *  3. Type content + hashtags into the contenteditable area
 *  4. If media: click the photo/video button, handle the file chooser
 *  5. Click the "Post" button inside the modal
 */
const sel = require('../selectors')
const { sleep, actionDelay, randInt } = require('../../../utils/random')
const logger = require('../../../../src/utils/logger')
const path = require('path')

const createPost = async (page, human, { content, hashtags = [], mediaUrls = [] }) => {
  // Navigate to feed if not already there
  if (!page.url().includes('linkedin.com/feed')) {
    await human.goto(sel.HOME_URL)
    await sleep(randInt(2000, 3000))
  }

  await page.waitForSelector(sel.shareBoxTrigger, { timeout: 30000 })
  await sleep(actionDelay())

  // Click top-center of the "Start a post" box — bottom area hits media icons
  const shareBox = await page.$(sel.shareBoxTrigger)
  const bbox = await shareBox.boundingBox()
  if (!bbox) throw new Error('LinkedIn: share box not visible')
  await page.mouse.click(bbox.x + bbox.width / 2, bbox.y + bbox.height * 0.25)
  logger.debug('LinkedIn: clicked share box')

  // Wait for composer modal
  await page.waitForSelector(sel.composerModal, { state: 'visible', timeout: 30000 })
  await sleep(randInt(800, 1500))

  // Find and click the contenteditable area inside the modal
  const textArea = await page.waitForSelector(sel.composerTextArea, { state: 'visible', timeout: 15000 })
  await textArea.click()
  await sleep(300)

  // Build full text — content + hashtags
  const fullText = hashtags.length
    ? `${content}\n\n${hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`
    : content

  await page.keyboard.type(fullText, { delay: randInt(30, 80) })
  await sleep(randInt(800, 1800))

  // Upload media if provided
  if (mediaUrls.length > 0) {
    const mediaPath = path.resolve(mediaUrls[0])
    logger.info('LinkedIn: attaching media', { path: mediaPath })

    try {
      // Click the photo/video button in the modal toolbar — this opens a file chooser
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 10000 }),
        page.click(sel.mediaButton),
      ])
      await fileChooser.setFiles(mediaPath)
      logger.debug('LinkedIn: media attached via file chooser')
      await sleep(randInt(3000, 6000))
    } catch {
      // Fallback: try a hidden file input directly
      try {
        const fileInput = await page.$('input[type="file"]')
        if (fileInput) {
          await fileInput.setInputFiles(mediaPath)
          await sleep(randInt(3000, 5000))
          logger.debug('LinkedIn: media attached via hidden input')
        }
      } catch (err) {
        logger.warn('LinkedIn: could not attach media, posting without it', { error: err.message })
      }
    }
  }

  await sleep(randInt(1000, 2500))

  // Find the "Post" button inside the modal
  let postButton = null

  // Try the specific submit selector first
  try {
    const btn = await page.$(sel.postSubmitButton)
    if (btn && await btn.isVisible()) postButton = btn
  } catch { /* try next */ }

  // Fallback: iterate visible buttons with exact text "Post" inside the modal
  if (!postButton) {
    const buttons = await page.$$('button')
    for (const btn of buttons) {
      if (!await btn.isVisible()) continue
      const txt = (await btn.textContent() || '').trim()
      if (txt !== 'Post') continue
      const inModal = await btn.evaluate(el =>
        !!el.closest('[role="dialog"], .share-creation-state, .artdeco-modal, .share-box-footer, .share-actions')
      )
      if (inModal) { postButton = btn; break }
    }
  }

  if (!postButton) throw new Error('LinkedIn: Post button not found in modal')

  await postButton.click()
  logger.info('LinkedIn: Post button clicked')

  // Wait for modal to close (post submitted)
  try {
    await page.waitForSelector(sel.composerModal, { state: 'hidden', timeout: 30000 })
  } catch {
    // Modal may close very fast or selector may flicker — verify we're back on feed
    await page.waitForSelector(sel.shareBoxTrigger, { timeout: 15000 })
  }

  await sleep(actionDelay())
  logger.info('LinkedIn: post submitted successfully')
  return { postId: null }
}

module.exports = { createPost }
