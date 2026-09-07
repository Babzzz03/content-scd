/**
 * Confirm working selectors for LinkedIn and Instagram, then write selectors.js.
 * LinkedIn and Instagram need separate browser instances (different DNS flags).
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
  await page.screenshot({ path: path.join(SHOTS, `final-${name}.png`), timeout: 10000 }).catch(() => {})
  console.log(`  📸 final-${name}.png`)
}

// ── LinkedIn ──────────────────────────────────────────────────────────────────
async function probeLinkedIn() {
  console.log('\n━━━ LinkedIn ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const opts = getLaunchOptions()
  opts.headless = false
  // NO AsyncDns flag — it breaks LinkedIn redirects
  const browser = await chromium.launch(opts)
  const ctx = await browser.newContext(getContextOptions())
  const page = await ctx.newPage()
  const sel = {}

  try {
    await inject(ctx, COOKIES.linkedin)
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 40000 })
    await page.waitForTimeout(4000)
    await shot(page, 'li-1-feed')

    // isLoggedIn — use nav
    for (const s of ['nav[aria-label="Primary navigation"]', '.global-nav', 'div[aria-label*="Start a post"]']) {
      if (await page.$(s)) { sel.feedContainer = s; console.log(`  isLoggedIn: ${s}`); break }
    }

    // The share box "Start a post" — need to click the inner placeholder text button
    // From screenshots: there's a div with aria-label="Start a post" that wraps a trigger element
    const shareBox = await page.$('div[aria-label*="Start a post"]')
    if (shareBox) {
      const bbox = await shareBox.boundingBox()
      if (bbox) {
        // Click slightly inside (not the buttons row at bottom of share box)
        await page.mouse.click(bbox.x + 150, bbox.y + bbox.height * 0.3)
        console.log('  Clicked share box (mouse)')
        sel.shareBoxTrigger = 'div[aria-label*="Start a post"]'
      }
    }

    await page.waitForTimeout(3000)
    await shot(page, 'li-2-after-shareclick')

    // Look for the modal/dialog that appeared
    const modalSels = ['[role="dialog"]', '.share-creation-state', '.artdeco-modal', '[data-test-modal]']
    for (const s of modalSels) {
      const el = await page.$(s)
      if (el && await el.isVisible()) { console.log(`  Modal found: ${s}`); break }
    }

    // Find contenteditable
    const allEditable = await page.$$('[contenteditable="true"]')
    console.log(`  Visible contenteditable elements: ${allEditable.length}`)
    for (const el of allEditable) {
      const vis   = await el.isVisible()
      const tag   = await el.evaluate(e => e.tagName)
      const role  = await el.getAttribute('role')  || ''
      const label = await el.getAttribute('aria-label') || ''
      const cls   = (await el.getAttribute('class') || '').slice(0, 80)
      console.log(`    ${vis?'👁':'🙈'} <${tag}> role="${role}" aria-label="${label}" class="${cls}"`)
      if (vis && !sel.composerTextArea) {
        sel.composerTextArea = label
          ? `[contenteditable="true"][aria-label="${label}"]`
          : '[contenteditable="true"]'
      }
    }
    console.log(`  composerTextArea: ${sel.composerTextArea}`)

    // Find Post button — exact text match
    const buttons = await page.$$('button, [role="button"]')
    for (const btn of buttons) {
      const vis = await btn.isVisible()
      if (!vis) continue
      const txt   = (await btn.textContent() || '').trim()
      const label = (await btn.getAttribute('aria-label') || '').trim()
      if (txt === 'Post' && label !== 'Post') {
        // Make sure it's in a modal not the feed
        const inModal = await btn.evaluate(el => !!el.closest('[role="dialog"], .share-creation-state, .artdeco-modal'))
        if (inModal) {
          sel.postSubmitButton = 'button:has-text("Post")'
          console.log(`  postSubmitButton: found "Post" in modal`)
          break
        }
      }
    }
    if (!sel.postSubmitButton) sel.postSubmitButton = 'button.share-actions__primary-action, button:has-text("Post")'
    console.log(`  postSubmitButton: ${sel.postSubmitButton}`)

    await shot(page, 'li-3-modal')
  } catch (err) {
    console.log(`  ERROR: ${err.message}`)
    await shot(page, 'li-error')
  } finally {
    await browser.close()
  }
  return sel
}

// ── Instagram ─────────────────────────────────────────────────────────────────
async function probeInstagram() {
  console.log('\n━━━ Instagram ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const opts = getLaunchOptions()
  opts.headless = false
  opts.args = [...(opts.args || []), '--disable-features=AsyncDns']
  const browser = await chromium.launch(opts)
  const ctx = await browser.newContext(getContextOptions())
  const page = await ctx.newPage()
  const sel = {}

  try {
    await inject(ctx, COOKIES.instagram)
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 40000 })
    await page.waitForTimeout(3000)

    // Dismiss popups
    for (const s of ['button:has-text("Not Now")', 'button:has-text("Not now")']) {
      const btn = await page.$(s)
      if (btn && await btn.isVisible()) { await btn.click(); await page.waitForTimeout(600) }
    }

    console.log('  Trying direct /create/select/ navigation...')
    await page.goto('https://www.instagram.com/create/select/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)
    await shot(page, 'ig-create-direct')

    const curUrl = page.url()
    console.log(`  Current URL: ${curUrl}`)

    if (curUrl.includes('create')) {
      console.log('  ✓ /create/select/ works as direct nav!')
      sel.newPostButton = 'direct-nav:/create/select/'

      // Look for file input
      for (const s of ['input[type="file"]', 'input[accept*="image"]']) {
        const el = await page.$(s)
        if (el) { sel.fileUploadInput = s; console.log(`  fileUploadInput: ${s}`); break }
      }

      // Look for "Select from computer" button
      const buttons = await page.$$('button, [role="button"], div[role="button"]')
      for (const btn of buttons) {
        const vis = await btn.isVisible()
        if (!vis) continue
        const txt = (await btn.textContent() || '').trim()
        if (txt.toLowerCase().includes('select') && txt.toLowerCase().includes('computer')) {
          const tag = await btn.evaluate(e => e.tagName)
          const cls = (await btn.getAttribute('class') || '').slice(0, 60)
          sel.selectFromComputer = `${tag.toLowerCase()}:has-text("${txt}")`
          console.log(`  selectFromComputer: ${sel.selectFromComputer} (class: ${cls})`)
          break
        }
      }
    } else {
      console.log('  ✗ Redirected away from /create/select/ — falling back to click flow')
      // Go back to home
      await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(2000)

      // Click the Create nav item (href="#")
      // From the nav dump we saw: `# | text="New postCreate"`
      // Find by partial text "Create" in nav, click it
      const navItems = await page.$$('nav a, [role="navigation"] a, a[href="#"]')
      for (const item of navItems) {
        const txt = (await item.textContent() || '').trim()
        if (txt.includes('Create')) {
          await item.click()
          console.log(`  Clicked nav "Create" item`)
          sel.newPostButton = 'a[href="#"]:has-text("Create")'
          break
        }
      }
      await page.waitForTimeout(1500)

      // Now look for "Post" sub-item — it's a div/span in the nav area
      const allEls = await page.$$('nav *, [role="navigation"] *')
      for (const el of allEls) {
        const vis = await el.isVisible()
        if (!vis) continue
        const txt = (await el.textContent() || '').trim()
        if (txt === 'Post') {
          const tag = await el.evaluate(e => e.tagName)
          const role= await el.getAttribute('role') || ''
          const cls = (await el.getAttribute('class') || '').slice(0, 60)
          console.log(`  Found "Post" sub-item: <${tag}> role="${role}" cls="${cls}"`)
          sel.postMenuItem = `${tag.toLowerCase()}${role ? `[role="${role}"]` : ''}:has-text("Post")`
          await el.click()
          break
        }
      }
      await page.waitForTimeout(2000)
    }

    // Check for file picker dialog regardless of which flow
    const fileInput = await page.$('input[type="file"]')
    if (fileInput) {
      console.log('  ✓ file input found!')
      if (!sel.fileUploadInput) sel.fileUploadInput = 'input[type="file"]'
    }

    await shot(page, 'ig-final')
    console.log('\n  Found selectors:', JSON.stringify(sel, null, 4))

  } catch (err) {
    console.log(`  ERROR: ${err.message}`)
    await shot(page, 'ig-error')
  } finally {
    await browser.close()
  }
  return sel
}

// ── Write selector files ───────────────────────────────────────────────────────

function writeLinkedInSelectors(s) {
  const file = path.join(__dirname, '../automation/platforms/linkedin/selectors.js')
  fs.writeFileSync(file, `/**
 * LinkedIn selectors — verified ${new Date().toISOString().slice(0, 10)}
 */
