/**
 * X activity recorder — opens compose/post with your cookie and logs every
 * click, keypress, and input with full element details.
 *
 * Run with:
 *   X_COOKIE="auth_token=xxxx" node record_x.js
 *
 * Interact freely in the browser. Press Ctrl+C in terminal to stop and see full log.
 */
require('dotenv').config()
const { chromium } = require('playwright')
const os = require('os')
const fs = require('fs')

const COOKIE = process.env.X_COOKIE || ''
if (!COOKIE) { console.error('Set X_COOKIE="auth_token=..."'); process.exit(1) }

const CHROME_CANDIDATES = [
  process.env.CHROME_EXECUTABLE_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  `${os.homedir()}/Library/Caches/ms-playwright/chromium-1217/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
]
const executablePath = CHROME_CANDIDATES.find(p => p && fs.existsSync(p))

const STEALTH = `Object.defineProperty(navigator,'webdriver',{get:()=>undefined,configurable:true});`

// Injected into the page — captures every click/input/keydown and logs to console
const RECORDER = `
(function() {
  function getPath(el) {
    const parts = []
    let cur = el
    while (cur && cur !== document.body) {
      let seg = cur.tagName.toLowerCase()
      if (cur.id) { seg += '#' + cur.id; parts.unshift(seg); break }
      const testid = cur.getAttribute('data-testid')
      if (testid) { seg += '[data-testid="' + testid + '"]'; parts.unshift(seg); break }
      const role = cur.getAttribute('role')
      if (role) seg += '[role="' + role + '"]'
      const aria = cur.getAttribute('aria-label')
      if (aria) seg += '[aria-label="' + aria.slice(0,30) + '"]'
      const idx = Array.from(cur.parentElement?.children || []).indexOf(cur)
      if (idx > 0) seg += ':nth-child(' + (idx+1) + ')'
      parts.unshift(seg)
      cur = cur.parentElement
    }
    return parts.join(' > ')
  }

  function info(el) {
    return {
      tag:      el.tagName,
      testid:   el.getAttribute('data-testid') || el.closest('[data-testid]')?.getAttribute('data-testid') || '',
      role:     el.getAttribute('role') || '',
      aria:     el.getAttribute('aria-label') || '',
      text:     (el.textContent || '').trim().slice(0, 60),
      value:    el.value || '',
      placeholder: el.getAttribute('placeholder') || '',
      path:     getPath(el),
    }
  }

  document.addEventListener('click', function(e) {
    const i = info(e.target)
    console.log('__CLICK__' + JSON.stringify(i))
  }, true)

  document.addEventListener('input', function(e) {
    const i = info(e.target)
    i.inputValue = e.target.value || e.target.textContent || ''
    console.log('__INPUT__' + JSON.stringify(i))
  }, true)

  document.addEventListener('keydown', function(e) {
    if (['Tab','Shift','Alt','Meta','Control'].includes(e.key)) return
    const i = info(e.target)
    i.key = e.key
    console.log('__KEY__' + JSON.stringify(i))
  }, true)

  console.log('__RECORDER_READY__')
})()
`

const events = []
const log = (type, data) => {
  const ts = new Date().toISOString().slice(11, 19)
  const line = `[${ts}] [${type}] ${JSON.stringify(data)}`
  events.push(line)
  console.log(line)
}

;(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath,
    slowMo: 0,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--disable-infobars'],
    ignoreDefaultArgs: ['--enable-automation'],
  })

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
  })
  await context.addInitScript(STEALTH)

  const cookies = COOKIE.split(';').map(s => s.trim()).filter(Boolean).map(pair => {
    const [name, ...rest] = pair.split('=')
    return { name: name.trim(), value: rest.join('=').trim(), domain: '.x.com', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }
  })
  await context.addCookies(cookies)
  console.log(`[AUTH] Cookie injected: ${cookies.map(c => c.name).join(', ')}`)

  const page = await context.newPage()

  // Forward browser console → node console, parse recorder events
  page.on('console', msg => {
    const text = msg.text()
    if (text.startsWith('__CLICK__')) {
      try { log('CLICK', JSON.parse(text.slice(9))) } catch { log('CLICK_RAW', text) }
    } else if (text.startsWith('__INPUT__')) {
      try { log('INPUT', JSON.parse(text.slice(9))) } catch { log('INPUT_RAW', text) }
    } else if (text.startsWith('__KEY__')) {
      try { log('KEY', JSON.parse(text.slice(7))) } catch { log('KEY_RAW', text) }
    } else if (text === '__RECORDER_READY__') {
      console.log('\n=== RECORDER ACTIVE — interact freely in the browser ===')
      console.log('=== Press Ctrl+C here to stop and see the full event log ===\n')
    }
  })

  // Re-inject recorder on every navigation (SPA route changes)
  page.on('framenavigated', async frame => {
    if (frame === page.mainFrame()) {
      console.log(`[NAV] → ${frame.url()}`)
      try { await frame.evaluate(RECORDER) } catch { /* frame not ready yet */ }
    }
  })

  console.log('[NAV] Opening x.com/compose/post ...')
  await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 30000 })

  // Inject recorder after initial load too (framenavigated may fire before DOM is ready)
  await page.waitForTimeout(2000)
  await page.evaluate(RECORDER).catch(() => {})

  // Keep alive — write log on exit
  const dumpLog = () => {
    const out = '/tmp/x_record_session.log'
    fs.writeFileSync(out, events.join('\n') + '\n')
    console.log(`\n\n=== SESSION LOG saved to ${out} ===`)
    console.log(`Total events captured: ${events.length}`)
    browser.close().catch(() => {})
    process.exit(0)
  }

  process.on('SIGINT', dumpLog)

  // Auto-close after 10 minutes
  setTimeout(() => {
    console.log('\n[TIMEOUT] 10 min reached — saving log')
    dumpLog()
  }, 10 * 60 * 1000)

  // Keep process alive
  await new Promise(() => {})
})()
