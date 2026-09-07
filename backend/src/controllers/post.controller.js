const Post = require('../models/Post')
const { publishPost } = require('../services/posting.service')
const { ok, created, notFound, badRequest } = require('../utils/apiResponse')
const { isValidPlatform } = require('../utils/helpers')
const { cloudinary } = require('../middleware/upload.middleware')

// ── List posts ────────────────────────────────────────────────────────────────

const listPosts = async (req, res) => {
  const { platform, status, page = 1, limit = 20 } = req.query
  const filter = { user: req.user._id }
  if (platform && isValidPlatform(platform)) filter.platform = platform
  if (status) filter.status = status

  const total = await Post.countDocuments(filter)
  const posts = await Post.find(filter)
    .sort({ scheduledAt: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean()

  ok(res, { posts, total, page: Number(page), pages: Math.ceil(total / limit) })
}

// ── Create post ───────────────────────────────────────────────────────────────

const createPost = async (req, res) => {
  const { platform, content, postType, scheduledAt, platformAccountId } = req.body

  if (!isValidPlatform(platform)) return badRequest(res, 'Invalid platform')
  if (!content || !content.trim()) return badRequest(res, 'Post content is required')

  // FormData sends JSON-encoded arrays as strings — parse them
  const parseJsonField = (val) => {
    if (!val) return []
    if (Array.isArray(val)) return val
    try { return JSON.parse(val) } catch { return [] }
  }

  const hashtags = parseJsonField(req.body.hashtags)
  const threadParts = parseJsonField(req.body.threadParts)

  // Cloudinary returns the secure URL in f.path (set by multer-storage-cloudinary)
  const mediaUrls = (req.files || []).map((f) => f.path)

  // Honour explicit status from body; fall back to scheduledAt heuristic
  const explicitStatus = req.body.status
  const validStatuses = ['draft', 'scheduled', 'publishing', 'published', 'failed']
  const status = validStatuses.includes(explicitStatus)
    ? explicitStatus
    : (scheduledAt ? 'scheduled' : 'draft')

  const post = await Post.create({
    user: req.user._id,
    platform,
    platformAccountId,
    content: content.trim(),
    hashtags,
    mediaUrls,
    postType: postType || 'standard',
    threadParts,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    status,
    generatedBy: req.body.generatedBy || 'user',
  })

  // Increment usage counter
  req.user.usage.postsThisMonth += 1
  await req.user.save()

  created(res, { post }, `Post ${status === 'scheduled' ? 'scheduled' : 'saved as draft'}`)
}

// ── Get one post ──────────────────────────────────────────────────────────────

const getPost = async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, user: req.user._id })
  if (!post) return notFound(res, 'Post not found')
  ok(res, { post })
}

// ── Update post ───────────────────────────────────────────────────────────────

const updatePost = async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, user: req.user._id })
  if (!post) return notFound(res, 'Post not found')
  if (['published', 'publishing'].includes(post.status)) {
    return badRequest(res, 'Cannot edit a published post')
  }

  const allowed = ['content', 'hashtags', 'scheduledAt', 'status', 'postType', 'threadParts', 'platformAccountId']
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) post[field] = req.body[field]
  })
  if (req.body.scheduledAt) post.scheduledAt = new Date(req.body.scheduledAt)

  await post.save()
  ok(res, { post }, 'Post updated')
}

// ── Delete post ───────────────────────────────────────────────────────────────

const deletePost = async (req, res) => {
  const post = await Post.findOneAndDelete({ _id: req.params.id, user: req.user._id })
  if (!post) return notFound(res, 'Post not found')

  // Clean up Cloudinary assets (fire-and-forget)
  if (post.mediaUrls?.length) {
    post.mediaUrls.forEach((url) => {
      // Extract public_id from the Cloudinary URL
      const match = url.match(/\/postflow\/uploads\/(.+?)(?:\.[^.]+)?$/)
      if (match) {
        const publicId = `postflow/uploads/${match[1]}`
        cloudinary.uploader.destroy(publicId).catch(() => {})
      }
    })
  }

  ok(res, {}, 'Post deleted')
}

// ── Publish now ───────────────────────────────────────────────────────────────

const publishNow = async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, user: req.user._id })
  if (!post) return notFound(res, 'Post not found')
  if (post.status === 'published') return badRequest(res, 'Post is already published')

  const { getAgenda } = require('../jobs/agenda')
  await getAgenda().now('publish-post', { postId: post._id })
  ok(res, { message: 'Publishing queued' }, 'Publishing in progress')
}

// ── Engage (reply to top posts on a topic via Playwright) ─────────────────────

const engageNow = async (req, res) => {
  const { platform, platformAccountId, topic, replyText, repeatCount = 1, tone, delayBetween, targetType } = req.body
  if (!platform || !topic || !replyText) return badRequest(res, 'platform, topic and replyText are required')

  const PlatformAccount = require('../models/PlatformAccount')
  const account = await PlatformAccount.findOne({ _id: platformAccountId, user: req.user._id }).select('+encryptedCredentials')
  if (!account) return notFound(res, 'Platform account not found')

  const { decryptObject } = require('../services/encryption.service')
  let cookie
  try {
    cookie = decryptObject(account.encryptedCredentials)
  } catch {
    return badRequest(res, 'No session cookie found — reconnect your account in Settings')
  }
  if (!cookie) return badRequest(res, 'No session cookie found — reconnect your account in Settings')

  const path = require('path')
  const sessionsDir = path.resolve(process.env.SESSIONS_DIR || './automation/sessions')

  const BrandVoice = require('../models/BrandVoice')
  const brandVoiceDoc = await BrandVoice.findOne({ user: req.user._id }).lean()
  const niche = brandVoiceDoc?.industry || brandVoiceDoc?.targetAudience || topic

  const { getAgenda } = require('../jobs/agenda')
  await getAgenda().now('engage', {
    platform,
    cookie,
    username: account.username,
    sessionFile: account.sessionFile ? path.resolve(sessionsDir, account.sessionFile) : null,
    postType: 'engage',
    targetType: targetType || 'topic',
    topic,
    niche,
    content: replyText,
    tone,
    repeatCount: Math.min(Number(repeatCount), 10),
    delayBetween: delayBetween ? Number(delayBetween) : 5000,
  })

  ok(res, { message: 'Engagement queued', repeatCount })
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

const getStats = async (req, res) => {
  const userId = req.user._id
  const [scheduled, drafts, published] = await Promise.all([
    Post.countDocuments({ user: userId, status: 'scheduled' }),
    Post.countDocuments({ user: userId, status: 'draft' }),
    Post.countDocuments({ user: userId, status: 'published' }),
  ])
  ok(res, { scheduled, drafts, published, total: scheduled + drafts + published })
}

module.exports = { listPosts, createPost, getPost, updatePost, deletePost, publishNow, engageNow, getStats }
