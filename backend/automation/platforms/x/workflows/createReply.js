const sel = require('../selectors')
const { sleep, randInt } = require('../../../utils/random')
const logger = require('../../../../src/utils/logger')
const { generateContextualReply } = require('../../../../src/services/deepseek.service')

/**
 * Reply to a specific tweet by URL.
 * payload.replyToUrl — full tweet URL e.g. https://x.com/user/status/123
 */
const createReply = async (page, human, { replyToUrl, content }) => {
  logger.info('X: navigating to tweet for reply', { url: replyToUrl })
  await page.goto(replyToUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('article[role="article"]', { timeout: 20000 })
  await sleep(randInt(1500, 3000))

  // Click the reply button on the first article (the target tweet)
  const tweet = await page.$('article[role="article"]')
  const replyBtn = await tweet.$('button[data-testid="reply"]')
  if (!replyBtn) throw new Error('X: reply button not found on tweet')
  await replyBtn.click()
  logger.debug('X: reply button clicked')

  // Wait for reply dialog textbox
  await page.waitForSelector('div[role="dialog"] div[role="textbox"]', { timeout: 10000 })
  await sleep(randInt(800, 1500))

  // Fill reply text
  const textbox = await page.$('div[role="dialog"] div[role="textbox"]')
  if (!textbox) throw new Error('X: reply textbox not found')
  await textbox.fill(content)
  await sleep(randInt(800, 1500))

  // Dismiss any autocomplete dropdown
  await page.keyboard.press('Escape')
  await sleep(300)

  // Click the Post button inside the dialog
  const sendBtn = await page.$('div[role="dialog"] button[data-testid="tweetButton"]')
  if (!sendBtn) throw new Error('X: reply send button not found')
  await sendBtn.click()

  await page.waitForSelector('div[role="dialog"]', { state: 'hidden', timeout: 20000 })
  await sleep(randInt(1000, 2000))

  // Like the tweet after replying
  const freshTweet = await page.$('article[role="article"]')
  if (freshTweet) await likeTweet(page, freshTweet)

  logger.info('X: reply submitted')
  return { postId: null }
}

/**
 * Like a tweet article element. Skips silently if already liked or button not found.
 */
const likeTweet = async (page, article) => {
  try {
    const likeBtn = await article.$('button[data-testid="like"]')
    if (!likeBtn) {
      // Already liked (data-testid="unlike") or button absent — skip
      return
    }
    await likeBtn.click()
    await sleep(randInt(400, 800))
    logger.debug('X: tweet liked')
  } catch { /* non-fatal */ }
}

/**
 * Dismiss the "Save post?" overlay that X shows when closing a compose dialog
 * with content. Clicks "Discard" and returns true if the overlay was present.
 */
const dismissSavePostOverlay = async (page) => {
  try {
    const discard = await page.$('button:has-text("Discard")')
    if (discard) {
      await discard.click()
      await sleep(500)
      return true
    }
  } catch { /* overlay not present */ }
  return false
}

/**
 * Extract the visible text of a tweet article element.
 */
const extractTweetText = async (article) => {
  try {
    const el = await article.$('[data-testid="tweetText"]')
    if (el) return (await el.innerText()).trim()
  } catch { /* ignore */ }
  return ''
}

/**
 * Navigate to the right X page based on targetType, then wait for tweets.
 * targetType: 'topic' | 'hashtag' | 'account' | 'trending' | 'recent' | 'specific'
 */
// Selector used by Explore/Trending page vs search results pages
const TWEET_SEL_TRENDING = '[data-testid="tweet"]'
const TWEET_SEL_SEARCH   = 'article[role="article"]'

const navigateToTarget = async (page, { targetType, topic }) => {
  let tweetSelector = TWEET_SEL_SEARCH

  if (targetType === 'trending') {
    logger.info('X: navigating to Explore to find trending topic')
    await page.goto('https://x.com/explore', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await sleep(randInt(1500, 2500))

    // Click the Trending tab to load trending topic cards
    const trendingTab = page.locator('[role="tab"]').filter({ hasText: /^Trending$/i }).first()
    try {
      await trendingTab.waitFor({ state: 'visible', timeout: 8000 })
      await trendingTab.click()
      await sleep(randInt(1500, 2500))
    } catch {
      logger.warn('X: Trending tab not found, using current Explore page')
    }

    // Trending tab shows topic cards — grab the first topic text and search for it
    let trendingQuery = null
    try {
      // X trending items: [data-testid="trend"] or cells with topic name spans
      const trendCard = await page.$('[data-testid="trend"]')
      if (trendCard) {
        const spans = await trendCard.$$('span')
        for (const span of spans) {
          const text = (await span.innerText()).trim()
          if (text && !text.includes(' ') && (text.startsWith('#') || text.length > 2)) {
            trendingQuery = text
            break
          }
        }
        if (!trendingQuery) trendingQuery = await trendCard.innerText().then(t => t.split('\n')[0].trim())
      }
    } catch { /* ignore */ }

    if (trendingQuery) {
      logger.info(`X: trending topic found: "${trendingQuery}", searching for tweets`)
      const searchUrl = `https://x.com/search?q=${encodeURIComponent(trendingQuery)}&src=typed_query&f=top`
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    } else {
      logger.warn('X: could not extract trending topic, falling back to For You feed')
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 })
    }
    tweetSelector = TWEET_SEL_SEARCH
  } else if (targetType === 'recent') {
    const searchUrl = `https://x.com/search?q=${encodeURIComponent(topic)}&src=typed_query&f=live`
    logger.info('X: searching recent', { searchUrl })
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
  } else if (targetType === 'account') {
    const handle = topic.replace(/^@/, '')
    const searchUrl = `https://x.com/search?q=from%3A${encodeURIComponent(handle)}&src=typed_query&f=top`
    logger.info('X: searching account posts', { handle, searchUrl })
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
  } else {
    // topic, hashtag, or fallback
    const searchUrl = `https://x.com/search?q=${encodeURIComponent(topic)}&src=typed_query&f=top`
    logger.info('X: searching', { topic, searchUrl })
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
  }

  await page.waitForSelector(tweetSelector, { timeout: 25000 })
  await sleep(randInt(1500, 3000))
  return tweetSelector
}

