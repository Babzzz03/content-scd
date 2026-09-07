/**
 * Confirms the correct selectors for each platform by following the real UI flow,
 * then writes the updated selectors.js files automatically.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })

const { chromium } = require('playwright')
const { getLaunchOptions, getContextOptions } = require('../automation/config/browser.config')
const path = require('path')
const fs   = require('fs')

const SHOTS = path.join(__dirname, 'screenshots')
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS)

const COOKIES = {
  linkedin:  { name: 'li_at',     value: 'AQEDAT5haEwDuhi5AAABnVCIRAgAAAGebo8_bk0APRM70bSjsBsxArsjEtN1QEzm6hiR9FOjfPxRP1UR_JYdtf4FH5fh5BXkW3xo_YRdhhOo2EXf3EjSqeMHN6kEbsZjnoHq8uX303qAXlJa3sxBysMG', domain: '.linkedin.com' },
  instagram: { name: 'sessionid', value: '59667930826%3AeMqbJniskqxqYN%3A14%3AAYjpwusLzwkigcO5Q6_FIUKJ2mbWahMn1WYiWo3E-g', domain: '.instagram.com' },
}

async function inject(ctx, c) {
  await ctx.addCookies([{ name: c.name, value: c.value, domain: c.domain, path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }])
}

async function shot(page, name) {
  const p = path.join(SHOTS, `${name}.png`)
  await page.screenshot({ path: p })
  console.log(`    📸 ${name}.png`)
}

// Try each selector candidate, return first that is visible
async function firstVisible(page, candidates) {
  for (const sel of candidates) {
    try {
      const el = await page.$(sel)
      if (!el) continue
      const visible = await el.isVisible().catch(() => false)
      if (visible) return sel
    } catch {}
  }
  return null
}

// ── LinkedIn ──────────────────────────────────────────────────────────────────

async function fixLinkedIn(browser) {
  console.log('\n━━━ LinkedIn ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const ctx = await browser.newContext(getContextOptions())
  const page = await ctx.newPage()
  const found = {}

  try {
    await inject(ctx, COOKIES.linkedin)
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 40000 })
    await page.waitForTimeout(3000)
    await shot(page, 'li-1-feed')

    // isLoggedIn — prefer nav presence over feed container
    found.isLoggedIn = await firstVisible(page, [
      'nav[aria-label="Primary navigation"]',
      '.global-nav',
      'div[aria-label*="Start a post"]',
      '.scaffold-layout__main',
    ])
    console.log(`  isLoggedIn selector:  ${found.isLoggedIn}`)

    // The "Start a post" trigger — try clicking the inner placeholder text, not outer div
    const triggerCandidates = [
      '.share-creation-state__placeholder',              // inner placeholder
      'button.share-box-feed-entry__trigger',            // button trigger
      '.share-box-feed-entry__closed-share-box button',  // first button inside box
      'div[aria-label*="Start a post"] button',          // any button inside
      'div[aria-label*="Start a post"]',                 // fallback outer div
    ]
    let triggerClicked = null
    for (const sel of triggerCandidates) {
      try {
        const el = await page.$(sel)
        if (el && await el.isVisible()) {
          console.log(`  Trying trigger: ${sel}`)
          await el.click()
          triggerClicked = sel
          break
        }
      } catch {}
    }

    if (!triggerClicked) {
      // Last resort: click by coordinates on the share box
      console.log('  Clicking share box by bounding box...')
      const box = await page.$('div[aria-label*="Start a post"]')
      if (box) {
        const bbox = await box.boundingBox()
        if (bbox) await page.mouse.click(bbox.x + bbox.width / 2, bbox.y + 20)
        triggerClicked = 'div[aria-label*="Start a post"] (mouse click)'
      }
    }

    await page.waitForTimeout(4000)
    await shot(page, 'li-2-after-click')

    // Now probe for composer text area
    found.composerTextArea = await firstVisible(page, [
      '.ql-editor[contenteditable="true"]',
      '[role="textbox"][contenteditable="true"]',
      '[contenteditable="true"].editor-content',
      'div[data-placeholder][contenteditable="true"]',
      '[aria-label*="Text editor for creating content"]',
      '[aria-label*="text editor"]',
      '.mentions-texteditor__content',
      'div.share-creation-state__editor [contenteditable]',
      '[contenteditable="true"]',  // broadest fallback
    ])
    console.log(`  composerTextArea:     ${found.composerTextArea}`)

    // If composer opened, find the Post submit button (inside the modal, not feed)
    const modalPostBtn = await firstVisible(page, [
      'button.share-actions__primary-action',
      '.share-box-footer__primary-btn',
      'button[class*="primary"]:not([aria-label*="Open control"])',
      'button.share-creation-state__create-btn',
      'div[aria-label*="Create"] button',
      // Broad: button with text "Post" that is inside a dialog/modal
    ])

    // Get button by text
    let postBtnByText = null
    try {
      const buttons = await page.$$('button')
      for (const btn of buttons) {
        const text = (await btn.textContent() || '').trim()
        const vis  = await btn.isVisible()
        if (vis && text === 'Post') {
          const cls = await btn.getAttribute('class') || ''
          postBtnByText = `button:has-text("Post")` // with class ${cls}
          console.log(`  Post button found by text, class: ${cls.slice(0, 80)}`)
          break
        }
      }
    } catch {}

    found.postSubmitButton = postBtnByText || modalPostBtn
    console.log(`  postSubmitButton:     ${found.postSubmitButton}`)

    if (found.composerTextArea) {
      await shot(page, 'li-3-composer-ready')
    }

    await page.keyboard.press('Escape')
    await page.waitForTimeout(1000)

  } catch (err) {
    console.log(`  ERROR: ${err.message}`)
    await shot(page, 'li-error').catch(() => {})
  } finally {
    await ctx.close()
  }

  return found
}

// ── Instagram ─────────────────────────────────────────────────────────────────

async function fixInstagram(browser) {
  console.log('\n━━━ Instagram ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const ctx = await browser.newContext(getContextOptions())
  const page = await ctx.newPage()
  const found = {}

  try {
    await inject(ctx, COOKIES.instagram)
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 40000 })
    await page.waitForTimeout(3000)

    // Dismiss popups
    for (const sel of ['button:has-text("Not Now")', 'button:has-text("Not now")', 'button:has-text("Allow")', 'button:has-text("Cancel")']) {
      const btn = await page.$(sel)
      if (btn && await btn.isVisible()) { await btn.click(); await page.waitForTimeout(800) }
    }
    await shot(page, 'ig-1-home')

    // isLoggedIn — no login form
    found.isLoggedIn = 'no-login-form'  // check: !page.$('input[name="username"]')
    console.log(`  isLoggedIn: checked via absence of input[name="username"]`)

    // Step 1: Click "Create" nav item (the + icon)
    const createCandidates = [
      'a[href="/create/select/"]',
      '[aria-label="New post"]',
      'svg[aria-label="New post"]',
      // The Create nav link wrapping the SVG
      'a:has(svg[aria-label="New post"])',
      'span:has-text("Create")',
    ]
    let createEl = null
    for (const sel of createCandidates) {
      try {
        createEl = await page.$(sel)
        if (createEl && await createEl.isVisible()) {
          // Navigate up to the <a> tag to click
          const tag = await createEl.evaluate(el => el.tagName)
          if (tag !== 'A') {
            const parentA = await createEl.$('xpath=./ancestor::a[1]').catch(() => null)
            if (parentA) createEl = parentA
          }
          console.log(`  Clicking create: ${sel}`)
          await createEl.click()
          found.newPostButton = sel
          break
        }
      } catch {}
    }

    await page.waitForTimeout(2000)
    await shot(page, 'ig-2-after-create-click')

    // Step 2: Click "Post" from the sub-menu that appeared
    const postMenuCandidates = [
      'a[href="/create/select/"]:has-text("Post")',
      'span:has-text("Post")',
      'div[role="menuitem"]:has-text("Post")',
      'a:has-text("Post")',
    ]
    let postMenuClicked = false
    for (const sel of postMenuCandidates) {
      try {
        const el = await page.$(sel)
        if (el && await el.isVisible()) {
          const text = (await el.textContent() || '').trim()
          if (text === 'Post' || text.startsWith('Post')) {
            console.log(`  Clicking "Post" menu item: ${sel}`)
            await el.click()
            found.postMenuItem = sel
            postMenuClicked = true
            break
          }
        }
      } catch {}
    }

    if (!postMenuClicked) {
      // Dump visible links/spans to find the Post menu item
      console.log('  Sub-menu "Post" not found. Visible menu items:')
      const items = await page.$$eval('nav a, [role="menuitem"], li a', els =>
        els.filter(el => el.offsetWidth > 0)
           .map(el => ({ text: el.textContent?.trim().slice(0,40), href: el.getAttribute('href'), label: el.getAttribute('aria-label') }))
      ).catch(() => [])
      items.forEach(i => console.log(`    text="${i.text}" href="${i.href}" label="${i.label}"`))
    }

    await page.waitForTimeout(3000)
    await shot(page, 'ig-3-after-post-menu')

    // Step 3: Probe for file upload dialog
    found.fileUploadInput = await firstVisible(page, [
      'input[type="file"]',
      'input[accept*="image"]',
      'input[accept*="video"]',
    ])
    console.log(`  fileUploadInput:      ${found.fileUploadInput}`)

    found.selectFromComputer = await firstVisible(page, [
      'button:has-text("Select from computer")',
      'button:has-text("Select From Computer")',
      'div[role="button"]:has-text("Select from computer")',
      '[aria-label*="Select from computer"]',
    ])
    console.log(`  selectFromComputer:   ${found.selectFromComputer}`)

    // Dump all visible buttons in the dialog
    const dlgButtons = await page.$$eval('button, [role="button"], [role="dialog"] button', els =>
      els.filter(el => el.offsetWidth > 0).map(el => ({
        text: (el.textContent||'').trim().slice(0,60),
        label: el.getAttribute('aria-label'),
      }))
    ).catch(() => [])
    console.log(`  Visible buttons in dialog (${dlgButtons.length}):`)
    dlgButtons.slice(0, 20).forEach(b => console.log(`    text="${b.text}" label="${b.label}"`))

    // Navigate forward — find Next / Share / caption area
    found.nextButton = await firstVisible(page, [
      'button:has-text("Next")',
      'div[role="button"]:has-text("Next")',
    ])
    found.shareButton = await firstVisible(page, [
      'button:has-text("Share")',
      'div[role="button"]:has-text("Share")',
    ])
    found.captionTextArea = await firstVisible(page, [
      'textarea[aria-label*="Write a caption"]',
      'textarea[placeholder*="caption"]',
      'textarea[placeholder*="Caption"]',
    ])

    await page.keyboard.press('Escape')
    await page.waitForTimeout(1000)
    await shot(page, 'ig-4-final')

  } catch (err) {
    console.log(`  ERROR: ${err.message}`)
    await shot(page, 'ig-error').catch(() => {})
  } finally {
    await ctx.close()
  }

  return found
}

// ── Write updated selectors ───────────────────────────────────────────────────

function writeLinkedInSelectors(found) {
  const filePath = path.join(__dirname, '../automation/platforms/linkedin/selectors.js')
  const content = `/**
 * LinkedIn CSS selectors — auto-updated by fix-selectors.js
 * Last verified: ${new Date().toISOString().slice(0,10)}
 */
