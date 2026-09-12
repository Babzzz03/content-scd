/**
 * Cross-source identity matching.
 *
 * The unique index on a Lead keys on (user, source, externalId), so the same
 * business found on Instagram and again on Google Maps is two legitimate rows.
 * That is correct for storage and wrong for outreach: contacting a business by
 * DM and by phone on the same day reads as spam.
 *
 * This computes a loose identity key and links rows that share it. It is
 * deliberately conservative — a false link would suppress a real lead, which is
 * worse than an occasional duplicate — so matching requires either an exact
 * normalised name plus a shared locality token, or a matching phone number.
 */
const Lead = require('../models/Lead')
const logger = require('../utils/logger')

/** Legal suffixes and filler that differ between listings for one business. */
const NOISE = /\b(ltd|limited|llc|inc|enterprises?|ventures?|nigeria|ng|company|co|and|the|by|official|store|shop)\b/g

/**
 * Normalise a business name to a comparison key.
 * "Cecil's Patisserie Ltd" and "cecils patisserie" both become "cecilspatisserie".
 */
const normaliseName = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(NOISE, ' ')
    .replace(/\s+/g, '')
    .trim()

/** Last 9 digits, which survives +234 / 0 prefix differences. */
const normalisePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '')
  return digits.length >= 9 ? digits.slice(-9) : ''
}

/** Identity key stored on the lead for cheap candidate lookup. */
const buildIdentityKey = (lead) => {
  const name = normaliseName(lead.fullName || lead.username)
  return name || ''
}

/**
 * Find existing leads that look like the same business.
 * Returns [] rather than guessing when the signals are weak.
 */
const findMatches = async (lead) => {
  const key = buildIdentityKey(lead)
  const phone = normalisePhone(lead.google?.phone || lead.contact?.phone)
  if (!key && !phone) return []

  const candidates = await Lead.find({
    user: lead.user,
    _id: { $ne: lead._id },
    $or: [
      ...(key ? [{ identityKey: key }] : []),
      ...(phone ? [{ 'contact.phone': { $regex: `${phone}$` } }] : []),
    ],
  }).limit(10)

  return candidates.filter((c) => {
    // A shared phone number is strong enough on its own
    const cPhone = normalisePhone(c.google?.phone || c.contact?.phone)
    if (phone && cPhone && phone === cPhone) return true

    // Name alone is not: "Cakes and Cream Opebi" and "Cakes and Cream Lekki"
    // are different branches. Require a shared locality token too.
    if (key && c.identityKey === key) {
      const locA = `${lead.location || ''} ${lead.google?.formattedAddress || ''}`.toLowerCase()
      const locB = `${c.location || ''} ${c.google?.formattedAddress || ''}`.toLowerCase()
      if (!locA.trim() || !locB.trim()) return false
      const tokens = locA.split(/\W+/).filter((t) => t.length > 3)
      return tokens.some((t) => locB.includes(t))
    }
    return false
  })
}

/**
 * Link a lead to any duplicates of the same business, in both directions.
 * Returns the linked leads so callers can warn before contacting.
 */
const linkDuplicates = async (leadId) => {
  const lead = await Lead.findById(leadId)
  if (!lead) return []

  lead.identityKey = buildIdentityKey(lead)
  const matches = await findMatches(lead)

  if (matches.length) {
    lead.linkedLeads = matches.map((m) => m._id)
    for (const m of matches) {
      if (!m.linkedLeads.some((id) => String(id) === String(lead._id))) {
        m.linkedLeads.push(lead._id)
        await m.save()
      }
    }
    logger.info('leadIdentity: linked duplicate business across sources', {
      lead: lead.fullName || lead.username,
      matches: matches.map((m) => `${m.source}:${m.username || m.fullName}`),
    })
  }

  await lead.save()
  return matches
}

/**
 * Has this business already been contacted through any source?
 * The guard that stops a DM and a phone call landing the same afternoon.
 */
const alreadyContacted = async (lead) => {
  const CONTACTED = ['messaged', 'replied', 'contacted', 'won', 'lost', 'opted_out']
  if (!lead.linkedLeads?.length) return null

  const siblings = await Lead.find({ _id: { $in: lead.linkedLeads } })
  return siblings.find((s) => CONTACTED.includes(s.status)) || null
}

module.exports = { normaliseName, normalisePhone, buildIdentityKey, findMatches, linkDuplicates, alreadyContacted }