/**
 * Click a tweet to open it and collect top comments for richer AI context.
 */
const collectComments = async (page, article) => {
  const comments = []
  try {
    await article.click()
    await sleep(randInt(1000, 2000))
    const commentEls = await page.$$('[data-testid="tweetText"]')
    for (const el of commentEls.slice(1, 5)) {
      try { comments.push(await el.innerText()) } catch { /* skip */ }
    }
  } catch { /* ignore navigation errors */ }
  return comments
}

/**
 * Search X and reply to the top N tweets matching a topic.
 * payload.targetType   — 'topic' | 'hashtag' | 'account' | 'trending' | 'recent'
 * payload.topic        — search query / hashtag / handle
 * payload.content      — fallback reply text (used if AI generation fails)
 * payload.tone         — tone for AI reply generation
 * payload.repeatCount  — how many top tweets to reply to (default 1)
 */
const replyToTopTweets = async (page, { targetType = 'topic', topic, content, tone, repeatCount = 1, delayBetween = 5000 }) => {
  const tweetSelector = await navigateToTarget(page, { targetType, topic })

  const tweets = await page.$$(tweetSelector)
  if (!tweets.length) throw new Error(`X: no tweets found for topic "${topic}"`)

  const count = Math.min(repeatCount, tweets.length)
  logger.info(`X: found ${tweets.length} tweets, replying to top ${count}`)

  for (let i = 0; i < count; i++) {
    logger.info(`X: posting reply ${i + 1}/${count}`)
    try {
      // Re-query each iteration since DOM shifts after interactions
      const freshTweets = await page.$$(tweetSelector)
      const target = freshTweets[i]
      if (!target) continue

      // Read the tweet text, collect comments for context, then generate a reply
      const tweetText = await extractTweetText(target)
      logger.info(`X: tweet text: "${tweetText.slice(0, 80)}..."`)

      // Collect top comments for richer AI context, then go back to the list
      const comments = await collectComments(page, target)
      if (comments.length) logger.info(`X: collected ${comments.length} comments for context`)
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
      await page.waitForSelector(tweetSelector, { timeout: 15000 })
      await sleep(randInt(800, 1500))

      let replyText = content
      if (tweetText) {
        try {
          replyText = await generateContextualReply({ tweetText, topic, tone, comments })
          logger.info(`X: AI reply: "${replyText}"`)
        } catch (aiErr) {
          logger.warn('X: AI reply generation failed, using fallback', { err: aiErr.message })
        }
      }

      // Re-query after navigation back
      const afterBack = await page.$$(tweetSelector)
      const replyTarget = afterBack[i]
      if (!replyTarget) continue

      const replyBtn = await replyTarget.$('button[data-testid="reply"]')
      if (!replyBtn) { logger.warn(`X: no reply button on tweet ${i + 1}`); continue }

      await replyBtn.click()
      await page.waitForSelector('div[role="dialog"] div[role="textbox"]', { timeout: 10000 })
      await sleep(randInt(800, 1500))

      const textbox = page.locator('div[role="dialog"] div[role="textbox"]').first()
      await textbox.fill(replyText)
      await sleep(randInt(1000, 1800))

      // Click the send button directly — avoid Escape which closes the whole dialog
      const sendBtn = page.locator('div[role="dialog"] button[data-testid="tweetButton"]').first()
      await sendBtn.waitFor({ state: 'visible', timeout: 8000 })
      await sendBtn.click({ force: true })
      await sleep(500)

      // If "Save post?" overlay appeared (dialog was closed by X), discard and continue
      const overlayDismissed = await dismissSavePostOverlay(page)
      if (overlayDismissed) {
        logger.warn(`X: reply ${i + 1} — "Save post?" overlay appeared, discarded and moving on`)
        await sleep(randInt(1500, 2500))
        continue
      }

      await page.waitForSelector('div[role="dialog"]', { state: 'hidden', timeout: 15000 })
      logger.info(`X: reply ${i + 1} sent`)

      // Like the tweet after replying — re-query since DOM may have shifted
      const afterReply = await page.$$(tweetSelector)
      if (afterReply[i]) await likeTweet(page, afterReply[i])

      await sleep(delayBetween + randInt(-1000, 1000))
    } catch (err) {
      logger.warn(`X: reply ${i + 1} failed — ${err.message}`)
      // Dismiss any lingering overlay before continuing
      await dismissSavePostOverlay(page)
      await sleep(randInt(1500, 2500))
    }
  }

  return { postId: null }
}

module.exports = { createReply, replyToTopTweets }
