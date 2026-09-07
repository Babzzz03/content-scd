const { validationResult } = require('express-validator')
const { badRequest } = require('../utils/apiResponse')

/**
 * Run after express-validator chains.
 * Returns 400 with field-level details if validation failed.
 */
const handleValidation = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return badRequest(res, 'Validation failed', errors.array().map((e) => ({
      field: e.path,
      message: e.msg,
    })))
  }
  next()
}

module.exports = { handleValidation }
