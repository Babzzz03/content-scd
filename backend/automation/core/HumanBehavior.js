/**
 * HumanBehavior
 *
 * Wraps Playwright page interactions with human-like delays, mouse movements,
 * and typing patterns to reduce automation fingerprinting risk.
 *
 * Every public method is async and should be awaited.
 */
const { typingDelay, actionDelay, microDelay, bezierPath, sleep, randInt } = require('../utils/random')

class HumanBehavior {
  constructor(page) {
    this.page = page
  }

  /**
   * Move mouse from current position to the target element using a Bezier curve.
   */
  async moveTo(selector) {
    const el = await this.page.$(selector)
    if (!el) return
    const box = await el.boundingBox()
    if (!box) return

    // Target a slightly random point within the element
    const target = {
      x: box.x + box.width  * (0.2 + Math.random() * 0.6),
      y: box.y + box.height * (0.2 + Math.random() * 0.6),
    }
    const current = await this.page.evaluate(() => ({ x: window.mouseX || 100, y: window.mouseY || 100 }))
    const path = bezierPath(current, target)

    for (const point of path) {
      await this.page.mouse.move(point.x, point.y)
      await sleep(randInt(2, 8))
    }
  }

  /**
   * Click an element with a human-like mouse approach and randomised timing.
   */
  async click(selector, options = {}) {
    await this.moveTo(selector)
    await sleep(microDelay())
    await this.page.click(selector, {
      delay: randInt(80, 180),
      ...options,
    })
    await sleep(microDelay())
  }

  /**
   * Type text character by character with realistic per-key delays.
   * Occasionally makes a typo and corrects it (if enabled).
   */
  async type(selector, text, { typos = true } = {}) {
    await this.click(selector)
    await sleep(microDelay())

    for (let i = 0; i < text.length; i++) {
      // Simulate occasional typo + correction
      if (typos && Math.random() < 0.02 && i > 0) {
        const wrongChar = String.fromCharCode(text.charCodeAt(i) + (Math.random() > 0.5 ? 1 : -1))
        await this.page.keyboard.type(wrongChar, { delay: typingDelay() })
        await sleep(randInt(200, 500))
        await this.page.keyboard.press('Backspace')
        await sleep(randInt(100, 300))
      }
      await this.page.keyboard.type(text[i], { delay: typingDelay() })
    }
    await sleep(microDelay())
  }

  /**
   * Fill an input by clicking, clearing, then typing.
   */
  async fill(selector, text) {
    await this.click(selector)
    await sleep(microDelay())
    // Select all and clear existing content
    await this.page.keyboard.press('Control+a')
    await sleep(randInt(50, 150))
    await this.page.keyboard.press('Delete')
    await sleep(microDelay())
    await this.type(selector, text)
  }

  /**
   * Scroll the page gradually, simulating a human reading.
   */
  async scroll(direction = 'down', amount = 300) {
    const steps = randInt(3, 7)
    const delta = direction === 'down' ? amount : -amount
    for (let i = 0; i < steps; i++) {
      await this.page.mouse.wheel(0, delta / steps)
      await sleep(randInt(50, 200))
    }
    await sleep(microDelay())
  }

  /**
   * Wait for a selector with a human-style pause after it appears.
   */
  async waitFor(selector, options = {}) {
    await this.page.waitForSelector(selector, { timeout: 30000, ...options })
    await sleep(microDelay())
  }

  /**
   * Navigate to a URL with a post-load settle delay.
   */
  async goto(url) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await sleep(actionDelay())
  }

  /**
   * Wait for navigation to settle after a click that triggers a redirect.
   */
  async waitForNav(options = {}) {
    await this.page.waitForLoadState('networkidle', { timeout: 30000, ...options })
    await sleep(actionDelay())
  }

  /**
   * Press Enter with a human delay.
   */
  async pressEnter() {
    await sleep(microDelay())
    await this.page.keyboard.press('Enter')
    await sleep(actionDelay())
  }
}

module.exports = HumanBehavior
