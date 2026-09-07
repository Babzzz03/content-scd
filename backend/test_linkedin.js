/**
 * LinkedIn posting test — stealth-hardened, single-run only.
 *
 *   LINKEDIN_COOKIE="li_at=xxxx" node test_linkedin.js
 *
 * Uses the same browser config + stealth script as production BrowserManager.
 * DO NOT run this multiple times with the same cookie — run once, fix, run once.
 */
require('dotenv').config()
const { chromium } = require('playwright')
const path = require('path')
const os = require('os')
const fs = require('fs')

const COOKIE   = process.env.LINKEDIN_COOKIE || ''
const IMG_PATH = process.env.TEST_IMAGE || path.resolve('/Users/mac/Desktop/Screenshot 2026-05-05 at 15.40.51.png')
const CAPTION  = 'Test post from PostFlow automation #automation #test'

// ── Stealth script (matches BrowserManager.js) ──────────────────────────────
const STEALTH_SCRIPT = `
Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true });
Object.defineProperty(navigator, 'plugins', {
  get: () => {
    const arr = [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
      { name: 'Native Client',     filename: 'internal-nacl-plugin', description: '' },
    ];
    arr.__proto__ = PluginArray.prototype;
    return arr;
  }, configurable: true,
});
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'], configurable: true });
if (!window.chrome) {
  window.chrome = { app: { isInstalled: false }, runtime: {}, loadTimes: function(){}, csi: function(){} };
}
const origQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (p) =>
  p.name === 'notifications'
    ? Promise.resolve({ state: Notification.permission, onchange: null })
    : origQuery(p);
`

