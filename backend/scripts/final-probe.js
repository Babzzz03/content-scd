/**
 * Final targeted probe — gets working selectors and writes them to selectors.js
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
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }).catch(() => {})
  console.log(`    📸 ${name}.png`)
}

// ── LinkedIn ──────────────────────────────────────────────────────────────────
async function probeLinkedIn(browser) {
  console.log('\n━━━ LinkedIn ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const ctx = await browser.newContext(getContextOptions())
  const page = await ctx.newPage()
  const sel = {}

  try {
    await inject(ctx, COOKIES.linkedin)
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 40000 })
    await page.waitForTimeout(4000)

    // isLoggedIn — check for nav or share box
    for (const s of ['nav[aria-label="Primary navigation"]', '.global-nav__primary-link', 'div[aria-label*="Start a post"]']) {
      if (await page.$(s)) { sel.feedContainer = s; break }
    }
    console.log(`  isLoggedIn sel:   ${sel.feedContainer}`)

    // Find the share box trigger — the clickable inner area (not outer div)
    // LinkedIn uses an input-like div. Try to find a button or div that's INSIDE the share box
    const shareBox = await page.$('[aria-label*="Start a post"]')
    if (!shareBox) { console.log('  ✗ share box not found'); return sel }

    // Get all clickable children
    const children = await shareBox.$$('button, input, [role="button"]')
    console.log(`  Share box clickable children: ${children.length}`)
    for (const ch of children) {
      const tag = await ch.evaluate(el => el.tagName)
      const cls = await ch.getAttribute('class') || ''
      const txt = (await ch.textContent() || '').trim().slice(0, 50)
      console.log(`    ${tag} cls="${cls.slice(0,60)}" text="${txt}"`)
    }

    // Click the share box div directly
    await shareBox.click()
    await page.waitForTimeout(1000)

    // Wait for the modal/overlay
    try {
      await page.waitForSelector('[role="dialog"], .share-creation-state, .artdeco-modal', { timeout: 8000 })
      console.log('  ✓ Modal/dialog appeared')
    } catch {
      console.log('  ✗ No modal detected, trying click on first child...')
      if (children.length > 0) {
        await children[0].click()
        await page.waitForTimeout(3000)
      }
    }
    await shot(page, 'li-composer')

    // Now find the contenteditable in the modal
    const textAreas = await page.$$('[contenteditable="true"]')
    console.log(`  contenteditable count: ${textAreas.length}`)
    for (const ta of textAreas) {
      const visible = await ta.isVisible()
      const tag     = await ta.evaluate(el => el.tagName)
      const role    = await ta.getAttribute('role')
      const label   = await ta.getAttribute('aria-label')
      const cls     = (await ta.getAttribute('class') || '').slice(0, 80)
      console.log(`    ${visible?'👁':'🙈'} ${tag} role="${role}" label="${label}" cls="${cls}"`)
      if (visible) sel.composerTextArea = `[contenteditable="true"][aria-label="${label}"]`
    }
    // If none found with aria-label, use broader selector
    if (!sel.composerTextArea) {
      const vis = textAreas.find(async ta => await ta.isVisible())
      if (vis) sel.composerTextArea = '[contenteditable="true"]'
    }
    console.log(`  composerTextArea: ${sel.composerTextArea}`)

    // Find post submit button — look for button with exact text "Post"
    const allButtons = await page.$$('button')
    for (const btn of allButtons) {
      const visible = await btn.isVisible()
      if (!visible) continue
      const txt = (await btn.textContent() || '').trim()
      const label = await btn.getAttribute('aria-label') || ''
      const cls = (await btn.getAttribute('class') || '').slice(0, 80)
      if (txt === 'Post' || label === 'Post') {
        sel.postSubmitButton = `button.${cls.split(' ').filter(Boolean)[0]}`
        console.log(`  postSubmitButton: found "Post" button, class="${cls}"`)
        break
      }
    }
    if (!sel.postSubmitButton) {
      sel.postSubmitButton = 'button[aria-label="Post"], button:has-text("Post")'
      console.log(`  postSubmitButton: fallback selector`)
    }

    await page.keyboard.press('Escape')
  } catch (err) {
    console.log(`  ERROR: ${err.message}`)
  } finally {
    await ctx.close()
  }
  return sel
}

// ── Instagram ─────────────────────────────────────────────────────────────────
async function probeInstagram(browser) {
  console.log('\n━━━ Instagram ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
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
      if (btn && await btn.isVisible()) { await btn.click(); await page.waitForTimeout(800) }
    }

    // Find all nav anchors to locate the Create/Post links
    console.log('  Scanning nav links:')
    const navAs = await page.$$('nav a, [role="navigation"] a, a[role="link"]')
    for (const a of navAs) {
      const href = await a.getAttribute('href') || ''
      const txt  = (await a.textContent() || '').trim().slice(0, 40)
      const label= await a.getAttribute('aria-label') || ''
      const vis  = await a.isVisible()
      if (vis) console.log(`    ${href} | text="${txt}" | label="${label}"`)
    }

    // Look for the Create link specifically
    const createLink = await page.$('a[href="/create/select/"]')
    if (createLink) {
      console.log('  ✓ Found a[href="/create/select/"] — direct link to file picker!')
      sel.newPostButton = 'a[href="/create/select/"]'
      await createLink.click()
      await page.waitForTimeout(3000)
      await shot(page, 'ig-create-direct')
    } else {
      // Use the expanded sidebar — the "Post" item under Create
      console.log('  No direct /create/select/ link. Expanding Create...')

      // Click the Create nav item (could be the SVG or parent <a>)
      const createBtn = await page.$('[aria-label="New post"]')
      if (createBtn) {
        // Get the <a> ancestor
        const parentA = await createBtn.$('xpath=./ancestor::a[1]').catch(() => null)
        await (parentA || createBtn).click()
        await page.waitForTimeout(1500)
        await shot(page, 'ig-create-expanded')

        // Now find "Post" sub-item — dump all visible nav links again
        console.log('  Nav links after expanding Create:')
        const allAs = await page.$$('a')
        for (const a of allAs) {
          const vis  = await a.isVisible()
          if (!vis) continue
          const href = await a.getAttribute('href') || ''
          const txt  = (await a.textContent() || '').trim().slice(0, 40)
          // Look for the create/post link
          if (href.includes('create') || txt.toLowerCase() === 'post') {
            console.log(`    ✓ ${href} | text="${txt}"`)
            sel.newPostButton = href ? `a[href="${href}"]` : `a:has-text("${txt}")`
          }
        }

        // Also dump all spans with text "Post"
        const spans = await page.$$('span, div')
        for (const sp of spans) {
          const vis = await sp.isVisible()
          if (!vis) continue
          const txt = (await sp.textContent() || '').trim()
          if (txt === 'Post') {
            const tag = await sp.evaluate(el => el.tagName)
            const cls = (await sp.getAttribute('class') || '').slice(0, 60)
            console.log(`    span/div "Post": ${tag} cls="${cls}"`)
          }
        }
      }
    }

    await shot(page, 'ig-after-nav')

    // Check for file upload
    sel.fileUploadInput = null
    for (const s of ['input[type="file"]', 'input[accept*="image"]']) {
      if (await page.$(s)) { sel.fileUploadInput = s; break }
    }
    console.log(`  fileUploadInput: ${sel.fileUploadInput}`)

    // Dump all visible buttons
    console.log('\n  All visible buttons:')
    const btns = await page.$$('button, [role="button"]')
    for (const btn of btns) {
      const vis = await btn.isVisible()
      if (!vis) continue
      const txt = (await btn.textContent() || '').trim().slice(0, 50)
      const label = await btn.getAttribute('aria-label') || ''
      if (txt || label) console.log(`    text="${txt}" label="${label}"`)
    }

  } catch (err) {
    console.log(`  ERROR: ${err.message}`)
    await shot(page, 'ig-error').catch(() => {})
  } finally {
    await ctx.close()
  }
  return sel
}

// ── Main ──────────────────────────────────────────────────────────────────────
;(async () => {
  const opts = getLaunchOptions()
  opts.headless = false
  opts.args = [...(opts.args || []), '--disable-features=AsyncDns']
  const browser = await chromium.launch(opts)

  try {
    const liSel = await probeLinkedIn(browser)
    const igSel = await probeInstagram(browser)

    console.log('\n━━━ Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('LinkedIn:', JSON.stringify(liSel, null, 2))
    console.log('Instagram:', JSON.stringify(igSel, null, 2))
  } finally {
    await browser.close()
  }
})()
