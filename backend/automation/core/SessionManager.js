/**
 * SessionManager
 *
 * Persists and loads browser storage state (cookies + localStorage) per account.
 * Reusing sessions means we don't log in on every post — a key anti-detection measure.
 */
const fs = require('fs')
const path = require('path')
const logger = require('../../src/utils/logger')

const SESSIONS_DIR = path.resolve(process.env.SESSIONS_DIR || './automation/sessions')

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
}

const sessionPath = (filename) => path.join(SESSIONS_DIR, filename)

/**
 * Save browser context state to disk.
 * @param {import('playwright').BrowserContext} context
 * @param {string} filename - e.g. 'x_myhandle.json'
 */
const save = async (context, filename) => {
  try {
    const state = await context.storageState()
    fs.writeFileSync(sessionPath(filename), JSON.stringify(state, null, 2), 'utf8')
    logger.debug('Session saved', { filename })
    return sessionPath(filename)
  } catch (err) {
    logger.warn('Failed to save session', { filename, err: err.message })
  }
}

/**
 * Load a saved session file path if it exists, otherwise return null.
 * Playwright accepts storageState as a file path or object.
 */
const load = (filename) => {
  if (!filename) return null
  const fp = sessionPath(filename)
  if (!fs.existsSync(fp)) return null
  return fp   // pass directly to context.storageState
}

/**
 * Delete a session file (used when credentials change or account gets flagged).
 */
const remove = (filename) => {
  if (!filename) return
  const fp = sessionPath(filename)
  if (fs.existsSync(fp)) {
    fs.unlinkSync(fp)
    logger.info('Session file deleted', { filename })
  }
}

/**
 * Generate a normalised session filename for a platform+username combo.
 */
const buildFilename = (platform, username) =>
  `${platform}_${username.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`

module.exports = { save, load, remove, buildFilename, SESSIONS_DIR }
