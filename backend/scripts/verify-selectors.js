/**
 * Live selector verification script.
 *
 * Injects each platform cookie, navigates to the platform, checks login,
 * then probes the actual DOM for the current posting selectors.
 *
 * Usage:  node scripts/verify-selectors.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })

const { chromium } = require('playwright')
const { getLaunchOptions, getContextOptions } = require('../automation/config/browser.config')

// ── Credentials ────────────────────────────────────────────────────────────────

const COOKIES = {
  linkedin: {
    name: 'li_at',
    value: 'AQEDAT5haEwDuhi5AAABnVCIRAgAAAGebo8_bk0APRM70bSjsBsxArsjEtN1QEzm6hiR9FOjfPxRP1UR_JYdtf4FH5fh5BXkW3xo_YRdhhOo2EXf3EjSqeMHN6kEbsZjnoHq8uX303qAXlJa3sxBysMG',
    domain: '.linkedin.com',
  },
  instagram: {
    name: 'sessionid',
    value: '59667930826%3AeMqbJniskqxqYN%3A14%3AAYjpwusLzwkigcO5Q6_FIUKJ2mbWahMn1WYiWo3E-g',
    domain: '.instagram.com',
  },
  x: {
    name: 'auth_token',
    value: 'eafd37148fe6b5886d5ffe9e9f352dd6493bd869',
    domain: '.x.com',
  },
}

// ── Selector probes — returns first selector that matches ─────────────────────

async function probe(page, candidates) {
  for (const sel of candidates) {
    try {
      const el = await page.$(sel)
      if (el) return { selector: sel, found: true }
    } catch {}
  }
  return { selector: null, found: false }
}

// ── Per-platform check ─────────────────────────────────────────────────────────

async function checkLinkedIn(browser) {
  console.log('\n━━━ LinkedIn ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const context = await browser.newContext(getContextOptions())
  const page = await context.newPage()

  try {
    await context.addCookies([{
      name: COOKIES.linkedin.name,
      value: COOKIES.linkedin.value,
      domain: COOKIES.linkedin.domain,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    }])

    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)

    // Check login
    const loginForm = await page.$('#username')
    const isLoggedIn = !loginForm
    console.log(`  ✓ Logged in: ${isLoggedIn}`)

    if (!isLoggedIn) {
      console.log('  ✗ Cookie invalid or expired — cannot check selectors')
      return
    }

    // Probe feed container (for isLoggedIn check)
    const feedResult = await probe(page, [
      '[data-finite-scroll-hotkey-context="FEED"]',
      'main[aria-label="Feed"]',
      '.scaffold-layout__main',
      '.feed-container-theme',
      '[id="main"]',
    ])
    console.log(`  feedContainer:    ${feedResult.found ? '✓' : '✗'} ${feedResult.selector ?? 'NOT FOUND'}`)

    // Probe share box trigger
    const shareResult = await probe(page, [
      '.share-box-feed-entry__closed-share-box',
      'button[aria-label*="Start a post"]',
      'button[aria-label*="start a post"]',
      '.share-creation-state__placeholder',
      '[data-control-name="share.sharebox_placeholder"]',
      'div[aria-label*="Start a post"]',
    ])
    console.log(`  shareBoxTrigger:  ${shareResult.found ? '✓' : '✗'} ${shareResult.selector ?? 'NOT FOUND'}`)

    // Click it to open composer
    if (shareResult.found) {
      await page.click(shareResult.selector)
      await page.waitForTimeout(2000)

      const textAreaResult = await probe(page, [
        '.ql-editor[contenteditable="true"]',
        '[data-placeholder*="share"]',
        '[data-placeholder*="talk about"]',
        '[role="textbox"][contenteditable="true"]',
        'div[aria-label*="Text editor"]',
        '.editor-content',
      ])
      console.log(`  composerTextArea: ${textAreaResult.found ? '✓' : '✗'} ${textAreaResult.selector ?? 'NOT FOUND'}`)

      const submitResult = await probe(page, [
        'button.share-actions__primary-action',
        'button[aria-label*="Post"]',
        'button[aria-label*="post"]',
        'button.share-box-footer__primary-btn',
        'button[class*="primary"][data-control-name*="share"]',
      ])
      console.log(`  postSubmitButton: ${submitResult.found ? '✓' : '✗'} ${submitResult.selector ?? 'NOT FOUND'}`)

      // Close composer
      await page.keyboard.press('Escape')
    }

  } catch (err) {
    console.log(`  ERROR: ${err.message}`)
  } finally {
    await context.close()
  }
}

async function checkInstagram(browser) {
  console.log('\n━━━ Instagram ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const context = await browser.newContext(getContextOptions())
  const page = await context.newPage()

  try {
    await context.addCookies([{
      name: COOKIES.instagram.name,
      value: COOKIES.instagram.value,
      domain: COOKIES.instagram.domain,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    }])

    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)

    // Check login
    const loginForm = await page.$('input[name="username"]')
    const isLoggedIn = !loginForm
    console.log(`  ✓ Logged in: ${isLoggedIn}`)

    if (!isLoggedIn) {
      console.log('  ✗ Cookie invalid or expired — cannot check selectors')
      return
    }

    // Probe new post button
    const newPostResult = await probe(page, [
      'svg[aria-label="New post"]',
      'a[href="/create/select/"]',
      'a[href*="create"]',
      'svg[aria-label="New post"], a[href*="create"]',
      '[aria-label="New post"]',
    ])
    console.log(`  newPostButton:    ${newPostResult.found ? '✓' : '✗'} ${newPostResult.selector ?? 'NOT FOUND'}`)

    // Click new post to get file input
    if (newPostResult.found) {
      await page.click(newPostResult.selector)
      await page.waitForTimeout(2000)

      const fileResult = await probe(page, [
        'input[accept*="image"]',
        'input[type="file"]',
        'input[accept*="video"]',
      ])
      console.log(`  fileUploadInput:  ${fileResult.found ? '✓' : '✗'} ${fileResult.selector ?? 'NOT FOUND'}`)

      const selectBtnResult = await probe(page, [
        'button:has-text("Select from computer")',
        'button:has-text("Select From Computer")',
        'div[role="button"]:has-text("Select from computer")',
      ])
      console.log(`  selectFromComp:   ${selectBtnResult.found ? '✓' : '✗'} ${selectBtnResult.selector ?? 'NOT FOUND'}`)

      // Close with Escape
      await page.keyboard.press('Escape')
    }

  } catch (err) {
    console.log(`  ERROR: ${err.message}`)
  } finally {
    await context.close()
  }
}

async function checkX(browser) {
  console.log('\n━━━ X (Twitter) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const context = await browser.newContext(getContextOptions())
  const page = await context.newPage()

  try {
    await context.addCookies([{
      name: COOKIES.x.name,
      value: COOKIES.x.value,
      domain: COOKIES.x.domain,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    }])

    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)

    // Check login
    const primaryCol = await page.$('[data-testid="primaryColumn"]')
    const isLoggedIn = !!primaryCol
    console.log(`  ✓ Logged in: ${isLoggedIn}`)

    if (!isLoggedIn) {
      console.log('  ✗ Cookie invalid or expired — cannot check selectors')
      return
    }

    const feedResult = await probe(page, [
      '[data-testid="primaryColumn"]',
    ])
    console.log(`  feedTimeline:     ${feedResult.found ? '✓' : '✗'} ${feedResult.selector ?? 'NOT FOUND'}`)

    const tweetBtnResult = await probe(page, [
      '[data-testid="SideNav_NewTweet_Button"]',
      'a[aria-label="Post"]',
      'a[data-testid="SideNav_NewTweet_Button"]',
    ])
    console.log(`  tweetButton:      ${tweetBtnResult.found ? '✓' : '✗'} ${tweetBtnResult.selector ?? 'NOT FOUND'}`)

    if (tweetBtnResult.found) {
      await page.click(tweetBtnResult.selector)
      await page.waitForTimeout(2000)

      const textAreaResult = await probe(page, [
        '[data-testid="tweetTextarea_0"]',
        '[data-testid^="tweetTextarea"]',
        '.public-DraftEditor-content',
      ])
      console.log(`  tweetTextArea:    ${textAreaResult.found ? '✓' : '✗'} ${textAreaResult.selector ?? 'NOT FOUND'}`)

      const submitResult = await probe(page, [
        '[data-testid="tweetButtonInline"]',
        '[data-testid="tweetButton"]',
        'button[aria-label="Post"]',
      ])
      console.log(`  postSubmitButton: ${submitResult.found ? '✓' : '✗'} ${submitResult.selector ?? 'NOT FOUND'}`)

      const mediaResult = await probe(page, [
        '[data-testid="fileInput"]',
        'input[accept*="image"]',
        'input[type="file"]',
      ])
      console.log(`  mediaUpload:      ${mediaResult.found ? '✓' : '✗'} ${mediaResult.selector ?? 'NOT FOUND'}`)

      await page.keyboard.press('Escape')
    }

  } catch (err) {
    console.log(`  ERROR: ${err.message}`)
  } finally {
    await context.close()
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

;(async () => {
  console.log('Starting selector verification — browser will open visibly...\n')
  const opts = getLaunchOptions()
  opts.headless = false  // always headed for verification

  const browser = await chromium.launch(opts)

  try {
    await checkX(browser)
    await checkLinkedIn(browser)
    await checkInstagram(browser)
  } finally {
    await browser.close()
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Done. Update selectors.js for any ✗ entries above.')
})()
