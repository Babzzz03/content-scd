/**
 * Instagram caption DOM probe — runs the full post flow up to step 7
 * then dumps all editable/textarea elements so we can find the real selector.
 *
 * Run: INSTAGRAM_COOKIE="sessionid=xxx" node probe_caption.js
 */
require('dotenv').config()
const { chromium } = require('playwright')
const path = require('path')

const COOKIE   = process.env.INSTAGRAM_COOKIE || ''
const IMG_PATH = process.env.TEST_IMAGE || path.resolve('/Users/mac/Desktop/Screenshot 2026-05-05 at 15.40.51.png')

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const log = (s, m, e = '') => console.log(`[${new Date().toISOString().slice(11,19)}] [${s}] ${m}`, e || '')

const clickFirst = async (page, selectors, timeout = 10000) => {
  for (const s of selectors) {
    try {
      const el = await page.$(s)
      if (el && await el.isVisible()) { await el.click(); return true }
    } catch {}
  }
  for (const s of selectors) {
    try {
      await page.waitForSelector(s, { state: 'visible', timeout: timeout / selectors.length })
      await page.click(s)
      return true
    } catch {}
  }
  return false
}

;(async () => {
  if (!COOKIE) { console.error('Set INSTAGRAM_COOKIE env var'); process.exit(1) }

  const browser = await chromium.launch({ headless: false, slowMo: 150 })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  })

  const cookies = COOKIE.split(';').map(s => s.trim()).filter(Boolean).map(pair => {
    const [name, ...rest] = pair.split('=')
    return { name: name.trim(), value: rest.join('=').trim(), domain: '.instagram.com', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }
  })
  await context.addCookies(cookies)

  const page = await context.newPage()

  try {
    // Navigate + dismiss popups
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(3000)

    for (let i = 0; i < 3; i++) {
      try {
        const btn = page.locator('button:has-text("Not Now"), button:has-text("Not now")').first()
        if (await btn.isVisible({ timeout: 2000 })) { await btn.click(); await sleep(1500) }
        else break
      } catch { break }
    }

    // Step 1: Click Create
    log('S1', 'Clicking Create...')
    let ok = false
    for (const s of ['svg[aria-label="New post"]', 'span:has-text("Create")', '[aria-label="New post"]']) {
      try { const el = await page.$(s); if (el && await el.isVisible()) { await el.click(); ok = true; break } } catch {}
    }
    if (!ok) throw new Error('Create button not found')
    await sleep(2000)

    // Step 2: Click Post sub-menu
    log('S2', 'Clicking Post...')
    let clickedPost = false
    try {
      const item = page.locator('[role="menuitem"]').filter({ hasText: /^Post$/ }).first()
      if (await item.isVisible({ timeout: 3000 })) { await item.click(); clickedPost = true }
    } catch {}
    if (!clickedPost) {
      const els = await page.$$('div, span, a, li')
      for (const el of els) {
        if (!await el.isVisible()) continue
        if ((await el.textContent() || '').trim() === 'Post') { await el.click(); clickedPost = true; break }
      }
    }
    if (!clickedPost) throw new Error('Post sub-menu not found')
    await sleep(2500)

    // Step 3: Select from computer
    log('S3', 'Select from computer...')
    await clickFirst(page, [
      'button:has-text("Select from computer")',
      'button:has-text("Select From Computer")',
      'div[role="button"]:has-text("Select from computer")',
    ], 12000)
    await sleep(800)

    // Step 4: Upload file
    log('S4', 'Uploading file...')
    const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 10000 })
    await fileInput.setInputFiles(IMG_PATH)
    await sleep(4000)

    // Step 5: Next (crop)
    log('S5', 'Next (crop)...')
    await page.waitForSelector('div[role="button"]:has-text("Next"), button:has-text("Next")', { timeout: 20000 })
    await clickFirst(page, ['div[role="button"]:has-text("Next")', 'button:has-text("Next")'])
    await sleep(2500)

    // Step 6: Next (filter)
    log('S6', 'Next (filter)...')
    await page.waitForSelector('div[role="button"]:has-text("Next"), button:has-text("Next")', { timeout: 10000 })
    await clickFirst(page, ['div[role="button"]:has-text("Next")', 'button:has-text("Next")'])
    await sleep(3000)

    // Step 7: PROBE — dump all editable elements
    log('PROBE', 'Scanning DOM for editable / input elements...')

    const results = await page.evaluate(() => {
      const items = []

      // All textarea elements
      document.querySelectorAll('textarea').forEach(el => {
        items.push({
          tag: 'TEXTAREA',
          visible: el.offsetParent !== null,
          ariaLabel: el.getAttribute('aria-label'),
          placeholder: el.getAttribute('placeholder'),
          id: el.id,
          className: el.className.slice(0, 80),
          value: el.value.slice(0, 50),
        })
      })

      // All contenteditable elements
      document.querySelectorAll('[contenteditable]').forEach(el => {
        items.push({
          tag: el.tagName + '[contenteditable]',
          visible: el.offsetParent !== null,
          ariaLabel: el.getAttribute('aria-label'),
          placeholder: el.getAttribute('data-placeholder') || el.getAttribute('placeholder'),
          role: el.getAttribute('role'),
          id: el.id,
          className: el.className.slice(0, 80),
          text: (el.textContent || '').slice(0, 50),
        })
      })

      // All role="textbox"
      document.querySelectorAll('[role="textbox"]').forEach(el => {
        items.push({
          tag: el.tagName + '[role=textbox]',
          visible: el.offsetParent !== null,
          ariaLabel: el.getAttribute('aria-label'),
          placeholder: el.getAttribute('data-placeholder') || el.getAttribute('placeholder'),
          id: el.id,
          className: el.className.slice(0, 80),
        })
      })

      return items
    })

    log('PROBE', `Found ${results.length} editable elements:`)
    results.forEach((r, i) => console.log(`  [${i}]`, JSON.stringify(r)))

    // Also try common caption selectors and report which match
    const candidates = [
      'textarea[placeholder*="caption" i]',
      'textarea[aria-label*="caption" i]',
      'div[aria-label*="caption" i] textarea',
      'div[aria-label*="caption" i] p',
      'div[aria-label*="caption" i] [contenteditable]',
      '[role="textbox"][aria-label*="caption" i]',
      'p[contenteditable="true"]',
      'div[contenteditable="true"]',
      'textarea',
    ]
    log('PROBE', 'Testing candidate selectors:')
    for (const s of candidates) {
      try {
        const el = await page.$(s)
        const visible = el ? await el.isVisible() : false
        console.log(`  "${s}" → found=${!!el}, visible=${visible}`)
      } catch (err) {
        console.log(`  "${s}" → ERROR: ${err.message.slice(0, 80)}`)
      }
    }

    // Screenshot
    await page.screenshot({ path: '/tmp/ig_caption_probe.png', fullPage: false })
    log('PROBE', 'Screenshot saved to /tmp/ig_caption_probe.png')
    log('PROBE', 'Browser staying open for 30s — inspect manually if needed')
    await sleep(30000)

  } catch (err) {
    log('ERROR', err.message)
    await page.screenshot({ path: '/tmp/ig_probe_error.png' })
    console.error(err)
  } finally {
    await browser.close()
  }
})()
