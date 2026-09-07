const mongoose = require('mongoose')

/**
 * LeadCampaign
 *
 * A saved search + filter + offer definition. Discovery jobs read `search` and
 * `filters`; the AI drafter reads `offer` and `icp`; the sender reads
 * `messageSettings`.
 *
 * A campaign never sends on its own unless messageSettings.autoSend is true.
 * The default is the review queue: drafts pile up as "drafted" and a human
 * approves them.
 */
const leadCampaignSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },

    /**
     * Which lead source this campaign draws from.
     *
     *   instagram   — scraped profiles, worked through automated DMs
     *   google_maps — scraped Maps listings, worked as a phone/WhatsApp call
     *                 list. Nothing is ever sent automatically for this source.
     */
    source: { type: String, enum: ['instagram', 'google_maps'], default: 'instagram', index: true },

    /** Google region hint (ccTLD) so results are locally relevant */
    region: { type: String, default: 'NG' },

    /**
     * Which connected IG account discovers and sends. Required for Instagram
     * campaigns; Google campaigns need no account at all, which is the whole
     * point of that source.
     */
    platformAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlatformAccount',
      required: function () { return this.source !== 'google_maps' },
    },

    status: {
      type: String,
      enum: ['draft', 'discovering', 'ready', 'sending', 'paused', 'completed', 'error'],
      default: 'draft',
      index: true,
    },

    // ── What to look for ───────────────────────────────────────────────────
    search: {
      niches:    [String],   // e.g. ['bakery', 'coffee shop']
      locations: [String],   // e.g. ['Lagos', 'Abuja']
      /** Extra hashtags to search verbatim, on top of the generated niche×location set */
      extraHashtags: [String],
      /** Populated by DeepSeek from niches × locations, cached so reruns are cheap */
      generatedQueries: [String],
    },

    // ── Who qualifies ──────────────────────────────────────────────────────
    filters: {
      /** The headline filter: only businesses with no website in bio */
      requireNoWebsite:      { type: Boolean, default: true },
      requireBusinessAccount:{ type: Boolean, default: true },
      requireContactInfo:    { type: Boolean, default: false },
      excludeVerified:       { type: Boolean, default: true },
      excludePrivate:        { type: Boolean, default: true },

      minFollowers: { type: Number, default: 500 },
      maxFollowers: { type: Number, default: 50000 },
      minPosts:     { type: Number, default: 9 },

      /** Skip accounts with no post in this many days (0 = no activity check) */
      activeWithinDays: { type: Number, default: 60 },

      bioKeywords:     [String],   // must contain at least one, if set
      excludeKeywords: [String],   // reject if any appear in bio or name
    },

    /** Stop discovery once this many qualifying leads exist */
    targetLeadCount: { type: Number, default: 100 },

    // ── What you are selling (feeds AI drafting) ───────────────────────────
    offer: {
      what:        { type: String, default: '', maxlength: 500 },   // "I build websites for small food businesses"
      painPoint:   { type: String, default: '', maxlength: 500 },   // "no website = losing orders to competitors"
      proof:       { type: String, default: '', maxlength: 500 },   // "built 12 sites for Lagos bakeries"
      callToAction:{ type: String, default: '', maxlength: 300 },   // "open to a 10-min call this week?"
    },

    /** Ideal customer profile, free text. Sharpens DeepSeek qualification. */
    icp: { type: String, default: '', maxlength: 1000 },

    // ── Sending behaviour ──────────────────────────────────────────────────
    messageSettings: {
      /** false = review queue (default). true = drafts send themselves. */
      autoSend:   { type: Boolean, default: false },
      dailyCap:   { type: Number,  default: 20 },
      /** Local hours, 24h. DMs only go out inside this window. */
      sendWindow: {
        start: { type: Number, default: 9 },
        end:   { type: Number, default: 18 },
      },
      timezone:   { type: String, default: 'Africa/Lagos' },
      /** Ramp sends up over the first days instead of hitting the cap on day 1 */
      useWarmup:  { type: Boolean, default: true },
    },

    // ── Run bookkeeping ────────────────────────────────────────────────────
    stats: {
      discovered: { type: Number, default: 0 },
      enriched:   { type: Number, default: 0 },
      qualified:  { type: Number, default: 0 },
      drafted:    { type: Number, default: 0 },
      approved:   { type: Number, default: 0 },
      sent:       { type: Number, default: 0 },
      replied:    { type: Number, default: 0 },
      skipped:    { type: Number, default: 0 },
      failed:     { type: Number, default: 0 },
    },

    /** Sends made today, reset nightly. Enforces dailyCap independent of leads. */
    sentToday:      { type: Number, default: 0 },
    sentTodayResetAt:{ type: Date,  default: () => new Date() },
    /** First send date, anchors the warmup ramp */
    firstSentAt:    { type: Date, default: null },

    /**
     * Live progress for the running discovery job.
     *
     * Discovery takes minutes and previously surfaced nothing but a spinner,
     * so there was no way to tell a slow run from a stuck one. Written
     * throughout the run and polled by the UI.
     */
    progress: {
      phase:   { type: String, enum: ['idle', 'planning', 'collecting', 'enriching', 'saving', 'drafting', 'done', 'error'], default: 'idle' },
      message: { type: String, default: '' },
      current: { type: Number, default: 0 },
      total:   { type: Number, default: 0 },
      /** Rolling detail so the user sees it is actually moving */
      detail:  { type: String, default: '' },
      updatedAt: { type: Date, default: null },
    },

    /**
     * Consecutive discovery runs that produced no new leads. Stops the
     * auto-continue loop once a niche is exhausted rather than retrying forever.
     */
    emptyRuns: { type: Number, default: 0 },
    /** Set when another discovery run is queued to continue toward the target */
    continuesAt: { type: Date, default: null },

    lastDiscoveryAt: { type: Date, default: null },
    lastError:       { type: String, default: null },
  },
  { timestamps: true }
)

leadCampaignSchema.index({ user: 1, status: 1 })

module.exports = mongoose.model('LeadCampaign', leadCampaignSchema)
