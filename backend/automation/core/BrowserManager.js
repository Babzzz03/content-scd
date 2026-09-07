/**
 * BrowserManager
 *
 * Manages a single Playwright browser instance (singleton per process).
 * Each automation run creates a fresh context with per-account session state.
 *
 * Stealth script injected into every page via addInitScript:
 *  - Removes navigator.webdriver flag
 *  - Fakes plugins array
 *  - Patches chrome object
 *  - Randomises canvas fingerprint slightly
 */
const { chromium } = require('playwright')
const { getLaunchOptions, getContextOptions } = require('../config/browser.config')
const SessionManager = require('./SessionManager')
const HumanBehavior = require('./HumanBehavior')
const logger = require('../../src/utils/logger')

// ─── Stealth script injected before every page load ──────────────────────────

const STEALTH_SCRIPT = `
// 1. Remove webdriver flag
Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true });

// 2. Fake plugins
Object.defineProperty(navigator, 'plugins', {
  get: () => {
    const arr = [
      { name: 'Chrome PDF Plugin',     filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer',     filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
      { name: 'Native Client',         filename: 'internal-nacl-plugin',  description: '' },
    ];
    arr.__proto__ = PluginArray.prototype;
    return arr;
  },
  configurable: true,
});

// 3. Fake languages
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'], configurable: true });

// 4. Patch chrome object (present in real Chrome, absent in headless)
if (!window.chrome) {
  window.chrome = {
    app: { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' } },
    runtime: {},
    loadTimes: function() {},
    csi: function() {},
  };
}

// 5. Permissions API — always return 'granted' for notifications
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) =>
  parameters.name === 'notifications'
    ? Promise.resolve({ state: Notification.permission, onchange: null })
    : originalQuery(parameters);

// 6. Canvas fingerprint randomisation (slight noise)
const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
CanvasRenderingContext2D.prototype.getImageData = function(x, y, w, h) {
  const imageData = origGetImageData.call(this, x, y, w, h);
  for (let i = 0; i < imageData.data.length; i += 100) {
    imageData.data[i] ^= Math.floor(Math.random() * 3);
  }
  return imageData;
};
`

// ─── BrowserManager singleton ─────────────────────────────────────────────────

class BrowserManager {
  constructor() {
    this._browser = null
  }

  async getBrowser() {
    if (this._browser && this._browser.isConnected()) return this._browser
    const opts = getLaunchOptions()
    this._browser = await chromium.launch(opts)
    logger.info('Browser launched', { headless: opts.headless })
    return this._browser
  }

  /**
   * Create a new browser context for a given account.
   * Loads saved session state if available.
   *
   * @param {string} sessionFile - path to saved session JSON (or null)
   * @returns {{ context, page, human, saveSession }}
   */
  async newContext(sessionFile = null) {
    const browser = await this.getBrowser()
    const ctxOpts = getContextOptions()

    // Load existing session if present
    const storedState = SessionManager.load(sessionFile)
    if (storedState) {
      ctxOpts.storageState = storedState
      logger.debug('Loaded existing session', { sessionFile })
    }

    const context = await browser.newContext(ctxOpts)

    // Inject stealth script into every page in this context
    await context.addInitScript(STEALTH_SCRIPT)

    // Block tracking pixels and analytics to speed up loading
    await context.route('**/{analytics,tracking,pixel,beacon}/**', (route) => route.abort())
    await context.route(/google-analytics|googletagmanager|facebook\.net\/tr/, (route) => route.abort())

    const page = await context.newPage()
    const human = new HumanBehavior(page)

    const saveSession = (filename) => SessionManager.save(context, filename)

    return { context, page, human, saveSession }
  }

  /**
   * Close a context cleanly.
   */
  async closeContext(context) {
    try {
      await context.close()
    } catch (err) {
      logger.warn('Error closing context', { err: err.message })
    }
  }

  async closeBrowser() {
    if (this._browser) {
      await this._browser.close()
      this._browser = null
    }
  }
}

// Export singleton
module.exports = new BrowserManager()
