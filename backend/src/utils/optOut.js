// ─── Opt out detection ───
//
// Pure and dependency free so it can be tested properly, because a miss here is
// the most expensive bug in the outreach system: it means messaging someone who
// told you to stop.
//
// Two rules shape everything below:
//
//   1. Bias toward false positives. Wrongly marking someone as opted out costs
//      one lead. Wrongly continuing to message someone who said stop costs a
//      complaint, a block, and a step toward losing the number entirely.
//   2. Match how people actually reply here, not just how a US SMS compliance
//      doc says they do. "abeg stop", "no dey message me", "commot" and plain
//      "fuck off" all mean the same thing and none appear in the standard list.

// Standalone words that mean stop when they are essentially the whole message.
// Matched only against short replies, because "I had to stop by the shop" is not
// an opt out.
const STANDALONE_KEYWORDS = [
  'stop',
  'stopp',
  'unsubscribe',
  'unsub',
  'optout',
  'opt-out',
  'cancel',
  'quit',
  'end',
  'remove',
  'delete',
  'commot',
  'comot'
]

// Phrases that mean stop wherever they appear in a message.
const STOP_PHRASES = [
  'stop messaging',
  'stop texting',
  'stop sending',
  'stop contacting',
  'stop disturbing',
  'do not message',
  "don't message",
  'dont message',
  'do not contact',
  "don't contact",
  'dont contact',
  'do not text',
  "don't text",
  'dont text',
  'not interested',
  'no longer interested',
  'leave me alone',
  'remove me',
  'take me off',
  'unsubscribe me',
  'opt me out',
  'no dey message',
  'no dey text',
  'no dey disturb',
  'stop dey message',
  'abeg stop',
  'abeg leave',
  'i no want',
  'i nor want',
  'no send me',
  'make you stop',
  'fuck off',
  'piss off',
  'go away',
  'report you',
  'block you',
  'reporting you',
  'na scam',
  'this is spam',
  'na spam'
]

// A reply this short that contains a standalone keyword is an opt out. Longer
// messages need a phrase match, which is what stops "stop by anytime" from
// closing a live conversation.
const STANDALONE_MAX_WORDS = 3

const normalize = text =>
  String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Returns { optedOut, matched, confidence }. matched names the trigger so a
// human reviewing a wrongly closed conversation can see exactly why.
const detectOptOut = text => {
  const normalized = normalize(text)

  if (!normalized) return { optedOut: false, matched: null, confidence: 0 }

  for (const phrase of STOP_PHRASES) {
    if (normalized.includes(phrase)) {
      return { optedOut: true, matched: phrase, confidence: 1 }
    }
  }

  const words = normalized.split(' ')

  if (words.length <= STANDALONE_MAX_WORDS) {
    for (const keyword of STANDALONE_KEYWORDS) {
      if (words.includes(keyword)) {
        return { optedOut: true, matched: keyword, confidence: 0.9 }
      }
    }
  }

  return { optedOut: false, matched: null, confidence: 0 }
}

module.exports = { detectOptOut, STOP_PHRASES, STANDALONE_KEYWORDS }
