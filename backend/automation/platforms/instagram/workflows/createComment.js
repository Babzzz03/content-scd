/**
 * Instagram engagement — like + comment on posts.
 *
 * targetType: 'hashtag' | 'explore' | 'account'
 * topic:      hashtag (without #), username, or keyword
 * content:    fallback comment text if AI fails
 * tone:       AI tone for generated comment
 * repeatCount: how many posts to engage with
 */
const sel = require('../selectors')
const { sleep, randInt, actionDelay } = require('../../../utils/random')
const logger = require('../../../../src/utils/logger')
const { generateContextualReply, generateNicheTrendingHashtags } = require('../../../../src/services/deepseek.service')

/**
 * Pull all user-generated text blocks from the open post page.
 * Returns { caption, comments } where:
 *   caption  = longest text block (the post's own caption)
 *   comments = remaining shorter blocks in DOM order (other people's comments)
 *
 * Instagram sets dir="auto" on all user-written text. Class names are
 * obfuscated and change frequently, so we rely solely on dir="auto" and
 * pick by length rather than position.
 */
const extractPostContent = async (page, commentLimit = 5) => {
  try {
    // Wait until ANY dir="auto" text appears (React-rendered user content)
    await page.waitForSelector('[dir="auto"]', { timeout: 12000 }).catch(() => {})
    await sleep(randInt(1200, 2000))

    // Diagnostic: tells us exactly what's in the DOM so we can fix selectors
    const domInfo = await page.evaluate(() => ({
      hasArticle:   !!document.querySelector('article'),
      hasMain:      !!document.querySelector('main'),
      dirAutoCount: document.querySelectorAll('[dir="auto"]').length,
      h1Text:       Array.from(document.querySelectorAll('h1')).map(e => (e.innerText || '').trim().slice(0, 80)),
      allDirAuto:   Array.from(document.querySelectorAll('[dir="auto"]')).map(e => (e.innerText || e.textContent || '').trim().slice(0, 80)).filter(Boolean),
    })).catch(() => ({}))
    logger.debug('Instagram: DOM probe', domInfo)

    // Scope-free sweep — search whole page, not just article.
    // Instagram's layout structure changes; dir="auto" reliably marks user text.
    const rawTexts = await page.$$eval(
      '[dir="auto"], h1',
      (els) => {
        const seen = new Set()
        const out = []
        for (const el of els) {
          const t = (el.innerText || el.textContent || '').trim()
          if (!t || seen.has(t)) continue
          seen.add(t)
          out.push(t)
        }
        return out
      }
    )

    logger.debug('Instagram: raw texts found', {
      count: rawTexts.length,
      samples: rawTexts.slice(0, 10).map(t => t.slice(0, 60)),
    })

    const clean = rawTexts.filter(t => {
      if (t.length < 6) return false
      if (t.startsWith('@') && !t.includes(' ')) return false
      if (/^(#\w+\s*)+$/.test(t)) return false
      return true
    })

    if (!clean.length) return { caption: '', comments: [] }

    const sorted = [...clean].sort((a, b) => b.length - a.length)
    const caption = sorted[0]
    const comments = clean.filter(t => t !== caption).slice(0, commentLimit)

    return { caption, comments }
  } catch (err) {
    logger.warn('Instagram: extractPostContent error', { err: err.message })
  }
  return { caption: '', comments: [] }
}

/**
 * Like the currently open post. Skips if already liked.
 */
const likeOpenPost = async (page) => {
  try {
    // Already liked? data-testid="unlike" or aria-label="Unlike"
    const unlikeBtn = await page.$('svg[aria-label="Unlike"], button:has(svg[aria-label="Unlike"])')
    if (unlikeBtn && await unlikeBtn.isVisible()) {
      logger.debug('Instagram: post already liked, skipping')
      return
    }
    const likeBtn = await page.$('svg[aria-label="Like"]')
    if (!likeBtn) return
    // Click the parent button
    const btn = await likeBtn.$('xpath=..')
    if (btn) await btn.click()
    else await likeBtn.click()
    await sleep(randInt(400, 900))
    logger.debug('Instagram: post liked')
  } catch { /* non-fatal */ }
}

/**
 * Post a comment on the currently open post.
 */
const postComment = async (page, commentText) => {
  try {
    const textarea = await page.waitForSelector(sel.commentInput, { timeout: 10000 })
    await textarea.click()
    await sleep(randInt(400, 700))
    await page.keyboard.type(commentText, { delay: randInt(30, 70) })
    await sleep(randInt(800, 1500))
    // Submit with Enter
    await page.keyboard.press('Enter')
    await sleep(randInt(1000, 2000))
    logger.debug('Instagram: comment posted')
  } catch (err) {
    logger.warn('Instagram: could not post comment', { err: err.message })
  }
}

/**
 * Parse a post's timestamp from the open post page.
 * Returns the post Date, or null if not found.
 */
const getPostDate = async (page) => {
  try {
    const timeEl = await page.$('time[datetime]')
    if (!timeEl) return null
    const dt = await timeEl.getAttribute('datetime')
    return dt ? new Date(dt) : null
  } catch { return null }
}

/**
 * Returns true if the post is within maxDays old.
 * Defaults to true (allow) when timestamp cannot be determined.
 */
const isRecentEnough = (postDate, maxDays = 3) => {
  if (!postDate) return true
  const ageDays = (Date.now() - postDate.getTime()) / 86400000
  return ageDays <= maxDays
}

/**
 * Collect post URLs from a single hashtag feed page.
 * Tries clicking the "Recent" tab first to surface today's posts.
 */
const collectFromHashtag = async (page, hashtag, bufferSize) => {
  const navUrl = sel.hashtagUrl(hashtag)
  logger.info('Instagram: navigating to hashtag feed', { navUrl, hashtag })
  await page.goto(navUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await sleep(randInt(2000, 3500))

  try {
    const recentTab = page.locator('a, [role="tab"], div[role="button"]')
      .filter({ hasText: /^Recent$/ })
      .first()
    if (await recentTab.isVisible({ timeout: 3000 })) {
      await recentTab.click()
      logger.debug('Instagram: switched to Recent tab', { hashtag })
      await sleep(randInt(1500, 2500))
    }
  } catch { /* no Recent tab */ }

  const anchors = await page.$$('a[href*="/p/"]')
  const urls = []
  const seen = new Set()
  for (const a of anchors) {
    const href = await a.getAttribute('href')
    if (href && href.includes('/p/') && !seen.has(href)) {
      seen.add(href)
      urls.push(`https://www.instagram.com${href}`)
      if (urls.length >= bufferSize) break
    }
  }
  return urls
}

/**
 * Navigate to the target feed (hashtag, explore, trending, or account profile).
 * For "trending" targetType, uses AI to discover niche-relevant hashtags first,
 * then collects posts from those hashtags.
 * Collects a buffer of post URLs (4x the needed count) for recency filtering.
 */
const collectPostUrls = async (page, { targetType, topic, niche }, limit) => {
  const bufferSize = limit * 4

  // ── Niche trending: discover active hashtags via AI, then scrape each ────────
  if (targetType === 'trending') {
    const resolvedNiche = niche || topic
    logger.info('Instagram: discovering trending hashtags for niche', { niche: resolvedNiche })

    let hashtags = []
    try {
      hashtags = await generateNicheTrendingHashtags({ niche: resolvedNiche, platform: 'instagram', count: 5 })
      logger.info('Instagram: AI-suggested hashtags', { hashtags })
    } catch (err) {
      logger.warn('Instagram: could not generate niche hashtags, falling back to explore', { err: err.message })
    }

    if (!hashtags.length) {
      // Fallback: explore page
      logger.info('Instagram: falling back to explore page')
      await page.goto(sel.exploreUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await sleep(randInt(2000, 3500))
      const anchors = await page.$$('a[href*="/p/"]')
      const urls = []
      const seen = new Set()
      for (const a of anchors) {
        const href = await a.getAttribute('href')
        if (href && href.includes('/p/') && !seen.has(href)) {
          seen.add(href)
          urls.push(`https://www.instagram.com${href}`)
          if (urls.length >= bufferSize) break
        }
      }
      logger.debug(`Instagram: collected ${urls.length} candidate URLs from explore`)
      return urls
    }

    // Collect posts from each niche hashtag, spread evenly
    const perTag = Math.ceil(bufferSize / hashtags.length)
    const allUrls = []
    const globalSeen = new Set()
    for (const tag of hashtags) {
      const tagUrls = await collectFromHashtag(page, tag, perTag)
      for (const u of tagUrls) {
        if (!globalSeen.has(u)) {
          globalSeen.add(u)
          allUrls.push(u)
        }
      }
      if (allUrls.length >= bufferSize) break
      await sleep(randInt(1000, 2000))
    }
    logger.debug(`Instagram: collected ${allUrls.length} candidate URLs across ${hashtags.length} niche hashtags`)
    return allUrls
  }

  // ── Standard modes ────────────────────────────────────────────────────────────
  let navUrl
  if (targetType === 'hashtag') {
    navUrl = sel.hashtagUrl(topic)
  } else if (targetType === 'account') {
    const handle = topic.replace(/^@/, '')
    navUrl = `https://www.instagram.com/${handle}/`
  } else if (targetType === 'recent') {
    // Home feed — posts from accounts the user follows, most recent first
    navUrl = sel.HOME_URL
  } else {
    navUrl = sel.exploreUrl
  }

  logger.info('Instagram: navigating to feed', { navUrl, targetType })
  await page.goto(navUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

  if (targetType === 'recent') {
    // Home feed is React-rendered — wait for the first post/reel link to appear,
    // then scroll to trigger lazy loading of more posts
    logger.debug('Instagram: waiting for home feed posts to render…')
    await page.waitForSelector('a[href*="/p/"], a[href*="/reel/"]', { timeout: 20000 }).catch(() => {
      logger.warn('Instagram: home feed post links did not appear within 20s')
    })
    await sleep(randInt(2500, 4000))
    // Scroll down three times to load more posts into view
    for (let s = 0; s < 3; s++) {
      await page.evaluate(() => window.scrollBy(0, 900))
      await sleep(randInt(1200, 2000))
    }
    logger.debug('Instagram: home feed scrolled, collecting post links')
  } else {
    await sleep(randInt(2000, 3500))
  }

  if (targetType === 'hashtag') {
    try {
      const recentTab = page.locator('a, [role="tab"], div[role="button"]')
        .filter({ hasText: /^Recent$/ })
        .first()
      if (await recentTab.isVisible({ timeout: 3000 })) {
        await recentTab.click()
        logger.debug('Instagram: switched to Recent tab on hashtag page')
        await sleep(randInt(1500, 2500))
      }
    } catch { /* no Recent tab */ }
  }

  // For the home feed also collect reel links — modern IG feeds mix posts and reels
  const hrefPattern = targetType === 'recent' ? '/p/, /reel/' : '/p/'
  const anchorSelector = targetType === 'recent' ? 'a[href*="/p/"], a[href*="/reel/"]' : 'a[href*="/p/"]'
  const anchors = await page.$$(anchorSelector)
  logger.debug(`Instagram: scanning ${anchors.length} anchor tags (pattern: ${hrefPattern})`)

  const urls = []
  const seen = new Set()
  for (const a of anchors) {
    const href = await a.getAttribute('href')
    const isPost = href && (href.includes('/p/') || href.includes('/reel/'))
    if (isPost && !seen.has(href)) {
      seen.add(href)
      urls.push(`https://www.instagram.com${href}`)
      if (urls.length >= bufferSize) break
    }
  }
  logger.debug(`Instagram: collected ${urls.length} candidate URLs (need ${limit} recent)`)
  return urls
}

/**
 * Main engage function: navigate to target, open each post, like + comment.
 */
const engageWithPosts = async (page, {
  targetType = 'hashtag',
  topic,
  niche,
  content,
  tone,
  repeatCount = 1,
  delayBetween = 5000,
}) => {
  const count = Math.min(Number(repeatCount), 10)
  const postUrls = await collectPostUrls(page, { targetType, topic, niche }, count)

  if (!postUrls.length) {
    throw new Error(`Instagram: no posts found for target "${topic || targetType}"`)
  }

  logger.info(`Instagram: found ${postUrls.length} posts, engaging with ${Math.min(count, postUrls.length)}`)

  let engaged = 0
  for (const url of postUrls) {
    if (engaged >= count) break
    try {
      logger.info(`Instagram: opening post ${engaged + 1}/${count}`, { url })
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await sleep(randInt(1500, 2500))

      // ── Recency check — skip posts older than 3 days ──────────────────────
      const postDate = await getPostDate(page)
      if (postDate) {
        const ageDays = (Date.now() - postDate.getTime()) / 86400000
        logger.debug(`Instagram: post age ${ageDays.toFixed(1)} days (${postDate.toISOString()})`)
        if (!isRecentEnough(postDate, 30)) {
          logger.info(`Instagram: skipping post older than 30 days (${ageDays.toFixed(1)}d)`, { url })
          continue
        }
      }

      // Extract caption and top comments in one pass
      const { caption, comments: topComments } = await extractPostContent(page, 5)
      logger.info(`Instagram: post caption (${caption.length} chars): "${caption.slice(0, 100)}"`)
      if (topComments.length) {
        logger.debug('Instagram: top comments for context', {
          count: topComments.length,
          samples: topComments.map(c => c.slice(0, 40)),
        })
      }

      // Only generate AI comment when we have actual caption text
      let commentText = content
      if (caption && caption.length > 8) {
        try {
          commentText = await generateContextualReply({
            tweetText: caption,
            topic,
            tone,
            comments: topComments,
            platform: 'instagram',
          })
          logger.info(`Instagram: AI comment: "${commentText}"`)
        } catch (aiErr) {
          logger.warn('Instagram: AI comment failed, using fallback', { err: aiErr.message })
        }
      } else {
        logger.warn('Instagram: caption empty or too short, skipping AI generation for this post')
      }

      // Like the post first, then comment
      await likeOpenPost(page)
      await sleep(randInt(500, 1200))
      await postComment(page, commentText)

      engaged++
      logger.info(`Instagram: engagement ${engaged} complete`)
      await sleep(delayBetween + randInt(-1000, 1000))
    } catch (err) {
      logger.warn(`Instagram: engagement ${engaged + 1} failed — ${err.message}`)
      await sleep(randInt(2000, 4000))
    }
  }

  logger.info(`Instagram: finished engaging with ${engaged} posts`)
  return { postId: null }
}

module.exports = { engageWithPosts }
