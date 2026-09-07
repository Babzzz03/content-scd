const BasePlatform = require('../../core/BasePlatform')
const sel = require('./selectors')
const logger = require('../../../src/utils/logger')
const { createPost } = require('./workflows/createPost')
const { createReply, replyToTopTweets } = require('./workflows/createReply')
const { search } = require('./workflows/search')
const { sleep, actionDelay } = require('../../utils/random')

class XAutomation extends BasePlatform {
  constructor() {
    super('x')
  }

  async isLoggedIn() {
    try {
      // Go straight to compose — X redirects to /login if the cookie is invalid
      await this.page.goto(sel.COMPOSE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
      const finalUrl = this.page.url()
      logger.debug('X: isLoggedIn check', { finalUrl })
      await this.page.waitForSelector('div[role="textbox"]', { timeout: 40000 })
      return true
    } catch (err) {
      await this.page.screenshot({ path: '/tmp/x-login-fail.png' }).catch(() => {})
      const bodyText = await this.page.locator('body').innerText().catch(() => '')
      logger.warn('X: isLoggedIn check failed', { url: this.page.url(), body: bodyText.slice(0, 300), err: err.message })
      return false
    }
  }

  // Skip the feed-scrolling pre-publish behaviour — we're already on compose
  async humanisePrePublish() {
    const { sleep, randInt } = require('../../utils/random')
    await sleep(randInt(800, 1500))
  }

  async publish(payload) {
    if (payload.postType === 'reply' && payload.replyToUrl) {
      return createReply(this.page, this.human, payload)
    }
    if (payload.postType === 'engage') {
      return replyToTopTweets(this.page, payload)
    }
    if (payload.postType === 'search') {
      return search(this.page, payload)
    }
    return createPost(this.page, this.human, payload)
  }
}

module.exports = XAutomation