module.exports = {
  LOGIN_URL:  'https://www.linkedin.com/login',
  HOME_URL:   'https://www.linkedin.com/feed/',
  loginEmail:    '#username',
  loginPassword: '#password',
  loginSubmit:   'button[data-litms-control-urn="login-submit"], button[type="submit"]',

  verificationInput:  'input[name="pin"]',
  verificationSubmit: 'button[type="submit"]',

  feedContainer:    ${JSON.stringify(s.feedContainer    || 'div[aria-label*="Start a post"]')},
  shareBoxTrigger:  ${JSON.stringify(s.shareBoxTrigger  || 'div[aria-label*="Start a post"]')},
  composerTextArea: ${JSON.stringify(s.composerTextArea || '[contenteditable="true"]')},
  postSubmitButton: ${JSON.stringify(s.postSubmitButton || 'button.share-actions__primary-action')},

  mediaUploadButton:  'button[aria-label*="Add a photo"], input[type="file"]',
  writeArticleButton: 'a[href*="/pulse/articleCreate"]',
  captchaContainer:   '.recaptcha-checkbox, iframe[title*="recaptcha"]',
}
`)
  console.log(`\n  ✅ Wrote linkedin/selectors.js`)
}

function writeInstagramSelectors(s) {
  // Instagram posting flow:
  //   1. Navigate directly to /create/select/ — OR — click Create → Post in nav
  //   2. Upload file via input[type="file"] (may need "Select from computer" click first)
  //   3. Click Next twice
  //   4. Write caption
  //   5. Click Share
  const file = path.join(__dirname, '../automation/platforms/instagram/selectors.js')
  fs.writeFileSync(file, `/**
 * Instagram (web) selectors — verified ${new Date().toISOString().slice(0, 10)}
 */
