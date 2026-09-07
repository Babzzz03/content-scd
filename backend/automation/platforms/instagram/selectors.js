/**
 * Instagram (web) selectors — verified 2026-05-23
 *
 * Cookie-based auth: sessionid cookie injected before every run.
 * Instagram frequently changes class names — rely on aria-labels and
 * data-testid where possible, fall back to stable text patterns.
 */
module.exports = {
  LOGIN_URL:  'https://www.instagram.com/accounts/login/',
  HOME_URL:   'https://www.instagram.com/',

  loginUsername: 'input[name="username"]',
  loginPassword: 'input[name="password"]',
  loginSubmit:   'button[type="submit"]',

  // Popups that appear after login
  notNowButton: 'button:has-text("Not Now"), button:has-text("Not now")',

  // Left nav — "Create" / new post entry point
  // Instagram uses both an SVG aria-label AND a span text depending on viewport
  newPostSvg:    'svg[aria-label="New post"]',
  newPostCreate: 'span:has-text("Create")',

  // Sub-menu item "Post" that appears after clicking Create
  postMenuItem: '[role="menuitem"]:has-text("Post"), [role="dialog"] div:has-text("Post")',

  // Upload dialog
  selectFromComputer: 'button:has-text("Select from computer"), button:has-text("Select From Computer"), div[role="button"]:has-text("Select from computer")',
  fileUploadInput:    'input[type="file"]',

  // Crop / filter steps
  nextButton:  'div[role="button"]:has-text("Next"), button:has-text("Next")',

  // Caption — confirmed working selector first, fallbacks after
  captionArea: [
    'div[aria-label*="caption" i] p',
    'div[aria-label*="caption" i] [contenteditable]',
    'div[aria-label*="caption" i] textarea',
    'textarea[placeholder*="caption" i]',
    'textarea[aria-label*="caption" i]',
    '[role="textbox"][aria-label*="caption" i]',
    'div[contenteditable="true"]',
    'p[contenteditable="true"]',
  ].join(', '),

  // Share
  shareButton: 'div[role="button"]:has-text("Share"), button:has-text("Share")',

  // Post-share success indicator (Instagram changes these; cast a wide net)
  shareSuccess: 'div:has-text("Your reel has been shared"), div:has-text("Your post has been shared"), div:has-text("Post shared"), div:has-text("has been shared"), div:has-text("Your photo has been shared")',

  // ── Explore / hashtag browsing (for engage) ────────────────────────────────
  exploreUrl:        'https://www.instagram.com/explore/',
  hashtagUrl:        (tag) => `https://www.instagram.com/explore/tags/${encodeURIComponent(tag.replace(/^#/, ''))}/`,

  // Post grid items on explore / hashtag pages
  postGridItem:  'article a[href*="/p/"], div[style*="flex-direction"] a[href*="/p/"]',

  // Post detail page — comment input and like button
  commentInput:  'textarea[aria-label*="Add a comment"], textarea[placeholder*="Add a comment"]',
  postLikeBtn:   'svg[aria-label="Like"], button:has(svg[aria-label="Like"])',
  postUnlikeBtn: 'svg[aria-label="Unlike"], button:has(svg[aria-label="Unlike"])',

  // ── Lead generation + direct messaging ─────────────────────────────────────
  profileUrl:   (username) => `https://www.instagram.com/${String(username).replace(/^@/, '')}/`,
  inboxUrl:     'https://www.instagram.com/direct/inbox/',
  newMessageUrl:'https://www.instagram.com/direct/new/',
  locationUrl:  (id) => `https://www.instagram.com/explore/locations/${id}/`,

  // Profile header — "Message" button. Instagram renders it as a div[role=button]
  // on desktop and a plain button on narrower viewports.
  profileMessageBtn: [
    'div[role="button"]:has-text("Message")',
    'button:has-text("Message")',
    'a[href^="/direct/t/"]',
  ].join(', '),

  // Profile "..." overflow, which hides Message on some layouts
  profileMoreBtn: 'svg[aria-label="Options"], div[role="button"]:has-text("More")',

  // DM composer — contenteditable on current web, textarea on older builds
  dmComposer: [
    'div[role="textbox"][contenteditable="true"][aria-label*="Message" i]',
    'div[aria-label*="Message" i][contenteditable="true"]',
    'textarea[placeholder*="Message" i]',
    'div[role="textbox"][contenteditable="true"]',
  ].join(', '),

  dmSendBtn: 'div[role="button"]:has-text("Send"), button:has-text("Send")',

  // Any message bubble already in the open thread — used to detect that we
  // have talked to this person before and must not message again.
  dmMessageRow: 'div[role="row"], div[data-testid="message-container"], div[class*="message"] [dir="auto"]',

  // New-message dialog (the universal path — many profiles have no Message button)
  // The pencil in the inbox header; /direct/new/ alone does NOT open the dialog.
  dmComposePencil: 'svg[aria-label="New message"], svg[aria-label="New Message"]',
  // MUST stay this specific. The inbox has its own input[placeholder="Search"]
  // earlier in the DOM, and a selector list resolves in document order, so any
  // generic fallback here silently targets the wrong field.
  dmSearchInput:  'input[name="queryBox"]',
  dmSearchResult: '[role="dialog"] [role="button"], [role="dialog"] [role="option"], [role="dialog"] label',
  dmChatNextBtn:  '[role="dialog"] div[role="button"]:has-text("Chat"), [role="dialog"] button:has-text("Chat")',

  // Inbox thread list
  inboxThread:    'div[role="listitem"], a[href^="/direct/t/"]',
  inboxUnreadDot: 'div[class*="unread"], span[class*="unread"]',

  // Post-send interstitials
  notificationsDialog: 'button:has-text("Not Now"), button:has-text("Not now"), div[role="button"]:has-text("Not Now")',

  postText:      'div[data-testid="post-comment-root-0"] span, h1 + div span, div._a9zs span',
}