module.exports = {
  LOGIN_URL:  'https://www.linkedin.com/login',
  HOME_URL:   'https://www.linkedin.com/feed/',
  loginEmail:    '#username',
  loginPassword: '#password',
  loginSubmit:   'button[data-litms-control-urn="login-submit"], button[type="submit"]',

  verificationInput:  'input[name="pin"]',
  verificationSubmit: 'button[type="submit"]',

  // isLoggedIn check
  feedContainer: ${JSON.stringify(found.isLoggedIn || 'div[aria-label*="Start a post"]')},

  // Compose flow
  shareBoxTrigger:  ${JSON.stringify(found.shareBoxTrigger || 'div[aria-label*="Start a post"]')},
  composerTextArea: ${JSON.stringify(found.composerTextArea || '[contenteditable="true"]')},
  postSubmitButton: ${JSON.stringify(found.postSubmitButton || 'button:has-text("Post")')},

  mediaUploadButton: 'button[aria-label*="Add a photo"], input[type="file"]',
  writeArticleButton: 'a[href*="/pulse/articleCreate"]',
  captchaContainer: '.recaptcha-checkbox, iframe[title*="recaptcha"]',
  challengePage:    '[data-testid="challenge-page"]',
}
`
  fs.writeFileSync(filePath, content)
  console.log(`\n  ✅ Wrote ${filePath}`)
}

function writeInstagramSelectors(found) {
  const filePath = path.join(__dirname, '../automation/platforms/instagram/selectors.js')
  const content = `/**
 * Instagram (web) CSS selectors — auto-updated by fix-selectors.js
 * Last verified: ${new Date().toISOString().slice(0,10)}
 */