module.exports = {
  LOGIN_URL: 'https://www.instagram.com/accounts/login/',
  HOME_URL:  'https://www.instagram.com/',
  CREATE_URL: 'https://www.instagram.com/create/select/',

  loginUsername: 'input[name="username"]',
  loginPassword: 'input[name="password"]',
  loginSubmit:   'button[type="submit"]',

  twoFactorInput:     'input[name="verificationCode"]',
  twoFactorSubmit:    'button[type="button"]:has-text("Confirm")',
  challengeContainer: 'form[id*="challenge"]',

  feedPosts:   'article',
  navHomeIcon: 'svg[aria-label="Home"]',

  // New post — nav "Create" item (href="#" with text containing "Create")
  newPostButton:      'a[href="#"]:has-text("Create"), [aria-label="New post"]',
  // "Post" sub-item that appears after clicking Create
  postMenuItem:       ${JSON.stringify(s.postMenuItem || 'span:has-text("Post")')},

  fileUploadInput:    ${JSON.stringify(s.fileUploadInput    || 'input[type="file"]')},
  selectFromComputer: ${JSON.stringify(s.selectFromComputer || 'button:has-text("Select from computer")')},
  nextButton:         'button:has-text("Next"), div[role="button"]:has-text("Next")',
  shareButton:        'button:has-text("Share"), div[role="button"]:has-text("Share")',
  captionTextArea:    'textarea[aria-label*="Write a caption"], textarea[placeholder*="caption"]',

  notNowButton:     'button:has-text("Not Now"), button:has-text("Not now")',
  captchaContainer: 'iframe[title*="recaptcha"]',
}
`)
  console.log(`  ✅ Wrote instagram/selectors.js`)
}

// ── Main ──────────────────────────────────────────────────────────────────────
;(async () => {
  const liSel = await probeLinkedIn()
  const igSel = await probeInstagram()

  console.log('\n━━━ Writing selector files ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  writeLinkedInSelectors(liSel)
  writeInstagramSelectors(igSel)
  console.log('\n━━━ Done ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
})()
