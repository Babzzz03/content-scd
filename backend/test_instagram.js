/**
 * Instagram posting test — run with:
 *   INSTAGRAM_COOKIE="sessionid=xxxx" node test_instagram.js
 *
 * Logs every step so you can see exactly where the flow breaks.
 */
require('dotenv').config()
const { chromium } = require('playwright')
const path = require('path')

const COOKIE   = process.env.INSTAGRAM_COOKIE || ''
// TEST_IMAGES: comma-separated paths for carousel test; falls back to single image
const IMG_PATHS = process.env.TEST_IMAGES
  ? process.env.TEST_IMAGES.split(',').map(p => path.resolve(p.trim()))
  : process.env.TEST_IMAGE
    ? [path.resolve(process.env.TEST_IMAGE)]
    : [
        path.resolve('/Users/mac/Desktop/Screenshot 2026-05-05 at 15.40.51.png'),
        path.resolve('/Users/mac/Desktop/Screenshot 2026-04-28 at 01.55.22.png'),
      ]
const CAPTION  = `Test carousel post from PostFlow automation 🚀 #test [${Date.now()}]`

// ── Selectors (mirrors selectors.js) ─────────────────────────────────────────
const SEL = {
  HOME:              'https://www.instagram.com/',
  notNow:            'button:has-text("Not Now"), button:has-text("Not now")',
  newPostSvg:        'svg[aria-label="New post"]',
  newPostCreate:     'span:has-text("Create")',
  fileInput:         'input[type="file"]',
  nextBtn:           'div[role="button"]:has-text("Next"), button:has-text("Next")',
  captionArea:       'div[aria-label="Write a caption"] p[contenteditable], div[aria-label="Write a caption"] textarea, textarea[aria-label*="caption"]',
  shareBtn:          'div[role="button"]:has-text("Share"), button:has-text("Share")',
  selectFromComputer:'button:has-text("Select from computer"), button:has-text("Select From Computer"), div[role="button"]:has-text("Select from computer")',
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const log = (step, msg, extra = '') => {
  const ts = new Date().toISOString().slice(11,19)
  console.log(`[${ts}] [${step}] ${msg}`, extra || '')
}

const screenshot = async (page, name) => {
  const file = `/tmp/ig_${name}.png`
  await page.screenshot({ path: file, fullPage: false })
  log('SCREENSHOT', `saved → ${file}`)
}

;(async () => {
  if (!COOKIE) {
    console.error('ERROR: set INSTAGRAM_COOKIE env var. Example:')
    console.error('  INSTAGRAM_COOKIE="sessionid=abc123" node test_instagram.js')
    process.exit(1)
  }

  log('INIT', 'Launching browser (headless=false so you can watch)')
  const browser = await chromium.launch({ headless: false, slowMo: 200 })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  })

  // ── Inject session cookie ─────────────────────────────────────────────────
  const cookiePairs = COOKIE.split(';').map(s => s.trim()).filter(Boolean)
  const cookies = cookiePairs.map(pair => {
    const [name, ...rest] = pair.split('=')
    return {
      name: name.trim(),
      value: rest.join('=').trim(),
      domain: '.instagram.com',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    }
  })
  await context.addCookies(cookies)
  log('AUTH', `Injected ${cookies.length} cookie(s):`, cookies.map(c => c.name).join(', '))

  const page = await context.newPage()

  // Log all console errors from the page
  page.on('console', msg => {
    if (msg.type() === 'error') log('PAGE-ERROR', msg.text())
  })
  page.on('pageerror', err => log('PAGE-EXCEPTION', err.message))

  try {
    // ── Navigate to Instagram ───────────────────────────────────────────────
    log('NAV', 'Going to instagram.com...')
    await page.goto(SEL.HOME, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(3000)
    await screenshot(page, '01_home')

    // ── Check login ─────────────────────────────────────────────────────────
    const isLoginPage = await page.$('input[name="username"]')
    if (isLoginPage) {
      log('AUTH', 'ERROR: Still on login page — cookie is invalid or expired!')
      await screenshot(page, '02_login_fail')
      await browser.close(); process.exit(1)
    }
    log('AUTH', 'Session valid — on home feed')

    // ── Dismiss popups ──────────────────────────────────────────────────────
    for (let i = 0; i < 3; i++) {
      try {
        const btn = page.locator(SEL.notNow).first()
        if (await btn.isVisible({ timeout: 2000 })) {
          await btn.click(); log('POPUP', `Dismissed popup ${i+1}`); await sleep(1500)
        } else break
      } catch { break }
    }

    // ── Step 1: Click Create / New post ─────────────────────────────────────
    log('STEP1', 'Looking for Create / New post button...')
    let clickedCreate = false
    for (const s of [SEL.newPostSvg, SEL.newPostCreate]) {
      try {
        const el = await page.$(s)
        if (el && await el.isVisible()) {
          log('STEP1', `Found via selector: ${s}`)
          await el.click(); clickedCreate = true; break
        }
      } catch { /* try next */ }
    }
    if (!clickedCreate) {
      // Last resort: find any clickable element with aria-label "New post"
      const el = await page.$('[aria-label="New post"]')
      if (el) { await el.click(); clickedCreate = true; log('STEP1', 'Found via aria-label="New post"') }
    }
    if (!clickedCreate) throw new Error('Could not find Create / New post button')
    await sleep(2000)
    await screenshot(page, '03_after_create_click')

    // ── Step 2: Click "Post" from the sub-menu ──────────────────────────────
    log('STEP2', 'Looking for "Post" in sub-menu...')
    let clickedPost = false

    // Try role-based
    try {
      const item = page.locator('[role="menuitem"]').filter({ hasText: /^Post$/ }).first()
      if (await item.isVisible({ timeout: 3000 })) {
        await item.click(); clickedPost = true; log('STEP2', 'Clicked via [role="menuitem"]')
      }
    } catch { /* try next */ }

    // Try dialog approach
    if (!clickedPost) {
      try {
        const item = page.locator('[role="dialog"] div').filter({ hasText: /^Post$/ }).first()
        if (await item.isVisible({ timeout: 3000 })) {
          await item.click(); clickedPost = true; log('STEP2', 'Clicked via [role="dialog"] div')
        }
      } catch { /* try next */ }
    }

    // Brute-force: iterate visible elements with text "Post"
    if (!clickedPost) {
      log('STEP2', 'Trying brute-force element scan...')
      const els = await page.$$('div, span, a, li')
      for (const el of els) {
        if (!await el.isVisible()) continue
        const txt = (await el.textContent() || '').trim()
        if (txt === 'Post') {
          await el.click(); clickedPost = true
          log('STEP2', `Clicked via brute-force — tag: ${await el.evaluate(e => e.tagName)}`)
          break
        }
      }
    }

    if (!clickedPost) throw new Error('Could not find "Post" sub-menu item')
    await sleep(2500)
    await screenshot(page, '04_after_post_click')

    // ── Step 3: Click "Select from computer" ────────────────────────────────
    log('STEP3', 'Looking for "Select from computer" button...')
    const selectSelectors = [
      'button:has-text("Select from computer")',
      'button:has-text("Select From Computer")',
      'div[role="button"]:has-text("Select from computer")',
      'div[role="button"]:has-text("Select From Computer")',
      '[role="button"]:has-text("Select from computer")',
    ]
    let clickedSelect = false
    for (const s of selectSelectors) {
      try {
        await page.waitForSelector(s, { state: 'visible', timeout: 3000 })
        await page.click(s)
        clickedSelect = true; log('STEP3', `Clicked via: ${s}`); break
      } catch { /* try next */ }
    }
    if (!clickedSelect) throw new Error('Could not find "Select from computer" button')
    await sleep(1000)

    // ── Step 4: Upload first image, then add remaining via carousel "+" button ─
    log('STEP4', `Uploading ${IMG_PATHS.length} image(s). First: ${IMG_PATHS[0]}`)
    try {
      const fileInput = await page.waitForSelector(SEL.fileInput, { state: 'attached', timeout: 8000 })
      await fileInput.setInputFiles(IMG_PATHS[0])
      log('STEP4', 'First file set ✓')
    } catch (err) {
      log('STEP4', 'ERROR finding file input:', err.message)
      await screenshot(page, '05_file_input_error')
      throw err
    }
    await sleep(4000)
    await screenshot(page, '05a_first_image_uploaded')

    // Add remaining carousel images via the "+" (Plus icon) thumbnail-strip button
    for (let i = 1; i < IMG_PATHS.length; i++) {
      log('STEP4', `Adding carousel image ${i + 1}/${IMG_PATHS.length}: ${IMG_PATHS[i]}`)

      // Wait for Plus button; if not visible try opening the gallery strip first
      let plusVisible = false
      try {
        await page.waitForSelector('[aria-label="Plus icon"]', { state: 'visible', timeout: 3000 })
        plusVisible = true
        log('STEP4', '  Plus button found ✓')
      } catch {
        log('STEP4', '  Plus not visible — trying "Open media gallery" button')
        try {
          // Aria-label is title-case: "Open Media Gallery" (confirmed from DOM probe)
          const galleryBtn = page.locator('[aria-label="Open Media Gallery"]').first()
          if (await galleryBtn.isVisible({ timeout: 2000 })) {
            await galleryBtn.click()
            log('STEP4', '  Opened gallery strip ✓')
            await sleep(800)
            await page.waitForSelector('[aria-label="Plus icon"]', { state: 'visible', timeout: 3000 })
            plusVisible = true
          }
        } catch (e) {
          log('STEP4', `  gallery open failed: ${e.message.slice(0, 60)}`)
        }
      }

      if (!plusVisible) {
        await screenshot(page, `05_plus_not_found_${i}`)
        throw new Error(`Could not find carousel "+" button for image ${i + 1}`)
      }

      const plusBtn = page.locator('[aria-label="Plus icon"]').first()
      log('STEP4', `  Clicking Plus icon...`)
      // Try filechooser event first; fall back to hidden input
      try {
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 3000 }),
          plusBtn.click(),
        ])
        await fileChooser.setFiles(IMG_PATHS[i])
      } catch {
        const newInput = await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 5000 })
        await newInput.setInputFiles(IMG_PATHS[i])
      }
      log('STEP4', `  Image ${i + 1} set ✓`)
      await sleep(3000)
      await screenshot(page, `05b_carousel_image_${i + 1}`)
    }

    await screenshot(page, '05_after_upload')

    // ── Step 5: Crop — set 1:1 ratio then Next ──────────────────────────────
    log('STEP5', 'Crop step — trying to set 1:1 ratio...')
    await page.waitForSelector(SEL.nextBtn, { timeout: 15000 })
    await sleep(800)
    try {
      // Button has text "Select Crop" with no aria-label (confirmed from probe)
      // Button text confirmed from DOM probe: "Select Crop"
      const cropBtn = page.locator('button:has-text("Select Crop"), div[role="button"]:has-text("Select Crop")').first()
      if (await cropBtn.isVisible({ timeout: 3000 })) {
        await cropBtn.click()
        await sleep(800)
        await screenshot(page, '05b_crop_picker_open')
        // Ratio option text confirmed: "1:1Crop square icon" — match on ^1:1
        const ratio1x1 = page.locator('div, button').filter({ hasText: /^1:1/ }).first()
        if (await ratio1x1.isVisible({ timeout: 2000 })) {
          await ratio1x1.click()
          log('STEP5', '1:1 ratio selected ✓')
          await sleep(600)
        } else {
          log('STEP5', '1:1 option not found — leaving original ratio')
        }
      } else {
        log('STEP5', 'Crop icon not visible — skipping ratio selection')
      }
    } catch (err) {
      log('STEP5', `Crop ratio skipped: ${err.message.slice(0, 60)}`)
    }
    try {
      const nextEl = await page.$(SEL.nextBtn)
      await nextEl.click()
      log('STEP5', 'Next clicked')
    } catch (err) {
      log('STEP5', 'ERROR on Next (crop):', err.message)
      await screenshot(page, '06_next_crop_error')
      throw err
    }
    await sleep(2500)
    await screenshot(page, '06_after_crop_next')

    // ── Step 6: Next (filter) ────────────────────────────────────────────────
    log('STEP6', 'Clicking Next (filter step)...')
    try {
      await page.waitForSelector(SEL.nextBtn, { timeout: 10000 })
      const nextEl = await page.$(SEL.nextBtn)
      await nextEl.click()
      log('STEP6', 'Next clicked')
    } catch (err) {
      log('STEP6', 'ERROR on Next (filter):', err.message)
      await screenshot(page, '07_next_filter_error')
      throw err
    }
    await sleep(2500)
    await screenshot(page, '07_after_filter_next')

    // ── Step 7: Caption ──────────────────────────────────────────────────────
    log('STEP7', 'Filling caption...')
    const captionCandidates = [
      'textarea[placeholder*="caption" i]',
      'textarea[aria-label*="caption" i]',
      'div[aria-label*="caption" i] textarea',
      'div[aria-label*="caption" i] [contenteditable]',
      'div[aria-label*="caption" i] p',
      '[role="textbox"][aria-label*="caption" i]',
      'div[contenteditable="true"]',
      'p[contenteditable="true"]',
      'textarea',
    ]
    let captionFilled = false
    for (const sel of captionCandidates) {
      try {
        const el = await page.$(sel)
        if (!el) { log('STEP7', `  skip (not found): ${sel}`); continue }
        const visible = await el.isVisible().catch(() => false)
        log('STEP7', `  try: ${sel} — visible=${visible}`)
        if (!visible) continue
        await el.click()
        await sleep(400)
        await page.keyboard.type(CAPTION, { delay: 40 })
        log('STEP7', `Caption filled via: "${sel}"`)
        captionFilled = true
        break
      } catch (err) {
        log('STEP7', `  error on ${sel}: ${err.message.slice(0, 80)}`)
      }
    }
    if (!captionFilled) log('STEP7', 'WARNING: no caption selector matched — posting without caption')
    await sleep(1500)
    await screenshot(page, '08_caption')

    // ── Step 8: Share ────────────────────────────────────────────────────────
    log('STEP8', 'Clicking Share...')
    // Probe all visible buttons/divs with "Share" text so we can log what's found
    const shareProbe = await page.evaluate(() =>
      Array.from(document.querySelectorAll('div[role="button"], button')).filter(el =>
        el.offsetParent !== null && (el.textContent || '').trim() === 'Share'
      ).map(el => ({ tag: el.tagName, text: el.textContent.trim(), ariaLabel: el.getAttribute('aria-label'), className: el.className.slice(0, 60) }))
    )
    log('STEP8', `Share buttons found: ${JSON.stringify(shareProbe)}`)

    try {
      // Scoped to dialog, .last() — Share button is top-right header, last in DOM order
      const shareEl = page.locator('[role="dialog"]')
        .locator('div[role="button"], button')
        .filter({ hasText: /^Share$/ })
        .last()
      await shareEl.waitFor({ state: 'visible', timeout: 10000 })
      await shareEl.click()
      log('STEP8', 'Share clicked (force=true) — waiting for completion...')
    } catch (err) {
      log('STEP8', 'ERROR finding Share button:', err.message)
      await screenshot(page, '09_share_error')
      throw err
    }

    // Wait for share to complete — Share button disappears or success text appears
    try {
      await page.waitForFunction(
        () => {
          const btns = Array.from(document.querySelectorAll('div[role="button"], button'))
          return !btns.some(b => b.textContent && b.textContent.trim() === 'Share')
        },
        { timeout: 90000 }
      )
      log('STEP8', 'Share button gone — post submitted successfully!')
    } catch {
      try {
        await page.waitForSelector('div:has-text("has been shared"), div:has-text("Post shared")', { timeout: 30000 })
        log('STEP8', 'Success message detected!')
      } catch {
        log('STEP8', 'WARNING: Could not confirm post was shared')
      }
    }

    await sleep(3000)
    await screenshot(page, '09_final')
    log('DONE', 'Instagram post test complete!')

  } catch (err) {
    log('ERROR', err.message)
    await screenshot(page, 'error_final')
    console.error(err)
  } finally {
    log('CLEANUP', 'Closing browser in 5s...')
    await sleep(5000)
    await browser.close()
  }
})()
