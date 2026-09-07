/**
 * Screenshot-based probe — takes snapshots at each step and dumps all
 * interactive elements to find the right selectors.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })

const { chromium } = require('playwright')
const { getLaunchOptions, getContextOptions } = require('../automation/config/browser.config')
const path = require('path')
const fs = require('fs')

const SHOTS_DIR = path.join(__dirname, 'screenshots')
if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR)

const COOKIES = {
  linkedin:  { name: 'li_at',    value: 'AQEDAT5haEwDuhi5AAABnVCIRAgAAAGebo8_bk0APRM70bSjsBsxArsjEtN1QEzm6hiR9FOjfPxRP1UR_JYdtf4FH5fh5BXkW3xo_YRdhhOo2EXf3EjSqeMHN6kEbsZjnoHq8uX303qAXlJa3sxBysMG', domain: '.linkedin.com' },
  instagram: { name: 'sessionid', value: '59667930826%3AeMqbJniskqxqYN%3A14%3AAYjpwusLzwkigcO5Q6_FIUKJ2mbWahMn1WYiWo3E-g', domain: '.instagram.com' },
}

async function injectCookie(ctx, c) {
  await ctx.addCookies([{ name: c.name, value: c.value, domain: c.domain, path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }])
}

async function shot(page, name) {
  const p = path.join(SHOTS_DIR, `${name}.png`)
  await page.screenshot({ path: p, fullPage: false })
  console.log(`  📸 ${p}`)
}

async function dumpContentEditable(page) {
  const items = await page.$$eval('[contenteditable]', els =>
    els.map(el => ({
      tag: el.tagName,
      role: el.getAttribute('role'),
      label: el.getAttribute('aria-label'),
      placeholder: el.getAttribute('data-placeholder') || el.getAttribute('placeholder'),
      cls: el.className.slice(0, 100),
      visible: el.offsetWidth > 0 && el.offsetHeight > 0,
    }))
  ).catch(() => [])
  if (items.length) {
    console.log(`  contenteditable elements (${items.length}):`)
    items.forEach(i => console.log(`    ${i.visible ? '👁 ' : '🙈 '}[${i.tag}] role=${i.role} label="${i.label}" placeholder="${i.placeholder}" cls="${i.cls}"`))
  }
}

async function dumpButtons(page, filterText) {
  const buttons = await page.$$eval('button, [role="button"]', (els, ft) =>
    els
      .filter(el => {
        const t = (el.textContent || '').trim().toLowerCase()
        const l = (el.getAttribute('aria-label') || '').toLowerCase()
        return !ft || t.includes(ft) || l.includes(ft)
      })
      .slice(0, 10)
      .map(el => ({
        tag: el.tagName,
        text: (el.textContent || '').trim().slice(0, 60),
        label: el.getAttribute('aria-label'),
        cls: el.className.slice(0, 80),
        visible: el.offsetWidth > 0 && el.offsetHeight > 0,
      })),
  filterText).catch(() => [])
  if (buttons.length) {
    console.log(`  buttons matching "${filterText}":`)
    buttons.forEach(b => console.log(`    ${b.visible ? '👁 ' : '🙈 '}[${b.tag}] text="${b.text}" label="${b.label}" cls="${b.cls}"`))
  }
}

async function probeLinkedIn(browser) {
  console.log('\n━━━ LinkedIn ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const ctx = await browser.newContext(getContextOptions())
  const page = await ctx.newPage()
  try {
    await injectCookie(ctx, COOKIES.linkedin)
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 40000 })
    await page.waitForTimeout(2000)
    await shot(page, 'li-1-feed')

    // Find and click share box
    const trigger = await page.$('div[aria-label*="Start a post"], div[aria-label*="start a post"]')
    if (!trigger) { console.log('  ✗ Share trigger not found'); return }

    console.log('  Clicking share box...')
    await trigger.click()
    await page.waitForTimeout(4000)
    await shot(page, 'li-2-composer-open')

    console.log('\n  After opening composer:')
    await dumpContentEditable(page)
    await dumpButtons(page, 'post')

    // Also dump all input/textarea
    const inputs = await page.$$eval('input, textarea', els =>
      els.map(el => ({
        tag: el.tagName, type: el.type, name: el.name,
        placeholder: el.placeholder, visible: el.offsetWidth > 0,
      }))
    ).catch(() => [])
    if (inputs.length) {
      console.log(`\n  inputs/textareas: ${inputs.filter(i=>i.visible).length} visible`)
      inputs.filter(i=>i.visible).forEach(i => console.log(`    ${i.tag} type=${i.type} name="${i.name}" placeholder="${i.placeholder}"`))
    }

    await page.keyboard.press('Escape')
  } catch (err) {
    console.log(`  ERROR: ${err.message}`)
    await shot(page, 'li-error').catch(()=>{})
  } finally {
    await ctx.close()
  }
}

async function probeInstagram(browser) {
  console.log('\n━━━ Instagram ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const ctx = await browser.newContext(getContextOptions())
  const page = await ctx.newPage()
  try {
    await injectCookie(ctx, COOKIES.instagram)
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 40000 })
    await page.waitForTimeout(2000)
    await shot(page, 'ig-1-home')

    // Dismiss notification popup
    const notNow = await page.$('button:has-text("Not Now"), button:has-text("Not now")')
    if (notNow) { await notNow.click(); await page.waitForTimeout(1000) }
    await shot(page, 'ig-2-after-dismiss')

    // Find new post button
    const newPostCandidates = [
      'svg[aria-label="New post"]',
      '[aria-label="New post"]',
      'a[href="/create/select/"]',
    ]
    let newPostEl = null
    for (const sel of newPostCandidates) {
      newPostEl = await page.$(sel)
      if (newPostEl) { console.log(`  newPost found: ${sel}`); break }
    }

    if (!newPostEl) {
      console.log('  New post button not found — dumping nav links:')
      const navLinks = await page.$$eval('nav a, [role="navigation"] a', els =>
        els.map(el => ({ href: el.href, label: el.getAttribute('aria-label'), text: el.textContent?.trim().slice(0,40) }))
      ).catch(() => [])
      navLinks.forEach(l => console.log(`    ${l.href} label="${l.label}" text="${l.text}"`))
      return
    }

    // Click the parent <a> to navigate to create flow
    const parentLink = await newPostEl.$('xpath=./ancestor::a[1]').catch(() => null)
    if (parentLink) {
      await parentLink.click()
    } else {
      await newPostEl.click()
    }
    await page.waitForTimeout(4000)
    await shot(page, 'ig-3-after-new-post')

    console.log('\n  After clicking new post:')
    await dumpButtons(page, 'select')
    await dumpButtons(page, 'computer')

    // Check for file input
    const fileInputs = await page.$$eval('input[type="file"]', els =>
      els.map(el => ({ accept: el.accept, visible: el.offsetWidth > 0, cls: el.className.slice(0,80) }))
    ).catch(() => [])
    console.log(`  file inputs: ${fileInputs.length}`, fileInputs)

    // Check all buttons visible
    const allBtns = await page.$$eval('button, [role="button"]', els =>
      els.filter(el => el.offsetWidth > 0).map(el => ({
        text: (el.textContent||'').trim().slice(0,50),
        label: el.getAttribute('aria-label'),
      }))
    ).catch(() => [])
    if (allBtns.length) {
      console.log(`  All visible buttons (${allBtns.length}):`)
      allBtns.forEach(b => console.log(`    text="${b.text}" label="${b.label}"`))
    }

    await page.keyboard.press('Escape')
    await page.waitForTimeout(1000)
    await shot(page, 'ig-4-final')
  } catch (err) {
    console.log(`  ERROR: ${err.message}`)
    await shot(page, 'ig-error').catch(()=>{})
  } finally {
    await ctx.close()
  }
}

;(async () => {
  const opts = getLaunchOptions()
  opts.headless = false
  // Disable Chrome's async DNS resolver → falls back to system resolver (fixes DNS_PROBE_STARTED)
  opts.args = [...(opts.args || []), '--disable-features=AsyncDns']
  const browser = await chromium.launch(opts)
  try {
    await probeLinkedIn(browser)
    await probeInstagram(browser)
  } finally {
    await browser.close()
  }
  console.log('\n━━━ Done. Check scripts/screenshots/ ━━━━━━━━━━━━━━━━━━━━━━━')
})()