// ── Find real Chrome binary ──────────────────────────────────────────────────
const CHROME_CANDIDATES = [
  process.env.CHROME_EXECUTABLE_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  `${os.homedir()}/Library/Caches/ms-playwright/chromium-1217/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
]
const executablePath = CHROME_CANDIDATES.find(p => p && fs.existsSync(p))

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const log = (s, m, e = '') => console.log(`[${new Date().toISOString().slice(11,19)}] [${s}] ${m}`, e || '')
const screenshot = async (page, name) => {
  const file = `/tmp/li_${name}.png`
  await page.screenshot({ path: file, fullPage: false })
  log('SCREENSHOT', `→ ${file}`)
}

;(async () => {
  if (!COOKIE) { console.error('Set LINKEDIN_COOKIE env var: LINKEDIN_COOKIE="li_at=..."'); process.exit(1) }

  log('INIT', `Chrome binary: ${executablePath || 'Playwright bundled Chromium'}`)
  const browser = await chromium.launch({
    headless: false,
    executablePath,  // real Chrome if found
    slowMo: 80,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-infobars',
      '--window-position=0,0',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  })

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    colorScheme: 'light',
    permissions: ['notifications'],
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  })

  // Inject stealth into every page before any script runs
  await context.addInitScript(STEALTH_SCRIPT)

  // Block tracking/analytics — reduces noise requests
  await context.route(/google-analytics|googletagmanager|facebook\.net\/tr|linkedin\.com\/li\/track/, r => r.abort())

  const cookies = COOKIE.split(';').map(s => s.trim()).filter(Boolean).map(pair => {
    const [name, ...rest] = pair.split('=')
    return { name: name.trim(), value: rest.join('=').trim(), domain: '.linkedin.com', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }
  })
  await context.addCookies(cookies)
  log('AUTH', `Injected: ${cookies.map(c => c.name).join(', ')}`)

  const page = await context.newPage()

  try {
    // ── Step 1: Navigate to root first, not /feed/ directly ─────────────────
    // Going straight to /feed/ can trigger a redirect loop if LinkedIn
    // does a fresh CSRF handshake. Root URL settles cleanly first.
    log('STEP1', 'Loading linkedin.com root...')
    await page.goto('https://www.linkedin.com/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(rand(3000, 5000))
    await screenshot(page, '01_root')

    const urlAfterRoot = page.url()
    log('STEP1', `URL after root: ${urlAfterRoot}`)
    if (urlAfterRoot.includes('/login') || urlAfterRoot.includes('/authwall') || urlAfterRoot.includes('checkpoint')) {
      log('AUTH', 'ERROR: Redirected to login/authwall — cookie is invalid or expired')
      await browser.close(); process.exit(1)
    }

    // ── Step 2: Navigate to feed ─────────────────────────────────────────────
    log('STEP2', 'Navigating to feed...')
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(rand(4000, 6000))
    await screenshot(page, '02_feed')

    const feedUrl = page.url()
    log('STEP2', `URL on feed: ${feedUrl}`)
    if (!feedUrl.includes('linkedin.com') || feedUrl.includes('/login')) {
      log('AUTH', 'ERROR: Feed redirected to login')
      await browser.close(); process.exit(1)
    }
    log('AUTH', 'Session confirmed valid')

    // ── PROBE: Find all "Start a post" elements ──────────────────────────────
    log('PROBE', 'Scanning for Start-a-post trigger...')
    const triggerProbe = await page.evaluate(() =>
      [
        '[aria-label*="Start a post"]',
        '.share-box-feed-entry__trigger',
        'button[aria-label*="post" i]',
        '[data-control-name*="share"]',
        '.share-creation-state',
      ].flatMap(sel =>
        Array.from(document.querySelectorAll(sel)).map(el => ({
          sel,
          tag: el.tagName,
          ariaLabel: el.getAttribute('aria-label'),
          cls: el.className?.toString().slice(0, 80),
          visible: el.offsetParent !== null,
          text: (el.textContent || '').trim().slice(0, 60),
        }))
      )
    )
    log('PROBE', `${triggerProbe.length} trigger candidates:`)
    triggerProbe.forEach((r, i) => console.log(`  [${i}]`, JSON.stringify(r)))

    // ── Step 3: Open composer ────────────────────────────────────────────────
    log('STEP3', 'Opening composer...')
    const triggerSelectors = [
      'button.share-box-feed-entry__trigger',
      '.share-box-feed-entry__trigger',
      'button[aria-label*="Start a post"]',
      '[aria-label="Start a post, try a video or a photo"]',
      'div[aria-label*="Start a post"] button',
      'div[aria-label*="Start a post"]',
    ]
    let opened = false
    for (const s of triggerSelectors) {
      try {
        const el = await page.$(s)
        if (!el) continue
        const vis = await el.isVisible()
        log('STEP3', `  ${s} — visible=${vis}`)
        if (!vis) continue
        await el.click()
        opened = true
        log('STEP3', `Clicked: "${s}"`)
        break
      } catch (err) { log('STEP3', `  err ${s}: ${err.message.slice(0, 60)}`) }
    }
    if (!opened) throw new Error('Could not open composer')
    await sleep(rand(2500, 3500))
    await screenshot(page, '03_composer')

    // ── PROBE: DOM after opening composer ────────────────────────────────────
    log('PROBE', 'Scanning DOM after composer open...')
    const composerProbe = await page.evaluate(() =>
      [
        '[role="dialog"]', '.artdeco-modal', '.share-creation-state',
        '[contenteditable="true"]', '[data-placeholder]',
      ].flatMap(sel =>
        Array.from(document.querySelectorAll(sel)).map(el => ({
          sel, tag: el.tagName,
          ariaLabel: el.getAttribute('aria-label'),
          cls: el.className?.toString().slice(0, 80),
          visible: el.offsetParent !== null,
          placeholder: el.getAttribute('data-placeholder'),
        }))
      )
    )
    log('PROBE', `${composerProbe.length} composer elements:`)
    composerProbe.forEach((r, i) => console.log(`  [${i}]`, JSON.stringify(r)))

    // ── Step 4: Find text area ───────────────────────────────────────────────
    log('STEP4', 'Finding text area...')
    const textAreaCandidates = [
      '.share-creation-state [contenteditable="true"]',
      '[role="dialog"] [contenteditable="true"]',
      '.ql-editor[contenteditable="true"]',
      '.artdeco-modal [contenteditable="true"]',
      '[contenteditable="true"]',
    ]
    let textArea = null
    for (const s of textAreaCandidates) {
      try {
        const el = await page.$(s)
        if (!el) continue
        const vis = await el.isVisible()
        log('STEP4', `  ${s} — visible=${vis}`)
        if (!vis) continue
        textArea = el
        log('STEP4', `Text area: "${s}"`)
        break
      } catch (err) { log('STEP4', `  err ${s}: ${err.message.slice(0, 60)}`) }
    }
    if (!textArea) { await screenshot(page, '04_no_textarea'); throw new Error('Text area not found') }

    await textArea.click()
    await sleep(rand(400, 700))
    await page.keyboard.type(CAPTION, { delay: rand(35, 70) })
    log('STEP4', 'Caption typed')
    await sleep(rand(1200, 2000))
    await screenshot(page, '04_caption')

    // ── Step 5: Attach image ─────────────────────────────────────────────────
    log('STEP5', 'Attaching image...')
    const mediaBtnCandidates = [
      'button[aria-label*="Add a photo"]',
      'button[aria-label*="Add media"]',
      'button[aria-label*="photo" i]',
      '.share-creation-state__media-button',
      '[data-control-name="share.media_attachment_button"]',
    ]
    let mediaOk = false
    for (const s of mediaBtnCandidates) {
      try {
        const el = await page.$(s)
        if (!el || !await el.isVisible()) continue
        const [chooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 8000 }),
          el.click(),
        ])
        await chooser.setFiles(IMG_PATH)
        mediaOk = true
        log('STEP5', `Media attached via "${s}"`)
        await sleep(rand(3500, 5000))
        break
      } catch (err) { log('STEP5', `  err ${s}: ${err.message.slice(0, 80)}`) }
    }
    if (!mediaOk) log('STEP5', 'No media button found — posting text-only')
    await screenshot(page, '05_media')

    // ── Step 6: Click Post ───────────────────────────────────────────────────
    log('STEP6', 'Finding Post button...')

    // Probe visible buttons for debugging
    const btnProbe = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button'))
        .filter(b => b.offsetParent !== null)
        .map(b => ({
          text: (b.textContent||'').trim(),
          aria: b.getAttribute('aria-label'),
          cls: b.className?.toString().slice(0,60),
          inModal: !!b.closest('[role="dialog"],.share-creation-state,.artdeco-modal'),
        }))
    )
    log('STEP6', 'Visible buttons:')
    btnProbe.forEach((b, i) => console.log(`  [${i}]`, JSON.stringify(b)))

    let postBtn = null
    for (const s of ['.share-actions__primary-action', 'button[aria-label*="Post now"]']) {
      try {
        const el = await page.$(s)
        if (el && await el.isVisible()) { postBtn = el; log('STEP6', `Post btn: "${s}"`); break }
      } catch {}
    }
    if (!postBtn) {
      for (const btn of await page.$$('button')) {
        if (!await btn.isVisible()) continue
        const txt = (await btn.textContent() || '').trim()
        if (txt !== 'Post') continue
        const inModal = await btn.evaluate(el =>
          !!el.closest('[role="dialog"],.share-creation-state,.artdeco-modal,.share-actions')
        )
        if (inModal) { postBtn = btn; log('STEP6', 'Post btn via text scan'); break }
      }
    }
    if (!postBtn) throw new Error('Post button not found')

    await postBtn.click()
    log('STEP6', 'Post clicked — waiting for modal to close...')

    try {
      await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 30000 })
      log('STEP6', 'Modal closed — post submitted!')
    } catch {
      await page.waitForSelector('div[aria-label*="Start a post"]', { timeout: 15000 }).catch(() => {})
      log('STEP6', 'Back on feed')
    }

    await sleep(rand(2000, 3500))
    await screenshot(page, '07_done')
    log('DONE', 'LinkedIn test complete!')

  } catch (err) {
    log('ERROR', err.message)
    await screenshot(page, 'error').catch(() => {})
    console.error(err)
  } finally {
    log('CLEANUP', 'Closing in 5s...')
    await sleep(5000)
    await browser.close()
  }
})()
