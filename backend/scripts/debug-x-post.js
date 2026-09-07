/**
 * Debug script: full post flow with hashtags — mirrors createPost.js exactly.
 * Run with: node scripts/debug-x-post.js <auth_token>
 */
const { chromium } = require('playwright')
const path = require('path')

const AUTH_TOKEN = process.argv[2]
if (!AUTH_TOKEN) {
  console.error('Usage: node scripts/debug-x-post.js <auth_token>')
  process.exit(1)
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

;(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  })

  await context.addCookies([{
    name: 'auth_token', value: AUTH_TOKEN,
    domain: '.x.com', path: '/', httpOnly: true, secure: true, sameSite: 'Lax',
  }])

  const page = await context.newPage()

  // ── Step 1: verify login ────────────────────────────────────────────────────
  console.log('1. Checking login...')
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('nav[role="navigation"]', { timeout: 15000 })
  console.log('   ✓ Logged in')

  // ── Step 2: navigate to compose ────────────────────────────────────────────
  console.log('2. Navigating to compose...')
  await page.goto('https://x.com/compose/tweet', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('div[role="textbox"]', { timeout: 30000 })
  await sleep(randInt(2000, 3000))
  console.log('   ✓ Compose ready')

  // ── Step 3: fill content with hashtags ─────────────────────────────────────
  const content = 'Testing automated posting from PostFlow 🚀'
  const hashtags = ['automation', 'postflow']
  const hashtagStr = hashtags.length ? '\n\n' + hashtags.map(h => `#${h}`).join(' ') : ''
  const fullText = content + hashtagStr

  console.log('3. Filling text:', JSON.stringify(fullText))
  await page.locator('div[role="textbox"]').first().fill(fullText)
  await sleep(randInt(800, 1500))

  // Re-focus with force:true to bypass overlay div that intercepts pointer events
  await page.locator('div[role="textbox"]').first().click({ force: true })
  await sleep(200)

  // ── Step 4: inspect post button ────────────────────────────────────────────
  console.log('4. Inspecting Post button...')
  const btnInfo = await page.evaluate(() => {
    const btn = document.querySelector('button[data-testid="tweetButton"]')
    if (!btn) return 'NOT FOUND'
    return {
      ariaDisabled: btn.getAttribute('aria-disabled'),
      disabled: btn.disabled,
      text: btn.textContent?.trim(),
      rect: btn.getBoundingClientRect(),
    }
  })
  console.log('   tweetButton:', JSON.stringify(btnInfo))

  // ── Step 5: double-click textbox top-left ──────────────────────────────────
  console.log('5. Double-clicking textbox top-left (force:true)...')
  await page.locator('div[role="textbox"]').first().dblclick({ force: true, position: { x: 2, y: 2 } })
  await sleep(300)

  // ── Step 6: check button state again after dblclick ───────────────────────
  const btnInfo2 = await page.evaluate(() => {
    const btn = document.querySelector('button[data-testid="tweetButton"]')
    if (!btn) return 'NOT FOUND'
    return { ariaDisabled: btn.getAttribute('aria-disabled'), disabled: btn.disabled }
  })
  console.log('6. Post button after dblclick:', JSON.stringify(btnInfo2))

  // ── Step 7: click Post ─────────────────────────────────────────────────────
  console.log('7. Clicking Post button...')
  const postBtn = page.locator('button[data-testid="tweetButton"]')
  await postBtn.waitFor({ state: 'visible', timeout: 15000 })
  await postBtn.click()
  console.log('   ✓ Clicked')

  // ── Step 8: wait for dialog to close ──────────────────────────────────────
  console.log('8. Waiting for compose to close...')
  try {
    await page.waitForSelector('div[role="textbox"]', { state: 'hidden', timeout: 45000 })
    console.log('   ✓ Dialog closed — TWEET POSTED SUCCESSFULLY')
  } catch (e) {
    console.log('   ✗ Dialog did not close:', e.message)
    // Log what's on screen
    const url = page.url()
    console.log('   Current URL:', url)
    const btnStill = await page.evaluate(() => {
      const btn = document.querySelector('button[data-testid="tweetButton"]')
      return btn ? { ariaDisabled: btn.getAttribute('aria-disabled'), disabled: btn.disabled } : 'gone'
    })
    console.log('   Post button state:', JSON.stringify(btnStill))
  }

  await sleep(3000)
  await browser.close()
})()
