#!/usr/bin/env node
/**
 * Automation Debugger
 *
 * Runs any platform workflow with full visibility: slow motion, live screenshots,
 * Playwright trace recording, and optional step-through pause points.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   node debug-automation.js --platform x --cookie <token> [options]
 *
 * ─── Options ─────────────────────────────────────────────────────────────────
 *
 *   --platform   x | instagram | linkedin          (required)
 *   --cookie     session cookie value              (required)
 *   --action     post | thread | reply | engage    (default: thread)
 *   --slowmo     ms delay between actions          (default: 800)
 *   --pause      open Playwright Inspector at each checkpoint
 *   --trace      record a trace → view with: npx playwright show-trace /tmp/automation-trace.zip
 *   --headless   run headless (not recommended for debugging)
 *
 * ─── Examples ────────────────────────────────────────────────────────────────
 *
 *   # Step-through debug in the Playwright Inspector:
 *   node debug-automation.js --platform x --cookie abc123 --pause
 *
 *   # Record a full trace for post-run inspection:
 *   node debug-automation.js --platform x --cookie abc123 --trace
 *
 *   # Slow motion thread test with screenshots:
 *   node debug-automation.js --platform x --cookie abc123 --action thread --slowmo 1200
 *
 *   # Instagram engagement debug:
 *   node debug-automation.js --platform instagram --cookie sessionid123 --action engage
 *
 *   # View last trace:
 *   npx playwright show-trace /tmp/automation-trace.zip
 */

require('dotenv').config()
const path    = require('path')
const fs      = require('fs')
const args    = require('minimist')(process.argv.slice(2), {
  string:  ['platform', 'cookie', 'action', 'slowmo'],
  boolean: ['pause', 'trace', 'headless', 'help'],
  default: { action: 'thread', slowmo: '800', headless: false },
  alias:   { p: 'platform', c: 'cookie', a: 'action', h: 'help' },
})

// ─── Colours ──────────────────────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m',
  gray:   '\x1b[90m',
}

const log  = (msg, color = C.reset) => console.log(`${color}${msg}${C.reset}`)
const info = (msg) => log(`  ${msg}`, C.cyan)
const ok   = (msg) => log(`  ✓ ${msg}`, C.green)
const warn = (msg) => log(`  ⚠ ${msg}`, C.yellow)
const err  = (msg) => log(`  ✗ ${msg}`, C.red)
const step = (msg) => log(`\n${C.bold}${C.blue}▶ ${msg}${C.reset}`)
const dim  = (msg) => log(`  ${msg}`, C.gray)

// ─── Help ─────────────────────────────────────────────────────────────────────

if (args.help || !args.platform || !args.cookie) {
  console.log(`
${C.bold}${C.cyan}Automation Debugger${C.reset}

${C.bold}Usage:${C.reset}
  node debug-automation.js --platform <platform> --cookie <value> [options]

${C.bold}Required:${C.reset}
  --platform, -p   x | instagram | linkedin
  --cookie,   -c   Session cookie value

${C.bold}Options:${C.reset}
  --action,   -a   post | thread | reply | engage  (default: thread)
  --slowmo         Ms delay between browser actions (default: 800)
  --pause          Open Playwright Inspector at checkpoints (step-through mode)
  --trace          Record trace → view with: npx playwright show-trace /tmp/automation-trace.zip
  --headless       Run headless (default: headed for debugging)
  --help,     -h   Show this help

${C.bold}Examples:${C.reset}
  ${C.gray}# Step-through debug${C.reset}
  node debug-automation.js --platform x --cookie abc123 --pause

  ${C.gray}# Record a trace for later inspection${C.reset}
  node debug-automation.js --platform x --cookie abc123 --trace

  ${C.gray}# Instagram engagement with slow motion${C.reset}
  node debug-automation.js --platform instagram --cookie xyz --action engage --slowmo 1500

  ${C.gray}# View last recorded trace${C.reset}
  npx playwright show-trace /tmp/automation-trace.zip
`)
  process.exit(args.help ? 0 : 1)
}

// ─── Validate ────────────────────────────────────────────────────────────────

const PLATFORMS  = ['x', 'instagram', 'linkedin']
const ACTIONS    = ['post', 'thread', 'reply', 'engage', 'search']
const TRACE_PATH = '/tmp/automation-trace.zip'
const SS_DIR     = '/tmp/automation-debug-screenshots'

