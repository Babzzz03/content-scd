const send = require('../services/whatsappSend.service')

// ─── WhatsApp sender job ───
//
// Runs every 30 seconds and sends at most ONE message per user per tick.
//
// One per user per tick is the whole design. Draining a user's queue in a loop
// would empty it in seconds, and forty messages in one minute from a number that
// sent nothing yesterday is the clearest possible restriction signal. The
// throttle in whatsappHealth.service.js already refuses to send that fast, so a
// loop here would just spin against it, but keeping the job honest about it
// means nobody later "optimises" the throttle away without noticing what it was.
//
// Register in src/jobs/agenda.js:
//
//   const { defineWhatsAppSender } = require('./whatsappSender.job')
//   defineWhatsAppSender(agenda)
//   await agenda.every('30 seconds', 'whatsapp:drain-queue')

const JOB_NAME = 'whatsapp:drain-queue'

const defineWhatsAppSender = agenda => {
  agenda.define(JOB_NAME, { concurrency: 1, lockLifetime: 2 * 60 * 1000 }, async () => {
    const started = Date.now()

    let userIds = []

    try {
      userIds = await send.usersWithQueuedMessages()
    } catch (err) {
      console.error(`[whatsapp-job] could not list queued users code=${err.code || 'UNKNOWN'} message=${err.message}`)
      return
    }

    if (!userIds.length) return

    const summary = { sent: 0, skipped: 0, failed: 0 }

    for (const userId of userIds) {
      try {
        const result = await send.drainOne(userId)

        if (result.sent) {
          summary.sent += 1
          continue
        }

        if (result.reason === 'send_failed') {
          summary.failed += 1
          continue
        }

        summary.skipped += 1

        // These two need a person, so they are logged loudly rather than
        // counted quietly. A session waiting on a QR scan will never recover on
        // its own, and silently skipping it forever is how a user concludes the
        // feature is broken.
        if (result.needsQr) {
          console.warn(`[whatsapp-job] user=${userId} waiting on QR scan, queue is stalled`)
        }

        if (result.needsHuman) {
          console.warn(`[whatsapp-job] user=${userId} needs human review, queue is stalled`)
        }
      } catch (err) {
        // One user's failure must not stop the rest of the tick.
        summary.failed += 1
        console.error(`[whatsapp-job] drain threw user=${userId} code=${err.code || 'UNKNOWN'} message=${err.message}`)
      }
    }

    console.log(
      `[whatsapp-job] tick users=${userIds.length} sent=${summary.sent} skipped=${summary.skipped} failed=${summary.failed} ms=${Date.now() - started}`
    )
  })
}

module.exports = { defineWhatsAppSender, JOB_NAME }
