/**
 * Consistent API response envelope.
 * Success:  { success: true,  data: ..., message: '...' }
 * Error:    { success: false, error: '...', details?: [...] }
 */

const ok = (res, data = {}, message = 'Success', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data })

const created = (res, data = {}, message = 'Created') =>
  ok(res, data, message, 201)

const error = (res, message = 'An error occurred', statusCode = 500, details = null) => {
  const body = { success: false, error: message }
  if (details) body.details = details
  return res.status(statusCode).json(body)
}

const notFound = (res, message = 'Resource not found') =>
  error(res, message, 404)

const unauthorized = (res, message = 'Unauthorized') =>
  error(res, message, 401)

const forbidden = (res, message = 'Forbidden') =>
  error(res, message, 403)

const badRequest = (res, message = 'Bad request', details = null) =>
  error(res, message, 400, details)

module.exports = { ok, created, error, notFound, unauthorized, forbidden, badRequest }
