/**
 * Application-wide constants.
 * Keep all plan limits and feature flags here so they're easy to change.
 */

const PLANS = {
  free: {
    label: 'Free',
    priceMonthly: 0,
    postsPerMonth: 10,
    aiGenerationsPerMonth: 20,
    platforms: 3,
    scheduling: false,
    automation: false,
    brandVoice: false,
    contentIdeas: 5,
    leads: false,
    leadsPerMonth: 0,
  },
  starter: {
    label: 'Starter',
    priceMonthly: 9,
    postsPerMonth: 60,
    aiGenerationsPerMonth: 150,
    platforms: 2,
    scheduling: true,
    automation: false,
    brandVoice: true,
    contentIdeas: 30,
    leads: false,
    leadsPerMonth: 0,
    paystackPlanCode: process.env.PAYSTACK_STARTER_PLAN_CODE || '',
  },
  pro: {
    label: 'Pro',
    priceMonthly: 29,
    postsPerMonth: -1,       // unlimited
    aiGenerationsPerMonth: -1,
    platforms: 3,
    scheduling: true,
    automation: true,
    brandVoice: true,
    contentIdeas: -1,
    leads: true,
    leadsPerMonth: 1000,
    paystackPlanCode: process.env.PAYSTACK_PRO_PLAN_CODE || '',
  },
  agency: {
    label: 'Agency',
    priceMonthly: 99,
    postsPerMonth: -1,
    aiGenerationsPerMonth: -1,
    platforms: 10,
    scheduling: true,
    automation: true,
    brandVoice: true,
    contentIdeas: -1,
    leads: true,
    leadsPerMonth: -1,
    paystackPlanCode: process.env.PAYSTACK_AGENCY_PLAN_CODE || '',
  },
}

/** Maximum posts the scheduler will attempt to publish per run (prevents runaway) */
const SCHEDULER_BATCH_SIZE = 20

/** Delay ranges for automation (ms) — overridden by env vars if set */
const AUTOMATION = {
  delayMin: parseInt(process.env.AUTOMATION_DELAY_MIN || '800', 10),
  delayMax: parseInt(process.env.AUTOMATION_DELAY_MAX || '3500', 10),
  maxRetries: 3,
  retryBackoffMs: 5000,
  /** Per-platform daily posting limits to avoid flagging */
  dailyLimits: { x: 50, linkedin: 10, instagram: 25 },
}

/**
 * Lead-generation + DM outreach limits.
 *
 * These caps exist to keep the sending account alive. Instagram restricts
 * accounts that DM strangers in bulk, and a restriction is unrecoverable
 * within a campaign. Every number here is deliberately below what Instagram
 * actually tolerates. Raising them raises ban risk, not throughput.
 */
const OUTREACH = {
  dm: {
    /** Per-campaign default and the hard ceiling a user can set in the UI */
    dailyCapDefault: 20,
    dailyCapMax:     40,

    /**
     * Sends allowed on day N of a campaign's sending life (index 0 = day 1).
     * After the array runs out, the campaign's own dailyCap applies.
     * A brand-new account blasting 40 DMs on day one gets flagged immediately.
     */
    warmupSchedule: [5, 8, 12, 16, 20, 25, 30],

    /** Random gap between two DMs. Never send back-to-back. */
    minGapMs: 90 * 1000,
    maxGapMs: 7 * 60 * 1000,

    /** Give up on a lead after this many failed send attempts */
    maxSendAttempts: 2,

    /**
     * If a reply contains any of these, the lead is marked opted_out and is
     * never messaged again by any campaign. Checked case-insensitively.
     */
    optOutKeywords: [
      'stop', 'unsubscribe', 'not interested', 'no thanks', 'no thank you',
      'leave me alone', 'remove me', 'do not contact', "don't contact",
      'fuck off', 'spam', 'reported', 'stop messaging',
    ],
  },

  discovery: {
    /**
     * Profiles enriched per run. Kept below accountHealth's hourly profile
     * budget so a single run can never exhaust it. The earlier value of 60 was
     * more profile views per run than a person performs in an hour, and it is
     * what tripped a 429 during development.
     */
    maxProfilesPerRun: 18,
    /** Candidate usernames collected from grids before enrichment starts */
    maxCandidatesPerRun: 120,
    /** Posts opened per hashtag page */
    postsPerQuery: 12,

    /**
     * Gap between profile visits. Longer than feels necessary on purpose:
     * enrichment may be loading a full page rather than firing an XHR, and a
     * steady 3-second cadence reads as a script.
     */
    profileGapMinMs: 6000,
    profileGapMaxMs: 15000,

    /**
     * Hard cap on DOM-fallback enrichments per run.
     *
     * When the JSON API is throttled, the fallback loads a whole profile page
     * per lead, roughly ten times the traffic of the XHR it replaces. Falling
     * back indefinitely turns an API rate limit into a page-load storm, which
     * is a worse signal than the throttle it was working around. Past this
     * count the run stops and waits for the cooldown instead.
     */
    maxDomFallbacksPerRun: 10,
  },

  /** Bio strings that mean "this account already has a website" */
  websitePattern: /(https?:\/\/|www\.|\.com|\.net|\.org|\.co\b|\.io\b|\.shop\b|linktr\.ee|bit\.ly|beacons\.ai|carrd\.co|wix\.|shopify)/i,
}

const PLATFORMS = ['x', 'linkedin', 'instagram']

module.exports = { PLANS, SCHEDULER_BATCH_SIZE, AUTOMATION, OUTREACH, PLATFORMS }
