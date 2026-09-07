const mongoose = require('mongoose')

/**
 * Lead
 *
 * One discovered business account. Created by the discovery job, enriched by
 * the profile scraper, scored locally, then qualified + drafted by DeepSeek.
 *
 * Status lifecycle:
 *   new → enriched → qualified → drafted → approved → queued → messaged
 *                       ↓            ↓         ↓         ↓
 *                    skipped      skipped   skipped    failed
 *   messaged → replied | opted_out
 *
 * "skipped" is terminal but reversible from the UI. "opted_out" is terminal
 * and permanent — the sender refuses to message an opted-out lead ever again.
 */
const leadSchema = new mongoose.Schema(
  {
    user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadCampaign', index: true },
    /**
     * Where this lead came from. Instagram leads are scraped and messaged;
     * Google leads come from the official Places API and are worked by phone.
     */
    source:   { type: String, enum: ['instagram', 'google_maps'], default: 'instagram', index: true },
    platform: { type: String, enum: ['instagram', 'google_maps'], default: 'instagram' },

    /**
     * Stable identifier within the source: an Instagram handle, or a Google
     * place_id. Google permits storing place_id indefinitely (unlike the rest
     * of the Places payload), which is what makes dedupe across refreshes work.
     */
    externalId: { type: String, required: true, index: true },

    // ── Identity ───────────────────────────────────────────────────────────
    username:       { type: String, lowercase: true, trim: true, default: '' },
    fullName:       { type: String, default: '' },
    profileUrl:     { type: String, default: '' },
    profilePicUrl:  { type: String, default: '' },

    // ── Scraped profile data ───────────────────────────────────────────────
    bio:            { type: String, default: '', maxlength: 1000 },
    category:       { type: String, default: '' },   // IG business category, e.g. "Bakery"
    externalLink:   { type: String, default: '' },   // link-in-bio, empty = no website
    followers:      { type: Number, default: 0 },
    following:      { type: Number, default: 0 },
    postsCount:     { type: Number, default: 0 },

    isBusinessAccount: { type: Boolean, default: false },
    isVerified:        { type: Boolean, default: false },
    isPrivate:         { type: Boolean, default: false },

    /** Derived: no external link AND no URL in the bio. The core pitch filter. */
    hasWebsite:     { type: Boolean, default: false, index: true },

    /** Public contact details from IG business buttons or bio text */
    contact: {
      email:    { type: String, default: '' },
      phone:    { type: String, default: '' },
      whatsapp: { type: String, default: '' },
      address:  { type: String, default: '' },
    },

    /**
     * Which path produced this record: 'api' has exact counts, business flag,
     * and post dates; 'dom' is the rate-limit fallback and knows less.
     */
    enrichedVia: { type: String, enum: ['api', 'dom'], default: 'api' },

    /** Most recent post date, used to filter out dormant accounts */
    lastPostAt:  { type: Date, default: null },

    // ── Google Maps specific ───────────────────────────────────────────────
    google: {
      placeId:        { type: String, default: '' },
      formattedAddress:{ type: String, default: '' },
      phone:          { type: String, default: '' },
      internationalPhone: { type: String, default: '' },
      rating:         { type: Number, default: 0 },
      reviewCount:    { type: Number, default: 0 },
      businessStatus: { type: String, default: '' },
      primaryType:    { type: String, default: '' },
      types:          [String],
      mapsUri:        { type: String, default: '' },
      lat:            { type: Number, default: null },
      lng:            { type: Number, default: null },
      /**
       * Google's terms require Places content to be refreshed within 30 days.
       * Only place_id may be cached indefinitely, so this timestamp drives
       * re-fetching rather than serving stale data forever.
       */
      detailsFetchedAt: { type: Date, default: null },
    },

    // ── Phone / WhatsApp outreach (Google leads) ───────────────────────────
    /** AI-written opening line for a call or WhatsApp message */
    callScript:   { type: String, default: '' },
    contactedAt:  { type: Date, default: null },
    contactMethod:{ type: String, enum: ['call', 'whatsapp', 'email', 'dm', null], default: null },
    callOutcome:  { type: String, enum: ['interested', 'callback', 'not_interested', 'no_answer', 'wrong_number', null], default: null },
    notes:        { type: String, default: '', maxlength: 2000 },

    // ── Discovery provenance ───────────────────────────────────────────────
    niche:    { type: String, default: '' },
    location: { type: String, default: '' },
    discoveredVia: {
      type:  { type: String, enum: ['hashtag', 'location', 'search', 'manual'], default: 'hashtag' },
      query: { type: String, default: '' },
    },

    // ── Scoring & qualification ────────────────────────────────────────────
    score:        { type: Number, default: 0, index: true },   // 0-100, deterministic
    scoreReasons: [String],
    aiFit:        { type: String, enum: ['strong', 'moderate', 'weak', 'unqualified', null], default: null },
    aiAngle:      { type: String, default: '' },   // the pitch angle DeepSeek picked
    aiReasoning:  { type: String, default: '' },

    // ── Outreach ───────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['new', 'enriched', 'qualified', 'drafted', 'approved', 'queued',
             'messaged', 'replied', 'skipped', 'failed', 'opted_out',
             // Google / call-list states
             'to_call', 'contacted', 'callback', 'won', 'lost'],
      default: 'new',
      index: true,
    },
    draftMessage:    { type: String, default: '' },   // AI-written, editable
    approvedMessage: { type: String, default: '' },   // what actually gets sent
    messagedAt:      { type: Date, default: null },
    repliedAt:       { type: Date, default: null },
    replyPreview:    { type: String, default: '' },
    threadUrl:       { type: String, default: '' },
    sendAttempts:    { type: Number, default: 0 },
    sendError:       { type: String, default: null },
    skipReason:      { type: String, default: '' },
  },
  { timestamps: true }
)

// One lead per external identity per user — the dedupe guarantee across all
// campaigns. An Instagram handle and a Google place_id both live in externalId,
// so the same business found twice is stored once regardless of source.
leadSchema.index({ user: 1, source: 1, externalId: 1 }, { unique: true })

// Review queue and sender queries
leadSchema.index({ user: 1, status: 1, score: -1 })
leadSchema.index({ campaign: 1, status: 1 })

/** True when this lead may still be contacted. */
leadSchema.methods.isMessageable = function () {
  return !['messaged', 'replied', 'opted_out', 'contacted', 'won', 'lost'].includes(this.status)
}

/** Best available phone number for a call-list lead. */
leadSchema.methods.bestPhone = function () {
  return this.google?.internationalPhone || this.google?.phone || this.contact?.phone || ''
}

module.exports = mongoose.model('Lead', leadSchema)