module.exports = {
  LOGIN_URL: 'https://www.instagram.com/accounts/login/',
  HOME_URL:  'https://www.instagram.com/',
  loginUsername: 'input[name="username"]',
  loginPassword: 'input[name="password"]',
  loginSubmit:   'button[type="submit"]',

  twoFactorInput:  'input[name="verificationCode"]',
  twoFactorSubmit: 'button[type="button"]:has-text("Confirm")',
  challengeContainer: 'form[id*="challenge"], [data-testid="challenge-container"]',

  feedPosts:   'article',
  navHomeIcon: 'svg[aria-label="Home"]',

  // New post flow: click Create → click Post from sub-menu
  newPostButton:       ${JSON.stringify(found.newPostButton || 'svg[aria-label="New post"]')},
  postMenuItem:        ${JSON.stringify(found.postMenuItem  || 'span:has-text("Post")')},
  fileUploadInput:     ${JSON.stringify(found.fileUploadInput    || 'input[type="file"]')},
  selectFromComputer:  ${JSON.stringify(found.selectFromComputer || 'button:has-text("Select from computer")')},
  nextButton:          ${JSON.stringify(found.nextButton    || 'button:has-text("Next")')},
  shareButton:         ${JSON.stringify(found.shareButton   || 'button:has-text("Share")')},
  captionTextArea:     ${JSON.stringify(found.captionTextArea || 'textarea[aria-label*="Write a caption"]')},

  notNowButton:  'button:has-text("Not Now"), button:has-text("Not now")',
  captchaContainer: 'iframe[title*="recaptcha"], [data-captcha]',
}
`
  fs.writeFileSync(filePath, content)
  console.log(`  ✅ Wrote ${filePath}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

;(async () => {
  const opts = getLaunchOptions()
  opts.headless = false
  opts.args = [...(opts.args || []), '--disable-features=AsyncDns']
  const browser = await chromium.launch(opts)

  try {
    const liFound = await fixLinkedIn(browser)
    const igFound = await fixInstagram(browser)

    console.log('\n━━━ Updating selector files ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    writeLinkedInSelectors(liFound)
    writeInstagramSelectors(igFound)
  } finally {
    await browser.close()
  }

  console.log('\n━━━ Done ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
})()
