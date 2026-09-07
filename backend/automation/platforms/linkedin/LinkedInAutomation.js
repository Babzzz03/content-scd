const BasePlatform = require('../../core/BasePlatform')
const sel = require('./selectors')
const { createPost } = require('./workflows/createPost')
const { sleep, randInt } = require('../../utils/random')
const logger = require('../../../src/utils/logger')

class LinkedInAutomation extends BasePlatform {
  constructor() {
    super('linkedin')
  }

  async isLoggedIn() {
    try {
      await this.page.goto(sel.HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await this.page.waitForSelector(sel.feedContainer, { timeout: 25000 })
      return true
    } catch {
      return false
    }
  }

  async humanisePrePublish() {
    // Wait for feed to settle before interacting
    try {
      await sleep(randInt(1500, 3000))
      await this.human.scroll('down', randInt(200, 400))
      await sleep(randInt(1000, 2000))
      await this.human.scroll('up', randInt(100, 250))
      await sleep(randInt(800, 1500))
    } catch { /* non-critical */ }
  }

  async publish(payload) {
    return createPost(this.page, this.human, payload)
  }
}

module.exports = LinkedInAutomation
