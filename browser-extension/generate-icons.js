// Run once with: node generate-icons.js
// Generates PNG icons from an SVG using the Canvas API (Node.js built-in via sharp or jimp)
// If you don't have canvas, just use any 16x16, 48x48, 128x128 PNG images named accordingly.

// Fallback: this script writes minimal valid 1x1 PNGs so the extension loads without error.
// Replace icons/icon*.png with real artwork before publishing.

const fs = require("fs")
const path = require("path")

// Minimal valid 1×1 transparent PNG (base64)
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
)

const sizes = [16, 48, 128]
const iconsDir = path.join(__dirname, "icons")

if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir)

for (const size of sizes) {
  const file = path.join(iconsDir, `icon${size}.png`)
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, TINY_PNG)
    console.log(`Created placeholder ${file}`)
  } else {
    console.log(`Skipped (exists): ${file}`)
  }
}

console.log("\nDone. Replace icons/ with real artwork before publishing to the Chrome Web Store.")
