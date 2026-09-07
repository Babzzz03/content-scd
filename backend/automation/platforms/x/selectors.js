/**
 * X (Twitter) selectors — live-verified via session recording 2026-05-23
 *
 * Confirmed from recording:
 *  - fileInput:        data-testid="fileInput"  ✓
 *  - tweetTextArea:    data-testid="tweetTextarea_0" (DraftJS editor wrapper)
 *                      fallback: .public-DraftStyleDefault-block (confirmed in recording)
 *  - tweetButton:      data-testid="SideNav_NewTweet_Button" (sidebar Post button)
 *  - postSubmitButton: data-testid="tweetButtonInline" (Post button inside compose)
 *
 * data-testid attributes are stable across X UI updates — prefer them over class names.
 */
module.exports = {
  LOGIN_URL: 'https://x.com/i/flow/login',
  loginEmailInput:     'input[autocomplete="username"]',
  loginNextButton:     '[data-testid="LoginForm_Login_Button"], button[type="button"]:has-text("Next")',
  loginPasswordInput:  'input[type="password"]',
  loginSubmitButton:   '[data-testid="LoginForm_Login_Button"], button[type="button"]:has-text("Log in")',
  loginUsernamePrompt: 'input[data-testid="ocfEnterTextTextInput"]',

  HOME_URL:     'https://x.com/home',
  COMPOSE_URL:  'https://x.com/compose/post',
  feedTimeline: '[data-testid="primaryColumn"]',

  // Sidebar "Post" button — opens compose dialog (fallback only)
  tweetButton: '[data-testid="SideNav_NewTweet_Button"]',

  // Compose text area — data-testid IS the textbox div (not a child inside it)
  tweetTextArea: 'div[data-testid="tweetTextarea_0"]',

  // Media upload
  mediaUploadButton: 'input[data-testid="fileInput"]',

  // Submit — "tweetButton" is "Post all" for threads and "Post" for single posts
  postSubmitButton: 'button[data-testid="tweetButton"]',

  // Thread — "+" button inside compose (button element, NOT the sidebar <a> link)
  addTweetButton: 'button[data-testid="addButton"]',

  // Reply
  replyButton:   '[data-testid="reply"]',
  replyTextArea: '[data-testid="tweetTextarea_0"]',

  // CAPTCHA / verification
  captchaFrame:          'iframe[src*="funcaptcha"], iframe[title*="captcha"]',
  verificationChallenge: '[data-testid="ocfEnterTextTextInput"]',
}
