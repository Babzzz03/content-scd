/**
 * Google Maps selectors.
 *
 * Google obfuscates class names and rotates them often, so everything here
 * leans on stable structural attributes instead:
 *   - role="feed" for the results list
 *   - href patterns for place links
 *   - data-value attributes on the action buttons
 *
 * The single most valuable signal is `a[data-value="Website"]`. Google renders
 * that anchor ONLY when the business has a website, so its absence is a direct,
 * authoritative "no website" answer — no bio regex guessing required.
 */
module.exports = {
  /** Search results URL. hl/gl pin language and region so parsing stays stable. */
  searchUrl: (query, region = 'NG') =>
    `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=en&gl=${region}`,

  // Results list
  feed:        'div[role="feed"]',
  resultLink:  'a[href*="/maps/place/"]',

  /**
   * Place detail page fields.
   *
   * VERIFIED against live Maps: the results feed contains NO website or phone
   * information at all — its only data-value attribute is "Sign in". Both live
   * on the place page under stable data-item-id attributes, so qualifying a
   * lead requires opening it.
   */
  placeWebsite: 'a[data-item-id="authority"]',
  placePhone:   '[data-item-id^="phone"]',
  placeAddress: '[data-item-id="address"]',
  placeTitle:   'h1',

  /**
   * Consent is a full redirect to consent.google.com, not an overlay, and it
   * fires on every fresh browser context because there is no consent cookie.
   */
  consentHost:   /consent\.google\.com/,
  consentAccept: 'button[aria-label*="Accept all"], form[action*="consent"] button',

  // Shown when a search genuinely has no results
  noResults: 'text=/Google Maps can\'t find|No results found/i',
}
