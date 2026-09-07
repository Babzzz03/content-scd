/**
 * Human-behaviour randomisation utilities.
 *
 * All delays and positions use distributions that approximate real human
 * input patterns rather than uniform random values.
 */

/** Gaussian random number (Box-Muller transform) */
const gaussian = (mean, stdDev) => {
  let u, v
  do { u = Math.random() } while (u === 0)
  do { v = Math.random() } while (v === 0)
  return mean + stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

/** Random integer in [min, max] */
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

/** Random float in [min, max] */
const randFloat = (min, max) => Math.random() * (max - min) + min

/**
 * Human-like typing delay (ms per character).
 * Most characters: 80-180ms, occasional pauses (300-600ms) to simulate thinking.
 */
const typingDelay = () => {
  if (Math.random() < 0.05) return randInt(300, 600)   // occasional pause
  return Math.round(Math.abs(gaussian(120, 30)))        // normal typing speed
}

/**
 * Action delay — used between clicks, scrolls, etc.
 * Reads env vars so the deployer can tune without code changes.
 */
const actionDelay = () => {
  const min = parseInt(process.env.AUTOMATION_DELAY_MIN || '800', 10)
  const max = parseInt(process.env.AUTOMATION_DELAY_MAX || '3500', 10)
  return randInt(min, max)
}

/** Short micro-delay (100-400ms) for small actions like focus */
const microDelay = () => randInt(100, 400)

/**
 * Generate a Bezier curve path between two points with slight jitter.
 * Returns an array of { x, y } waypoints.
 */
const bezierPath = (from, to, steps = 20) => {
  const cp1 = {
    x: from.x + (to.x - from.x) * 0.25 + randFloat(-50, 50),
    y: from.y + (to.y - from.y) * 0.25 + randFloat(-50, 50),
  }
  const cp2 = {
    x: from.x + (to.x - from.x) * 0.75 + randFloat(-50, 50),
    y: from.y + (to.y - from.y) * 0.75 + randFloat(-50, 50),
  }
  const points = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const u = 1 - t
    points.push({
      x: Math.round(u ** 3 * from.x + 3 * u ** 2 * t * cp1.x + 3 * u * t ** 2 * cp2.x + t ** 3 * to.x),
      y: Math.round(u ** 3 * from.y + 3 * u ** 2 * t * cp1.y + 3 * u * t ** 2 * cp2.y + t ** 3 * to.y),
    })
  }
  return points
}

/** Pick a random element from an array */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

/** Sleep helper */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

module.exports = { gaussian, randInt, randFloat, typingDelay, actionDelay, microDelay, bezierPath, pick, sleep }
