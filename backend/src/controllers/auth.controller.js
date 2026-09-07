const { body } = require('express-validator')
const authService = require('../services/auth.service')
const { ok, created, error: apiError } = require('../utils/apiResponse')

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
]

const loginValidation = [
  body('email').trim().isEmail().normalizeEmail(),
  body('password').notEmpty(),
]

const register = async (req, res) => {
  const { name, email, password } = req.body
  const { user, accessToken, refreshToken } = await authService.register({ name, email, password })
  created(res, { user, accessToken, refreshToken }, 'Account created successfully')
}

const login = async (req, res) => {
  const { email, password } = req.body
  const { user, accessToken, refreshToken } = await authService.login({ email, password })
  ok(res, { user, accessToken, refreshToken }, 'Login successful')
}

const refresh = async (req, res) => {
  const { refreshToken } = req.body
  if (!refreshToken) return apiError(res, 'Refresh token required', 400)
  const tokens = await authService.refreshTokens(refreshToken)
  ok(res, tokens, 'Token refreshed')
}

const logout = async (req, res) => {
  await authService.logout(req.user._id)
  ok(res, {}, 'Logged out successfully')
}

const me = async (req, res) => {
  ok(res, { user: req.user })
}

const updateProfile = async (req, res) => {
  const User = require('../models/User')
  const { name, avatarUrl } = req.body
  const updates = {}
  if (name) updates.name = name.trim()
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl
  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true })
  ok(res, { user }, 'Profile updated')
}

module.exports = { register, login, refresh, logout, me, updateProfile, registerValidation, loginValidation }