if (!PLATFORMS.includes(args.platform)) {
  err(`Unknown platform: ${args.platform}. Use: ${PLATFORMS.join(' | ')}`)
  process.exit(1)
}
if (!ACTIONS.includes(args.action)) {
  err(`Unknown action: ${args.action}. Use: ${ACTIONS.join(' | ')}`)
  process.exit(1)
}

// ─── Screenshot directory ─────────────────────────────────────────────────────

if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true })
// Clean old screenshots from this dir
fs.readdirSync(SS_DIR).forEach(f => fs.unlinkSync(path.join(SS_DIR, f)))

// ─── Build test payload ───────────────────────────────────────────────────────

const ts = Date.now()

const SAMPLE_IMAGES = [
  '/Users/mac/Desktop/Screenshot 2026-05-26 at 03.30.56.png',
  '/Users/mac/Desktop/Screenshot 2026-05-23 at 15.08.35.png',
  '/Users/mac/Desktop/Screenshot 2026-05-13 at 22.32.40.png',
].filter(f => fs.existsSync(f))

const PAYLOADS = {
  x: {
    post: {
      content:   `[DEBUG] Single post test — ${ts}`,
      postType:  'post',
      hashtags:  [],
      mediaUrls: SAMPLE_IMAGES.slice(0, 1),
      threadParts: [],
    },
    thread: {
      content:    `[DEBUG] Thread 1/3 — ${ts}`,
      postType:   'thread',
      hashtags:   [],
      mediaUrls:  SAMPLE_IMAGES.slice(0, 3),
      threadParts: [
        `[DEBUG] Thread 1/3 — ${ts}`,
        '[DEBUG] Thread 2/3 — automated thread test',
        '[DEBUG] Thread 3/3 — final tweet',
      ],
    },
    reply: {
      content:     '[DEBUG] Test reply',
      postType:    'reply',
      replyToUrl:  'https://x.com/elonmusk',
      hashtags:    [],
      mediaUrls:   [],
      threadParts: [],
    },
    engage: {
      postType:  'engage',
      topic:     'technology',
      hashtags:  ['tech', 'AI'],
      mediaUrls: [],
      threadParts: [],
    },
  },
  instagram: {
    engage: {
      postType:   'engage',
      targetType: 'trending',
      topic:      'technology',
      niche:      'technology',
      hashtags:   [],
      mediaUrls:  [],
      threadParts: [],
    },
    post: {
      content:    `[DEBUG] Instagram post test — ${ts} #tech`,
      postType:   'post',
      hashtags:   ['tech', 'debug'],
      mediaUrls:  SAMPLE_IMAGES.slice(0, 1),
      threadParts: [],
    },
  },
  linkedin: {
    post: {
      content:    `[DEBUG] LinkedIn post test — ${ts}`,
      postType:   'post',
      hashtags:   [],
      mediaUrls:  [],
      threadParts: [],
    },
    engage: {
      postType:   'engage',
      topic:      'technology',
      hashtags:   [],
      mediaUrls:  [],
      threadParts: [],
    },
  },
}

const platformPayloads = PAYLOADS[args.platform]
if (!platformPayloads) {
  err(`No test payloads defined for platform: ${args.platform}`)
  process.exit(1)
}

const actionPayload = platformPayloads[args.action]
if (!actionPayload) {
  warn(`No test payload for ${args.platform}/${args.action}. Available: ${Object.keys(platformPayloads).join(', ')}`)
  process.exit(1)
}

// ─── Patch BrowserManager to inject debug settings ───────────────────────────

const slowmo  = parseInt(args.slowmo, 10) || 800
const BM      = require('./automation/core/BrowserManager')
const origGet = BM.getBrowser.bind(BM)

BM.getBrowser = async function () {
  if (this._browser && this._browser.isConnected()) return this._browser
  const { chromium } = require('playwright')

  const launchOpts = {
    headless: args.headless,
    slowMo:   slowmo,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  }

  if (args.pause) {
    // PWDEBUG=1 opens Playwright Inspector with step-through controls
    process.env.PWDEBUG = '1'
    info('Playwright Inspector will open — use the toolbar to step through actions')
  }

  this._browser = await chromium.launch(launchOpts)
  info(`Browser launched (slowMo: ${slowmo}ms, headless: ${args.headless})`)
  return this._browser
}

