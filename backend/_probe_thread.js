require('dotenv').config()
const BrowserManager = require('./automation/core/BrowserManager')
const InstagramAutomation = require('./automation/platforms/instagram/InstagramAutomation')
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const cookieValue = process.env.INSTAGRAM_COOKIE.split('=').slice(1).join('=')
const threadUrl = process.argv[2]

;(async () => {
  const { context, page } = await BrowserManager.newContext(null)
  const ig = new InstagramAutomation(); ig.context = context; ig.page = page
  await ig._injectCookie({ cookieName: 'sessionid', cookieValue })

  await page.goto(threadUrl, { waitUntil: 'domcontentloaded' })
  await sleep(7000)

  const info = await page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const grid = q('div[role="grid"]')
    const main = q('main')
    const countIn = (el) => el ? el.querySelectorAll('[dir="auto"]').length : -1

    // What does an EMPTY thread actually render?
    return {
      url: location.href,
      hasGrid: !!grid,
      dirAutoInGrid: countIn(grid),
      dirAutoInMain: countIn(main),
      // Candidate message-row containers
      rowRoles: {
        row: document.querySelectorAll('div[role="row"]').length,
        listitem: document.querySelectorAll('div[role="listitem"]').length,
        gridcell: document.querySelectorAll('div[role="gridcell"]').length,
      },
      emptyStateText: (main?.innerText || '').slice(0, 300),
      // Presence of the "start of conversation" profile card
      hasProfileCard: /followers|Posts|View profile/i.test(main?.innerText || ''),
    }
  })
  console.log(JSON.stringify(info, null, 1))
  await page.screenshot({ path: '/tmp/leadgen_thread.png' })
  console.log('screenshot: /tmp/leadgen_thread.png')

  await BrowserManager.closeContext(context)
  process.exit(0)
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
