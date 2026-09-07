/**
 * Deep probe for missing selectors — LinkedIn composer + Instagram upload flow
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })

const { chromium } = require('playwright')
const { getLaunchOptions, getContextOptions } = require('../automation/config/browser.config')

const COOKIES = {
  linkedin: { name: 'li_at', value: 'AQEDAT5haEwDuhi5AAABnVCIRAgAAAGebo8_bk0APRM70bSjsBsxArsjEtN1QEzm6hiR9FOjfPxRP1UR_JYdtf4FH5fh5BXkW3xo_YRdhhOo2EXf3EjSqeMHN6kEbsZjnoHq8uX303qAXlJa3sxBysMG', domain: '.linkedin.com' },
  instagram: { name: 'sessionid', value: '59667930826%3AeMqbJniskqxqYN%3A14%3AAYjpwusLzwkigcO5Q6_FIUKJ2mbWahMn1WYiWo3E-g', domain: '.instagram.com' },
}

async function injectCookie(context, c) {
  await context.addCookies([{ name: c.name, value: c.value, domain: c.domain, path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }])
}

// Dump all matching elements for a set of candidate selectors
async function dumpMatches(page, label, candidates) {
  console.log(`\n  [${label}]`)
  for (const sel of candidates) {
    try {
      const count = await page.$$eval(sel, els => els.length).catch(() => 0)
      if (count > 0) {
        const info = await page.$eval(sel, el => ({
          tag: el.tagName,
          role: el.getAttribute('role'),
          label: el.getAttribute('aria-label'),
          placeholder: el.getAttribute('data-placeholder') || el.getAttribute('placeholder'),
          cls: el.className.slice(0, 80),
        })).catch(() => ({}))
        console.log(`    ✓ [${count}] ${sel}  →  ${JSON.stringify(info)}`)
      }
    } catch {}
  }
}

async function probeLinkedIn(browser) {
  console.log('\n━━━ LinkedIn deep probe ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const ctx = await browser.newContext(getContextOptions())
  const page = await ctx.newPage()
  try {
    await injectCookie(ctx, COOKIES.linkedin)
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)

    // Probe feed/login detection
    await dumpMatches(page, 'isLoggedIn candidates', [
      '[data-finite-scroll-hotkey-context="FEED"]',
      'nav[aria-label="Primary navigation"]',
      '.global-nav',
      '.feed-identity-module',
      'div[aria-label*="Start a post"]',
      '.scaffold-layout__main',
      'main[id="main"]',
      '[data-test-id="top-card"]',
    ])

    // Open the composer
    console.log('\n  Clicking "Start a post"...')
    await page.click('div[aria-label*="Start a post"]')
    await page.waitForTimeout(3000)

    // Probe for text area inside composer
    await dumpMatches(page, 'composerTextArea candidates', [
      '.ql-editor[contenteditable="true"]',
      '[contenteditable="true"]',
      '[role="textbox"]',
      'div[data-placeholder]',
      '.editor-content[contenteditable]',
      'p[data-placeholder]',
      '[aria-label*="Text editor"]',
      '[aria-label*="text editor"]',
      '.share-creation-state__text-editor',
      '.mentions-texteditor__content',
    ])

    await dumpMatches(page, 'postSubmitButton candidates', [
      'button.share-actions__primary-action',
      'button[aria-label*="Post"]',
      'button[aria-label*="post"]',
      'button.share-box-footer__primary-btn',
      'button[data-control-name="share.post"]',
      'button.artdeco-button--primary',
      'button[class*="primary"]:has-text("Post")',
    ])

    await page.keyboard.press('Escape')
  } catch (err) {
    console.log(`  ERROR: ${err.message}`)
  } finally {
    await ctx.close()
  }
}

async function probeInstagram(browser) {
  console.log('\n━━━ Instagram deep probe ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const ctx = await browser.newContext(getContextOptions())
  const page = await ctx.newPage()
  try {
    await injectCookie(ctx, COOKIES.instagram)
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)

    // Dismiss notifications popup if present
    const notNow = await page.$('button:has-text("Not Now"), button:has-text("Not now")')
    if (notNow) { await notNow.click(); await page.waitForTimeout(1000) }

    console.log('\n  Clicking new post button...')
    await page.click('svg[aria-label="New post"]')
    await page.waitForTimeout(3000)

    await dumpMatches(page, 'After clicking new post', [
      'input[type="file"]',
      'input[accept*="image"]',
      'input[accept*="video"]',
      'button:has-text("Select from computer")',
      'button:has-text("Select From Computer")',
      'div[role="button"]:has-text("Select from computer")',
      'button[class*="select"]',
      '[aria-label*="Select from computer"]',
    ])

    // Try clicking "Select from computer" if it exists
    const selectBtn = await page.$('button:has-text("Select from computer"), button:has-text("Select From Computer"), div[role="button"]:has-text("Select from computer")')
    if (selectBtn) {
      console.log('\n  "Select from computer" button found — clicking...')
      await selectBtn.click()
      await page.waitForTimeout(2000)
      await dumpMatches(page, 'After clicking select', [
        'input[type="file"]',
        'input[accept*="image"]',
      ])
    }

    await page.keyboard.press('Escape')
  } catch (err) {
    console.log(`  ERROR: ${err.message}`)
  } finally {
    await ctx.close()
  }
}

;(async () => {
  const opts = getLaunchOptions()
  opts.headless = false
  const browser = await chromium.launch(opts)
  try {
    await probeLinkedIn(browser)
    await probeInstagram(browser)
  } finally {
    await browser.close()
  }
  console.log('\n━━━ Done ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
})()
