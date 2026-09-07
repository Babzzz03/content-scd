const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const User = require('../models/User')
const logger = require('../utils/logger')

// ─── Token helpers ────────────────────────────────────────────────────────────

const signAccessToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  })

const signRefreshToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
  })

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex')

// ─── Service methods ──────────────────────────────────────────────────────────

const register = async ({ name, email, password }) => {
  const existing = await User.findOne({ email: email.toLowerCase() })
  if (existing) throw Object.assign(new Error('Email already registered'), { statusCode: 409 })

  const user = await User.create({ name, email, password })
  logger.info('New user registered', { userId: user._id, email: user.email })

  const accessToken = signAccessToken(user._id)
  const refreshToken = signRefreshToken(user._id)
  user.refreshTokenHash = hashToken(refreshToken)
  await user.save()

  return { user, accessToken, refreshToken }
}

const login = async ({ email, password }) => {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password +refreshTokenHash')
  if (!user || !user.isActive) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 })

  const valid = await user.comparePassword(password)
  if (!valid) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 })

  user.lastLoginAt = new Date()
  const accessToken = signAccessToken(user._id)
  const refreshToken = signRefreshToken(user._id)
  user.refreshTokenHash = hashToken(refreshToken)
  await user.save()

  // Strip sensitive fields
  const userObj = user.toJSON()

  return { user: userObj, accessToken, refreshToken }
}

const refreshTokens = async (refreshToken) => {
  let payload
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)
  } catch {
    throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 })
  }

  const user = await User.findById(payload.id).select('+refreshTokenHash')
  if (!user || !user.isActive) throw Object.assign(new Error('User not found'), { statusCode: 401 })
  if (user.refreshTokenHash !== hashToken(refreshToken)) {
    throw Object.assign(new Error('Refresh token reuse detected — please log in again'), { statusCode: 401 })
  }

  const newAccessToken = signAccessToken(user._id)
  const newRefreshToken = signRefreshToken(user._id)
  user.refreshTokenHash = hashToken(newRefreshToken)
  await user.save()

  return { accessToken: newAccessToken, refreshToken: newRefreshToken }
}

const logout = async (userId) => {
  await User.findByIdAndUpdate(userId, { refreshTokenHash: null })
}

module.exports = { register, login, refreshTokens, logout }
