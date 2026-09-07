/**
 * LinkedIn selectors — verified 2026-05-25
 *
 * Cookie: li_at injected before every run.
 * LinkedIn changes class names frequently — use aria-labels and data attributes.
 */
module.exports = {
  LOGIN_URL:  'https://www.linkedin.com/login',
  HOME_URL:   'https://www.linkedin.com/feed/',

  loginEmail:    '#username',
  loginPassword: '#password',
  loginSubmit:   'button[data-litms-control-urn="login-submit"], button[type="submit"]',

  verificationInput:  'input[name="pin"]',
  verificationSubmit: 'button[type="submit"]',

  // isLoggedIn check — share box only present when authenticated
  feedContainer:   'div[aria-label*="Start a post"]',

  // Compose trigger — "Start a post" box on feed
  shareBoxTrigger: 'div[aria-label*="Start a post"]',

  // Composer modal container
  composerModal:   '[role="dialog"].share-creation-state, .share-creation-state, [data-test-modal="share-creation"], [role="dialog"][aria-label*="Create"], .artdeco-modal--layer-default',

  // Text area inside the modal (scoped to avoid matching other editables on the page)
  composerTextArea: '.share-creation-state [contenteditable="true"], [role="dialog"] [contenteditable="true"], .ql-editor[contenteditable="true"], div[aria-label*="Text editor"] [contenteditable], [contenteditable="true"]',

  // Media/photo button inside the composer toolbar
  mediaButton: 'button[aria-label*="Add a photo"], button[aria-label*="Add media"], button[aria-label*="photo"], .share-creation-state__media-button, [data-control-name="share.media_attachment_button"]',

  // Submit button — "Post" inside the modal
  postSubmitButton: '.share-actions__primary-action, button[aria-label*="Post now"], .share-creation-state button.share-actions__primary-action',

  // Article
  writeArticleButton: 'a[href*="/pulse/articleCreate"]',

  // CAPTCHA
  captchaContainer: '.recaptcha-checkbox, iframe[title*="recaptcha"]',
}
