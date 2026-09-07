/**
 * Test X posting end-to-end using the real automation stack.
 * Usage: node test-x-auth.js <auth_token>
 */
require('dotenv').config()
const AutomationHub = require('./automation')
const logger = require('./src/utils/logger')

const authToken = process.argv[2]
if (!authToken) {
  console.error('Usage: node test-x-auth.js <your_auth_token>')
  process.exit(1)
}

;(async () => {
  logger.info('=== X 7-tweet thread with images test ===')
  try {
    const ts = Date.now()
    const result = await AutomationHub.publish({
      platform:   'x',
      cookie:     { cookieName: 'auth_token', cookieValue: authToken },
      username:   'test',
      sessionFile: null,
      content:    'Thread test 1/7',
      postType:   'thread',
      hashtags:   [],
      mediaUrls:  [
        '/Users/mac/Desktop/Screenshot 2026-05-26 at 03.30.56.png',
        '/Users/mac/Desktop/Screenshot 2026-05-23 at 15.08.35.png',
        '/Users/mac/Desktop/Screenshot 2026-05-13 at 22.32.40.png',
        '/Users/mac/Desktop/Screenshot 2026-05-09 at 22.01.08.png',
        '/Users/mac/Desktop/Screenshot 2026-05-09 at 21.47.55.png',
        '/Users/mac/Desktop/Screenshot 2026-05-05 at 15.46.18.png',
        '/Users/mac/Desktop/Screenshot 2026-05-05 at 15.40.51.png',
      ],
      threadParts: [
        `Tweet 1/7 — automation thread test ${ts}`,
        'Tweet 2/7 — second tweet with image',
        'Tweet 3/7 — third tweet with image',
        'Tweet 4/7 — fourth tweet with image',
        'Tweet 5/7 — fifth tweet with image',
        'Tweet 6/7 — sixth tweet with image',
        'Tweet 7/7 — final tweet with image',
      ],
      dailyPostCount: 0,
    })
    logger.info('SUCCESS — post published', result)
  } catch (err) {
    logger.error('FAILED — ' + err.message)
  }
  process.exit(0)
})()
