const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { unauthorized } = require('../utils/apiResponse')

/**
 * Verifies the Bearer JWT in Authorization header.
 * Attaches req.user (full User document, no password).
 */
const authenticate = async (req, res, next) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return unauthorized(res, 'No token provided')
  }
  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(payload.id).select('-password -refreshTokenHash')
    if (!user || !user.isActive) return unauthorized(res, 'Account not found or inactive')
    req.user = user
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') return unauthorized(res, 'Token expired')
    return unauthorized(res, 'Invalid token')
  }
}

/**
 * Optional authentication — attaches req.user if a valid token is present,
 * but does not block the request if no token is found.
 */
const optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) return next()
  try {
    const token = header.slice(7)
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = await User.findById(payload.id).select('-password -refreshTokenHash')
  } catch {
    /* ignore invalid token in optional mode */
  }
  next()
}

module.exports = { authenticate, optionalAuth }
