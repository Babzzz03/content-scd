/**
 * Debug script: 3 attempts to post with hashtags, each trying a different
 * strategy to beat the autocomplete dropdown that blocks pointer events.
 *
 * Run: node scripts/debug-x-hashtag.js <auth_token>
 */
const { chromium } = require('playwright')

const AUTH_TOKEN = process.argv[2]
if (!AUTH_TOKEN) { console.error('Usage: node scripts/debug-x-hashtag.js <auth_token>'); process.exit(1) }

const sleep = ms => new Promise(r => setTimeout(r, ms))
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a

const CONTENT = [
  'Test post 1 — debugging hashtag blocking 🔬 #automation #postflow',
  'Test post 2 — debugging hashtag blocking 🔬 #automation #postflow',
  'Test post 3 — debugging hashtag blocking 🔬 #automation #postflow',
]

async function attempt(page, text, strategy, num) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`ATTEMPT ${num} — Strategy: ${strategy}`)
  console.log(`Text: ${JSON.stringify(text)}`)
  console.log('─'.repeat(60))

  console.log('  → Navigating to compose...')
  await page.goto('https://x.com/compose/tweet', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('div[role="textbox"]', { timeout: 30000 })
  await sleep(2500)

  console.log('  → Filling text...')
  await page.locator('div[role="textbox"]').first().fill(text)
  await sleep(1000)

  // Check if autocomplete dropdown appeared
  const dropdown = await page.$('[data-testid="typeaheadDropdown"], [id*="typeaheadDropdown"]')
  console.log('  → Autocomplete dropdown present:', !!dropdown)

  // ── Apply strategy ──────────────────────────────────────────────────────────
  if (strategy === 'escape-then-dblclick') {
    console.log('  → Pressing Escape...')
    await page.keyboard.press('Escape')
    await sleep(500)
    const dropdownAfter = await page.$('[data-testid="typeaheadDropdown"], [id*="typeaheadDropdown"]')
    console.log('  → Dropdown after Escape:', !!dropdownAfter)
    console.log('  → Double-clicking textbox top-left (force)...')
    await page.locator('div[role="textbox"]').first().dblclick({ force: true, position: { x: 2, y: 2 } })
    await sleep(500)
  }

  if (strategy === 'space-backspace') {
    console.log('  → Pressing Space then Backspace to close autocomplete...')
    await page.keyboard.press('Space')
    await sleep(300)
    await page.keyboard.press('Backspace')
    await sleep(300)
    await page.keyboard.press('Escape')
    await sleep(300)
    console.log('  → Clicking textbox (force)...')
    await page.locator('div[role="textbox"]').first().click({ force: true })
    await sleep(300)
  }

  if (strategy === 'trailing-newline') {
    // Fill with trailing newline so cursor is on a blank line, not in hashtag
    console.log('  → Re-filling with trailing newline...')
    await page.locator('div[role="textbox"]').first().fill(text + '\n')
    await sleep(500)
    const dropdownAfter = await page.$('[data-testid="typeaheadDropdown"], [id*="typeaheadDropdown"]')
    console.log('  → Dropdown after trailing newline:', !!dropdownAfter)
    await page.keyboard.press('Escape')
    await sleep(300)
  }

  // ── Inspect Post button ─────────────────────────────────────────────────────
  const btnInfo = await page.evaluate(() => {
    const btn = document.querySelector('button[data-testid="tweetButton"]')
    if (!btn) return 'NOT FOUND'
    const rect = btn.getBoundingClientRect()
    // Check if anything is covering the button
    const topEl = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    return {
      ariaDisabled: btn.getAttribute('aria-disabled'),
      disabled: btn.disabled,
      text: btn.textContent?.trim(),
      covered: topEl !== btn && !btn.contains(topEl),
      coveredBy: topEl?.tagName + ' ' + topEl?.className?.slice(0, 60),
    }
  })
  console.log('  → Post button:', JSON.stringify(btnInfo))

  // ── Click Post ──────────────────────────────────────────────────────────────
  console.log('  → Clicking Post button...')
  try {
    await page.locator('button[data-testid="tweetButton"]').click({ timeout: 8000 })
    console.log('  → ✓ Click accepted')
  } catch (e) {
    console.log('  → ✗ Click failed:', e.message.split('\n')[0])
    // Try force click as last resort
    try {
      await page.locator('button[data-testid="tweetButton"]').click({ force: true, timeout: 5000 })
      console.log('  → ✓ Force click accepted')
    } catch (e2) {
      console.log('  → ✗ Force click also failed:', e2.message.split('\n')[0])
    }
  }

  // ── Wait for result ─────────────────────────────────────────────────────────
  console.log('  → Waiting for redirect to /home...')
  try {
    await page.waitForURL('**/home', { timeout: 15000 })
    console.log(`  → ✅ ATTEMPT ${num} SUCCEEDED — tweet posted!`)
    return true
  } catch {
    console.log(`  → ❌ ATTEMPT ${num} FAILED — still on ${page.url()}`)
    // Navigate away so next attempt starts fresh
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await sleep(2000)
    return false
  }
}

;(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  })
  await context.addCookies([{
    name: 'auth_token', value: AUTH_TOKEN,
    domain: '.x.com', path: '/', httpOnly: true, secure: true, sameSite: 'Lax',
  }])
  const page = await context.newPage()

  console.log('Verifying login...')
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('nav[role="navigation"]', { timeout: 15000 })
  console.log('✓ Logged in\n')

  const strategies = ['escape-then-dblclick', 'space-backspace', 'trailing-newline']
  const results = []

  for (let i = 0; i < 3; i++) {
    const ok = await attempt(page, CONTENT[i], strategies[i], i + 1)
    results.push({ strategy: strategies[i], success: ok })
    await sleep(3000)
  }

  console.log('\n' + '═'.repeat(60))
  console.log('RESULTS SUMMARY')
  console.log('═'.repeat(60))
  results.forEach(r => console.log(`  ${r.success ? '✅' : '❌'}  ${r.strategy}`))

  await sleep(3000)
  await browser.close()
})()
