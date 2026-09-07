/**
 * PostingService
 *
 * Orchestrates publishing a Post document through the automation layer.
 * Called by the scheduler job and the "publish now" API endpoint.
 *
 * Media handling:
 *   Posts may have Cloudinary URLs in mediaUrls[]. The automation layer
 *   needs local file paths. We download to a temp dir before posting,
 *   then delete the temp files afterwards.
 */
const fs   = require('fs')
const os   = require('os')
const path = require('path')
const https = require('https')
const http  = require('http')

const Post            = require('../models/Post')
const PlatformAccount = require('../models/PlatformAccount')
const { decryptObject } = require('./encryption.service')
const AutomationHub   = require('../../automation')
const logger          = require('../utils/logger')
const { AUTOMATION }  = require('../config/constants')

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Download a URL to a temp file. Returns the local path. */
const downloadToTemp = (url) =>
  new Promise((resolve, reject) => {
    const ext  = (url.split('?')[0].match(/\.(\w+)$/) || [, 'jpg'])[1]
    const dest = path.join(os.tmpdir(), `pf_media_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`)
    const file = fs.createWriteStream(dest)
    const get  = url.startsWith('https') ? https.get : http.get

    get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close()
        fs.unlink(dest, () => {})
        return downloadToTemp(res.headers.location).then(resolve).catch(reject)
      }
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve(dest)))
    }).on('error', (err) => {
      fs.unlink(dest, () => {})
      reject(err)
    })
  })

/** Download all URLs (skips already-local paths). Returns temp paths + cleanup fn. */
const resolveMediaUrls = async (urls) => {
  if (!urls || urls.length === 0) return { localPaths: [], cleanup: () => {} }

  const tempFiles = []
  const localPaths = await Promise.all(
    urls.map(async (u) => {
      if (!u.startsWith('http://') && !u.startsWith('https://')) return u  // already local
      const local = await downloadToTemp(u)
      tempFiles.push(local)
      return local
    })
  )

  const cleanup = () => {
    for (const f of tempFiles) {
      try { fs.unlinkSync(f) } catch { /* ignore */ }
    }
  }

  return { localPaths, cleanup }
}

// ─── Main publish ─────────────────────────────────────────────────────────────

const publishPost = async (postId) => {
  const post = await Post.findById(postId)
  if (!post) throw new Error(`Post ${postId} not found`)
  if (!['scheduled', 'draft'].includes(post.status)) {
    logger.warn('publishPost called on non-publishable post', { postId, status: post.status })
    return
  }

  post.status = 'publishing'
  post.automationAttempts += 1
  await post.save()

  const account = await PlatformAccount.findOne({
    _id: post.platformAccountId,
    user: post.user,
    platform: post.platform,
    isActive: true,
  }).select('+encryptedCredentials')

  if (!account) return markFailed(post, 'No active platform account found for this post')

  let cookie
  try {
    cookie = decryptObject(account.encryptedCredentials)
  } catch (err) {
    return markFailed(post, `Failed to decrypt cookie: ${err.message}`)
  }

  const sessionsDir = path.resolve(process.env.SESSIONS_DIR || './automation/sessions')

  // Download Cloudinary media to temp files so Playwright can setInputFiles()
  const { localPaths: mediaUrls, cleanup } = await resolveMediaUrls(post.mediaUrls || [])

  const payload = {
    platform:    post.platform,
    cookie,
    username:    account.username,
    sessionFile: account.sessionFile
      ? path.resolve(sessionsDir, account.sessionFile)
      : null,
    content:     post.content,
    hashtags:    post.hashtags || [],
    mediaUrls,
    postType:    post.postType,
    threadParts: post.threadParts || [],
    dailyPostCount: account.dailyPostCount || 0,
  }

  try {
    const result = await AutomationHub.publish(payload)

    post.status      = 'published'
    post.publishedAt = new Date()
    post.platformPostId = result.postId || null

    if (result.sessionFile) {
      account.sessionFile = path.relative(sessionsDir, result.sessionFile)
    }
    account.lastUsedAt    = new Date()
    account.dailyPostCount = (account.dailyPostCount || 0) + 1
    account.lastError     = null
    await account.save()
    await post.save()

    logger.info('Post published', { postId, platform: post.platform })
  } catch (err) {
    logger.error('Automation failed', { postId, err: err.message })
    account.lastError = err.message
    await account.save()

    if (post.automationAttempts >= AUTOMATION.maxRetries) {
      return markFailed(post, err.message)
    }
    post.status = 'scheduled'
    await post.save()
    throw err
  } finally {
    cleanup()
  }
}

const markFailed = async (post, reason) => {
  post.status = 'failed'
  post.automationError = reason
  await post.save()
  logger.error('Post permanently failed', { postId: post._id, reason })
}

module.exports = { publishPost }
