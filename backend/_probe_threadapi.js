require('dotenv').config()
const BrowserManager = require('./automation/core/BrowserManager')
const InstagramAutomation = require('./automation/platforms/instagram/InstagramAutomation')
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const cookieValue = process.env.INSTAGRAM_COOKIE.split('=').slice(1).join('=')
const threadId = process.argv[2]

;(async () => {
  const { context, page } = await BrowserManager.newContext(null)
  const ig = new InstagramAutomation(); ig.context = context; ig.page = page
  await ig._injectCookie({ cookieName: 'sessionid', cookieValue })
  await page.goto('https://www.instagram.com/direct/inbox/', { waitUntil: 'domcontentloaded' })
  await sleep(5000)

  const call = (path) => page.evaluate(async (p) => {
    try {
      const res = await fetch('https://www.instagram.com' + p, {
        credentials: 'include',
        headers: { 'x-ig-app-id': '936619743392459', 'x-requested-with': 'XMLHttpRequest', accept: 'application/json' },
      })
      const ct = res.headers.get('content-type') || ''
      if (!ct.includes('json')) return { __status: res.status, __nonJson: true }
      const j = await res.json()
      return { __status: res.status, body: j }
    } catch (e) { return { __err: e.message } }
  }, path)

  console.log('1. thread detail endpoint')
  const t = await call(`/api/v1/direct_v2/threads/${threadId}/?limit=20`)
  if (t.__nonJson) console.log('   non-JSON, status', t.__status)
  else if (t.__err) console.log('   err', t.__err)
  else {
    const th = t.body?.thread
    console.log('   status', t.__status)
    console.log('   thread present:', !!th)
    console.log('   items count:', Array.isArray(th?.items) ? th.items.length : 'n/a')
    console.log('   keys:', th ? Object.keys(th).slice(0,15).join(', ') : 'none')
  }

  await sleep(3000)
  console.log('\n2. inbox endpoint (does this empty thread appear at all?)')
  const inbox = await call('/api/v1/direct_v2/inbox/?thread_message_limit=5&limit=25')
  if (inbox.body?.inbox) {
    const threads = inbox.body.inbox.threads || []
    console.log('   total threads in inbox:', threads.length)
    console.log('   our thread present:', threads.some(x => String(x.thread_id) === String(threadId)))
  } else console.log('   status', inbox.__status, 'nonJson', !!inbox.__nonJson)

  await BrowserManager.closeContext(context)
  process.exit(0)
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
