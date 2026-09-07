/**
 * X Thread posting test — run with:
 *   X_COOKIE="auth_token=xxxx" node test_x_thread.js
 */
require('dotenv').config()
const { chromium } = require('playwright')
const os = require('os')
const fs = require('fs')

const COOKIE = process.env.X_COOKIE || ''

const TS = Date.now()
const THREAD = [
  `Tweet 1/3 — PostFlow thread test 🧵 Opening tweet. [${TS}]`,
  `Tweet 2/3 — Second tweet in the thread. More detail here. [${TS}]`,
  `Tweet 3/3 — Final tweet. Thread complete via PostFlow ✅ [${TS}]`,
]

const CHROME_CANDIDATES = [
  process.env.CHROME_EXECUTABLE_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  `${os.homedir()}/Library/Caches/ms-playwright/chromium-1217/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
]
const executablePath = CHROME_CANDIDATES.find(p => p && fs.existsSync(p))

const STEALTH = `Object.defineProperty(navigator,'webdriver',{get:()=>undefined,configurable:true});`

const sleep = ms => new Promise(r => setTimeout(r, ms))
const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const log   = (s, m) => console.log(`[${new Date().toISOString().slice(11,19)}] [${s}] ${m}`)
const shot  = async (page, name) => {
  const f = `/tmp/x_thread_${name}.png`
  await page.screenshot({ path: f })
  log('SHOT', `→ ${f}`)
}

;(async () => {
  if (!COOKIE) { console.error('Set X_COOKIE="auth_token=..."'); process.exit(1) }

  const browser = await chromium.launch({
    headless: false, executablePath, slowMo: 80,
    args: ['--no-sandbox','--disable-blink-features=AutomationControlled','--disable-infobars'],
    ignoreDefaultArgs: ['--enable-automation'],
  })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    locale: 'en-US', timezoneId: 'America/New_York',
  })
  await context.addInitScript(STEALTH)

  const cookies = COOKIE.split(';').map(s => s.trim()).filter(Boolean).map(pair => {
    const [name, ...rest] = pair.split('=')
    return { name: name.trim(), value: rest.join('=').trim(), domain: '.x.com', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }
  })
  await context.addCookies(cookies)
  log('AUTH', `Injected: ${cookies.map(c => c.name).join(', ')}`)

  const page = await context.newPage()

  try {
    // ── Step 1: Land on /home first to dismiss cookie banner safely ───────────
    // Dismissing on /home does NOT redirect. Going straight to compose/post causes
    // the dismiss to redirect away from compose, losing the modal.
    log('NAV', 'Going to x.com/home to handle cookie banner...')
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(rand(2000, 3000))

    if (page.url().includes('/login')) { log('AUTH', 'ERROR: cookie invalid'); await browser.close(); process.exit(1) }
    log('AUTH', 'Session valid ✓')
    await shot(page, '01_home')

    // Dismiss cookie banner on /home (accept = no redirect, preference stored for session)
    for (const s of [
      'button:has-text("Accept all cookies")',
      'button:has-text("Refuse non-essential cookies")',
    ]) {
      try {
        const el = await page.$(s)
        if (el && await el.isVisible()) {
          await el.click()
          log('COOKIE', `Dismissed via: "${s}"`)
          await sleep(1500)
          break
        }
      } catch { /* not present */ }
    }
    await shot(page, '02_cookie_done')

    // ── Step 2: Navigate to compose — cookie is already handled ──────────────
    log('NAV', 'Navigating to x.com/compose/post...')
    await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(rand(1500, 2500))
    // Do NOT dismiss cookies here — dismissing on compose/post closes the modal.
    // The cookie banner sits at the bottom and does not block the compose modal or addButton.

    await page.waitForSelector('div[data-testid="tweetTextarea_0"]', { timeout: 20000 })
    log('NAV', 'Compose modal ready ✓')
    await shot(page, '03_compose_ready')

    // ── Fill tweet 1 — must use keyboard.type() not fill() for DraftJS ───────
    log('TWEET1', `Filling: "${THREAD[0].slice(0, 50)}..."`)
    const tweet1box = page.locator('div[data-testid="tweetTextarea_0"]').first()
    await tweet1box.waitFor({ state: 'visible', timeout: 10000 })
    await tweet1box.click({ force: true })
    await sleep(300)
    await page.keyboard.type(THREAD[0], { delay: rand(30, 60) })
    await sleep(300)
    // Move cursor to first word — dismisses hashtag/mention autocomplete and unblocks addButton
    await tweet1box.click({ force: true, position: { x: 2, y: 2 } })
    await sleep(500)
    await shot(page, '04_tweet1')

    // ── Add remaining tweets ──────────────────────────────────────────────────
    for (let i = 1; i < THREAD.length; i++) {
      const slotSelector = `div[data-testid="tweetTextarea_${i}"]`
      log(`TWEET${i + 1}`, `Adding tweet ${i + 1} → slot: ${slotSelector}`)

      const addBtn = page.locator('button[data-testid="addButton"]').last()
      await addBtn.waitFor({ state: 'visible', timeout: 10000 })
      await addBtn.click({ force: true })
      log(`TWEET${i + 1}`, '  addButton clicked ✓')

      // Wait for the new slot to appear
      await page.waitForSelector(slotSelector, { timeout: 10000 })
      log(`TWEET${i + 1}`, `  slot appeared ✓`)
      await sleep(rand(400, 700))

      const newBox = page.locator(slotSelector)
      await newBox.click({ force: true })
      await sleep(200)
      await page.keyboard.type(THREAD[i], { delay: rand(30, 60) })
      await sleep(300)
      // Move cursor to first word — dismisses autocomplete and unblocks next addButton
      await newBox.click({ force: true, position: { x: 2, y: 2 } })
      await sleep(500)
      log(`TWEET${i + 1}`, `  filled ✓`)
      await shot(page, `0${i + 3}_tweet${i + 1}`)
    }

    await sleep(rand(800, 1500))
    await shot(page, '06_before_submit')

    // ── Probe buttons before submitting ───────────────────────────────────────
    const btnProbe = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button[data-testid="tweetButton"],button[data-testid="tweetButtonInline"]'))
        .map(b => ({ testid: b.dataset.testid, text: (b.textContent||'').trim(), disabled: b.disabled }))
    )
    log('SUBMIT', `Post buttons: ${JSON.stringify(btnProbe)}`)

    // ── Click Post all — confirmed data-testid="tweetButton" from live recording ─
    const postBtn = page.locator('button[data-testid="tweetButton"]').last()
    const disabled = await postBtn.evaluate(el => el.disabled).catch(() => true)
    log('SUBMIT', `tweetButton disabled=${disabled}`)
    if (disabled) throw new Error('Post button is disabled — thread may not have filled correctly')

    await postBtn.click({ force: true })
    log('SUBMIT', 'Clicked — waiting for navigation away from compose...')

    // X may redirect to /home or to the posted tweet URL
    // X uses client-side routing — waitForURL with a function needs a load event that never fires.
    // Check the pathname directly instead.
    await page.waitForFunction(() => !window.location.pathname.includes('/compose'), { timeout: 60000 })
    log('DONE', `Posted! Final URL: ${page.url()}`)

    await sleep(rand(2000, 3000))
    await shot(page, '07_done')

  } catch (err) {
    log('ERROR', err.message)
    await shot(page, 'error').catch(() => {})
    console.error(err)
  } finally {
    log('CLEANUP', 'Closing in 5s...')
    await sleep(5000)
    await browser.close()
  }
})()
