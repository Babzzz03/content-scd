/**
 * Browser launch configuration.
 *
 * Using headed mode (headless: false) by default because it is significantly
 * harder for platforms to fingerprint as automation. Set BROWSER_HEADLESS=true
 * only in a server environment where you trust the platform won't flag the account.
 *
 * viewport, userAgent, and locale are randomised per session by BrowserManager.
 */

const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 1280, height: 800 },
  { width: 1536, height: 864 },
]

// Real user agents from common Chrome versions
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
]

const LOCALES = ['en-US', 'en-GB', 'en-CA', 'en-AU']

const os = require('os')
const fs = require('fs')

// Candidate executable paths — first one found wins
const CHROME_CANDIDATES = [
  process.env.CHROME_EXECUTABLE_PATH,                                           // explicit override
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',               // macOS system Chrome
  '/Applications/Chromium.app/Contents/MacOS/Chromium',                         // macOS Chromium
  `${os.homedir()}/Library/Caches/ms-playwright/chromium-1217/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`, // Playwright CfT (macOS)
  '/usr/bin/google-chrome',                                                      // Linux
  '/usr/bin/google-chrome-stable',                                               // Linux (stable)
  '/usr/bin/chromium-browser',                                                   // Linux Chromium
  '/usr/bin/chromium',                                                           // Linux Chromium alt
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',                  // Windows
]

const getExecutablePath = () => {
  for (const p of CHROME_CANDIDATES) {
    if (p && fs.existsSync(p)) return p
  }
  return undefined  // fall back to Playwright's bundled binary (if installed)
}

const getLaunchOptions = () => {
  const headless = process.env.BROWSER_HEADLESS === 'true'
  const proxy = process.env.PROXY_URL || null
  const executablePath = getExecutablePath()

  const opts = {
    headless,
    executablePath,          // undefined = use Playwright's bundled binary
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    slowMo: 0,
  }

  if (proxy) {
    opts.proxy = { server: proxy }
  }

  return opts
}

const getContextOptions = () => {
  const { pick } = require('../utils/random')
  const viewport = pick(VIEWPORTS)
  const userAgent = pick(USER_AGENTS)
  const locale = pick(LOCALES)

  return {
    viewport,
    userAgent,
    locale,
    timezoneId: 'America/New_York',
    permissions: ['notifications'],
    colorScheme: 'light',
    // Accept cookies consent dialogs
    extraHTTPHeaders: { 'Accept-Language': locale },
  }
}

module.exports = { getLaunchOptions, getContextOptions, USER_AGENTS, VIEWPORTS }
