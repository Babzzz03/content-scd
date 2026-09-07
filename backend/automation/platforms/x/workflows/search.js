const { sleep, randInt } = require('../../../utils/random')
const logger = require('../../../../src/utils/logger')

/**
 * Search X and return the top tweet texts.
 * payload.query — search string
 * payload.limit — max results to return (default 5)
 * payload.tab   — 'top' | 'latest' (default 'top')
 */
const search = async (page, { query, limit = 5, tab = 'top' }) => {
  const f = tab === 'latest' ? 'live' : 'top'
  const url = `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=${f}`

  logger.info('X: searching', { query, tab })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('article[role="article"]', { timeout: 20000 })
  await sleep(randInt(2000, 3000))

  // Scrape tweet text from visible articles
  const results = await page.evaluate((max) => {
    const articles = Array.from(document.querySelectorAll('article[role="article"]')).slice(0, max)
    return articles.map(a => {
      const textEl = a.querySelector('div[lang]')
      const authorEl = a.querySelector('div[data-testid="User-Name"]')
      const linkEl = a.querySelector('a[href*="/status/"]')
      return {
        text:   textEl?.innerText?.trim() ?? '',
        author: authorEl?.innerText?.trim()?.split('\n')[0] ?? '',
        url:    linkEl ? 'https://x.com' + linkEl.getAttribute('href') : null,
      }
    }).filter(r => r.text)
  }, limit)

  logger.info(`X: search returned ${results.length} results`)
  return results
}

module.exports = { search }
