const BasePlatform = require('../../core/BasePlatform')
const sel = require('./selectors')
const { createPost } = require('./workflows/createPost')
const { engageWithPosts } = require('./workflows/createComment')
const { discoverLeads } = require('./workflows/discoverLeads')
const { sendDm } = require('./workflows/sendDm')
const { checkDmReplies } = require('./workflows/checkDmReplies')
const { sleep, randInt } = require('../../utils/random')
const logger = require('../../../src/utils/logger')

class InstagramAutomation extends BasePlatform {
  constructor() {
    super('instagram')
  }

  async isLoggedIn() {
    try {
      await this.page.goto(sel.HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await sleep(randInt(1500, 2500))

      // A checkpoint must be told apart from an expired cookie. They look
      // similar (neither reaches the feed) but the remedies are opposite:
      // a dead cookie wants a new cookie, a checkpoint wants a human to verify
      // and any further automation makes it worse.
      const checkpoint = await this.page.evaluate(() => {
        const text = document.body?.innerText || ''
        return /confirm that it'?s you|We need to confirm|Help us confirm|suspended your account|challenge_required/i.test(text)
          || location.pathname.includes('/challenge')
          || location.pathname.includes('/accounts/suspended')
      }).catch(() => false)

      if (checkpoint) {
        logger.error('instagram: CHECKPOINT — Instagram is asking the account to verify identity')
        const err = new Error(
          'Instagram checkpoint: this account must confirm its identity before it can be used. '
          + 'Open Instagram in a browser, complete the verification, then reconnect with a fresh cookie. '
          + 'Automation is halted for this account.'
        )
        err.code = 'CHECKPOINT'
        throw err
      }

      // Logged in if we see the nav/sidebar; not logged in if login form appears
      const result = await Promise.race([
        this.page.waitForSelector('input[name="username"]', { timeout: 10000 }).then(() => 'login'),
        this.page.waitForSelector('svg[aria-label="Home"], svg[aria-label="New post"], span:has-text("Create")', { timeout: 10000 }).then(() => 'home'),
      ])
      return result === 'home'
    } catch (err) {
      if (err.code === 'CHECKPOINT') throw err
      return false
    }
  }

  async humanisePrePublish() {
    // Brief pause on home feed before creating post
    try {
      await this.human.scroll('down', randInt(300, 600))
      await sleep(randInt(2000, 4000))
      await this.human.scroll('up', randInt(150, 350))
      await sleep(randInt(1000, 2000))
    } catch { /* non-critical */ }
  }

  async publish(payload) {
    // Lead-generation tasks share the authenticated session but are not posts
    switch (payload.task) {
      case 'discover-leads': return discoverLeads(this.page, payload)
      case 'send-dm':        return sendDm(this.page, this.human, payload)
      case 'check-replies':  return checkDmReplies(this.page, payload)
    }

    if (payload.postType === 'engage') {
      return engageWithPosts(this.page, payload)
    }
    return createPost(this.page, this.human, payload)
  }
}

module.exports = InstagramAutomation
