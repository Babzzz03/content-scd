const Post = require('../models/Post')
const logger = require('../utils/logger')

/**
 * Reset "publishing" posts stuck from a previous crashed run.
 * Called once at startup before Agenda initializes.
 */
const recoverStuckPosts = async () => {
  // When DISABLE_AUTO_RETRY=true, mark stuck posts as failed instead of re-queuing them
  const retryDisabled = process.env.DISABLE_AUTO_RETRY === 'true'
  const newStatus = retryDisabled ? 'failed' : 'scheduled'
  const result = await Post.updateMany(
    { status: 'publishing' },
    { status: newStatus }
  )
  if (result.modifiedCount > 0) {
    logger.info(`Recovered ${result.modifiedCount} stuck "publishing" post(s) → marked as "${newStatus}"`)
  }
}

module.exports = { recoverStuckPosts }
