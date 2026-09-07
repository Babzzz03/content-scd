/**
 * Manual selector recording session.
 *
 * Opens a browser with your session cookies already injected.
 * You perform the actions manually (click, type, etc.) while this script
 * records every click target's selector in the console.
 *
 * Usage:
 *   node scripts/record-session.js linkedin
 *   node scripts/record-session.js instagram
 *   node scripts/record-session.js x
 *
 * After performing the post flow, press Ctrl+C.
 * Copy the console output and share it — selectors will be updated from it.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })

const { chromium } = require('playwright')
const { getLaunchOptions, getContextOptions } = require('../automation/config/browser.config')

const PLATFORM = process.argv[2] || 'linkedin'

const COOKIES = {
  linkedin:  { name: 'li_at',     value: 'AQEDAT5haEwE5gyUAAABnlJ3jZgAAAGedoQRmE4AB27crcZPf9EEuEQQCrZmsdiYqqMrhSFLxgbKu7Wyd5AyfQY9m-CczxA2QK9gQ9sSQPQurI88nG9kEkXajZ0C_H8aWdiq5UOjgyCHlzU7inMUwNuB', domain: '.linkedin.com' },
  instagram: { name: 'sessionid', value: '59667930826%3AeMqbJniskqxqYN%3A14%3AAYjpwusLzwkigcO5Q6_FIUKJ2mbWahMn1WYiWo3E-g', domain: '.instagram.com' },
  x:         { name: 'auth_token', value: '88e4230f37b7642b00af692a3c3de3893bda970c', domain: '.x.com' },
}

const URLS = {
  linkedin:  'https://www.linkedin.com/feed/',
  instagram: 'https://www.instagram.com/',
  x:         'https://x.com/home',
}

// Generates a unique CSS selector for any element
const SELECTOR_SCRIPT = `
window.__recordedActions = [];
document.addEventListener('click', (e) => {
  const el = e.target;
  if (!el) return;

  // Build selector chain
  const parts = [];
  const tag = el.tagName.toLowerCase();
  const testid = el.getAttribute('data-testid');
  const role = el.getAttribute('role');
  const ariaLabel = el.getAttribute('aria-label');
  const type = el.getAttribute('type');
  const name = el.getAttribute('name');
  const href = el.getAttribute('href');
  const text = (el.textContent || '').trim().slice(0, 50);

  let sel = tag;
  if (testid)   sel = \`[\${tag}][data-testid="\${testid}"]\`;
  else if (ariaLabel) sel = \`\${tag}[aria-label="\${ariaLabel}"]\`;
  else if (role) sel = \`\${tag}[role="\${role}"]\`;
  else if (name) sel = \`\${tag}[name="\${name}"]\`;
  else if (type && tag === 'input') sel = \`input[type="\${type}"]\`;
  else if (href) sel = \`\${tag}[href="\${href}"]\`;
  else if (text && (tag === 'button' || role === 'button')) sel = \`\${tag}:has-text("\${text.slice(0,30)}")\`;

  const info = {
    selector: sel,
    tag,
    text: text.slice(0, 60),
    testid,
    ariaLabel,
    role,
    href,
    classes: el.className.slice(0, 80),
  };
  window.__recordedActions.push(info);
  console.log('[CLICK]', JSON.stringify(info));
}, true);
`

;(async () => {
  const cookie = COOKIES[PLATFORM]
  if (!cookie) {
    console.error(`Unknown platform: ${PLATFORM}. Use: linkedin | instagram | x`)
    process.exit(1)
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`  Recording session for: ${PLATFORM.toUpperCase()}`)
  console.log(`  Browser will open. Perform the full post flow manually.`)
  console.log(`  Every click is logged below with its selector.`)
  console.log(`  Press Ctrl+C when done.`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

  const opts = getLaunchOptions()
  opts.headless = false
  if (PLATFORM === 'instagram') {
    opts.args = [...(opts.args || []), '--disable-features=AsyncDns']
  }

  // Instagram needs AsyncDns disabled to resolve on some local networks
  if (PLATFORM === 'instagram') {
    opts.args = [...(opts.args || []), '--disable-features=AsyncDns']
  }

  const browser = await chromium.launch(opts)
  const ctx = await browser.newContext(getContextOptions())

  // Inject cookie
  await ctx.addCookies([{
    name:     cookie.name,
    value:    cookie.value,
    domain:   cookie.domain,
    path:     '/',
    httpOnly: true,
    secure:   true,
    sameSite: 'Lax',
  }])

  const page = await ctx.newPage()

  // Inject click recorder into every page load
  await ctx.addInitScript(SELECTOR_SCRIPT)

  // Log console messages from the page
  page.on('console', msg => {
    if (msg.text().startsWith('[CLICK]')) {
      console.log(msg.text())
    }
  })

  // LinkedIn: go to root first, then feed — avoids redirect loop on fresh sessions
  if (PLATFORM === 'linkedin') {
    try {
      await page.goto('https://www.linkedin.com/', { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(2000)
      const url = page.url()
      if (url.includes('/login') || url.includes('/checkpoint')) {
        console.log('\n⚠️  LinkedIn cookie is expired or invalidated.')
        console.log('   Please get a fresh li_at cookie from linkedin.com → DevTools → Application → Cookies')
        console.log('   Then update COOKIES.linkedin.value in this script and re-run.\n')
      } else {
        await page.goto(URLS[PLATFORM], { waitUntil: 'domcontentloaded', timeout: 30000 })
      }
    } catch (err) {
      console.log(`\n⚠️  Navigation error: ${err.message}`)
      console.log('   If you see ERR_TOO_MANY_REDIRECTS, your li_at cookie needs refreshing.\n')
    }
  } else {
    await page.goto(URLS[PLATFORM], { waitUntil: 'domcontentloaded', timeout: 40000 })
  }

  console.log(`\nCurrent URL: ${page.url()}`)
  console.log('Perform the post flow now. All clicks are being recorded...\n')

  // Keep alive until Ctrl+C
  await new Promise(() => {})
})()
