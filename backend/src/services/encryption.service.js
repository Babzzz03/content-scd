/**
 * AES-256-GCM encryption for storing sensitive credentials at rest.
 * The key is read from ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 */
const crypto = require('crypto')

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16   // bytes
const TAG_LENGTH = 16  // bytes

const getKey = () => {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypt a plain-text string.
 * Returns a base64 string: iv:ciphertext:authTag
 */
const encrypt = (plaintext) => {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv, { authTagLength: TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, encrypted, tag].map((b) => b.toString('base64')).join(':')
}

/**
 * Decrypt a string produced by `encrypt`.
 */
const decrypt = (ciphertext) => {
  const [ivB64, dataB64, tagB64] = ciphertext.split(':')
  if (!ivB64 || !dataB64 || !tagB64) throw new Error('Invalid ciphertext format')
  const iv = Buffer.from(ivB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv, { authTagLength: TAG_LENGTH })
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

/**
 * Encrypt a plain JS object as JSON.
 */
const encryptObject = (obj) => encrypt(JSON.stringify(obj))

/**
 * Decrypt and JSON.parse back to object.
 */
const decryptObject = (ciphertext) => JSON.parse(decrypt(ciphertext))

module.exports = { encrypt, decrypt, encryptObject, decryptObject }