// Patch newContext to inject tracing
const origNewCtx = BM.newContext.bind(BM)
BM.newContext = async function (sessionFile = null) {
  const result = await origNewCtx(sessionFile)

  if (args.trace) {
    await result.context.tracing.start({
      screenshots: true,
      snapshots:   true,
      sources:     true,
    })
    info(`Trace recording started`)
  }

  // Wrap page to auto-screenshot on navigation and inject pause checkpoints
  const origGoto = result.page.goto.bind(result.page)
  let ssIndex = 0

  const screenshot = async (label) => {
    ssIndex++
    const file = path.join(SS_DIR, `${String(ssIndex).padStart(3, '0')}-${label.replace(/[^a-z0-9]/gi, '_')}.png`)
    await result.page.screenshot({ path: file, fullPage: false }).catch(() => {})
    dim(`  Screenshot saved: ${file}`)
  }

  result.page.goto = async (url, opts) => {
    const r = await origGoto(url, opts)
    await screenshot(`goto_${new URL(url).pathname.replace(/\//g, '-')}`)
    return r
  }

  // Expose pause helper for manual checkpoints (used when --pause)
  result.page.__debugPause = async (label) => {
    if (args.pause) {
      await screenshot(label)
      await result.page.pause()
    } else {
      await screenshot(label)
    }
  }

  return result
}

// Patch closeContext to stop tracing before closing
const origClose = BM.closeContext.bind(BM)
BM.closeContext = async function (context) {
  if (args.trace) {
    try {
      await context.tracing.stop({ path: TRACE_PATH })
      ok(`Trace saved: ${TRACE_PATH}`)
      info(`View it with: npx playwright show-trace ${TRACE_PATH}`)
    } catch (e) {
      warn(`Could not save trace: ${e.message}`)
    }
  }
  return origClose(context)
}

// ─── Run ──────────────────────────────────────────────────────────────────────

const AutomationHub = require('./automation')

;(async () => {
  console.log()
  log(`${C.bold}${C.cyan}╔══════════════════════════════════════════╗${C.reset}`)
  log(`${C.bold}${C.cyan}║     Automation Debugger                  ║${C.reset}`)
  log(`${C.bold}${C.cyan}╚══════════════════════════════════════════╝${C.reset}`)
  console.log()

  info(`Platform : ${C.bold}${args.platform}${C.reset}`)
  info(`Action   : ${C.bold}${args.action}${C.reset}`)
  info(`SlowMo   : ${slowmo}ms`)
  info(`Pause    : ${args.pause ? C.green + 'yes (Playwright Inspector)' + C.reset : 'no'}`)
  info(`Trace    : ${args.trace ? C.green + 'yes → ' + TRACE_PATH + C.reset : 'no'}`)
  info(`Headless : ${args.headless}`)
  info(`Screenshots: ${SS_DIR}/`)

  if (actionPayload.mediaUrls?.length) {
    info(`Media    : ${actionPayload.mediaUrls.length} image(s)`)
    actionPayload.mediaUrls.forEach(f => dim(`  ${fs.existsSync(f) ? '✓' : '✗ MISSING'} ${f}`))
  }

  const cookieName = args.platform === 'x'
    ? 'auth_token'
    : args.platform === 'instagram'
      ? 'sessionid'
      : 'li_at'

  step('Starting automation...')
  const startTime = Date.now()

  try {
    const result = await AutomationHub.publish({
      platform:       args.platform,
      cookie:         { cookieName, cookieValue: args.cookie },
      username:       'debug',
      sessionFile:    null,
      dailyPostCount: 0,
      ...actionPayload,
    })

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log()
    log(`${C.bold}${C.green}✓ SUCCESS${C.reset} — completed in ${elapsed}s`)
    if (result.postId) info(`Post ID: ${result.postId}`)

  } catch (e) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log()
    err(`FAILED after ${elapsed}s — ${e.message}`)
    if (process.env.DEBUG) console.error(e)
  }

  console.log()
  if (fs.readdirSync(SS_DIR).length > 0) {
    ok(`${fs.readdirSync(SS_DIR).length} screenshots saved in ${SS_DIR}/`)
  }
  if (args.trace && fs.existsSync(TRACE_PATH)) {
    ok(`Trace saved — run: npx playwright show-trace ${TRACE_PATH}`)
  }

  process.exit(0)
})()
