/**
 * Miscellaneous utility helpers shared across the backend.
 */

/** Sleep for `ms` milliseconds */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Random integer between min and max (inclusive) */
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

/** Random float between min and max */
const randFloat = (min, max) => Math.random() * (max - min) + min

/** Shuffle an array (Fisher-Yates) */
const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Pick a random element from an array */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

/** Clamp a number between min and max */
const clamp = (n, min, max) => Math.min(Math.max(n, min), max)

/** Truncate a string to maxLen and append ellipsis if needed */
const truncate = (str, maxLen) =>
  str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str

/** Parse safe JSON, return null on failure */
const safeJson = (str) => {
  try { return JSON.parse(str) } catch { return null }
}

/**
 * Extract the first JSON array or object from a string.
 * Useful when an LLM wraps JSON in markdown code fences.
 */
const extractJson = (text) => {
  // Try direct parse first
  try { return JSON.parse(text) } catch { /* fall through */ }
  // Strip markdown fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()) } catch { /* fall through */ }
  }
  // Find first { or [
  const start = text.search(/[\[{]/)
  if (start === -1) return null
  const snippet = text.slice(start)
  const end = snippet.lastIndexOf(snippet[0] === '[' ? ']' : '}')
  if (end === -1) return null
  try { return JSON.parse(snippet.slice(0, end + 1)) } catch { return null }
}

/** Format bytes to human-readable size string */
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/** Get platform-specific character limits */
const PLATFORM_LIMITS = {
  x: { post: 280, reply: 280 },
  linkedin: { post: 3000 },
  instagram: { caption: 2200 },
}

/** Validate platform name */
const isValidPlatform = (p) => ['x', 'linkedin', 'instagram'].includes(p)

module.exports = {
  sleep, randInt, randFloat, shuffle, pick, clamp,
  truncate, safeJson, extractJson, formatBytes,
  PLATFORM_LIMITS, isValidPlatform,
}
