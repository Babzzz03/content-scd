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

/**
 * Reset campaigns left mid-flight by a crash, restart, or pause.
 *
 * Progress phase is only moved to a terminal state on the success and error
 * paths, so an interrupted run leaves it reading "collecting" forever and the
 * UI spins on a campaign that stopped days ago. Posts already had this
 * recovery; campaigns did not.
 */
const recoverStuckCampaigns = async () => {
  const LeadCampaign = require('../models/LeadCampaign')
  const IN_FLIGHT = ['planning', 'collecting', 'enriching', 'saving', 'drafting']

  // A campaign is genuinely still running only if a job is about to pick it up
  const stuck = await LeadCampaign.find({
    'progress.phase': { $in: IN_FLIGHT },
    $or: [{ continuesAt: null }, { continuesAt: { $lt: new Date() } }],
  })

  let fixed = 0
  for (const c of stuck) {
    const done = c.stats.qualified >= c.targetLeadCount
    c.progress.phase = done ? 'done' : 'idle'
    c.progress.message = done
      ? `${c.stats.qualified} of ${c.targetLeadCount} found`
      : 'Stopped before finishing'
    c.progress.detail = done ? '' : 'The previous run was interrupted. Run it again to continue.'
    c.progress.updatedAt = new Date()
    if (c.status === 'discovering') c.status = done ? 'ready' : 'ready'
    await c.save()
    fixed++
  }

  if (fixed) logger.info(`Recovered ${fixed} interrupted campaign(s)`)
}

module.exports = { recoverStuckPosts, recoverStuckCampaigns }
