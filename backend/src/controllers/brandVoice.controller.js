const BrandVoice = require('../models/BrandVoice')
const { ok, notFound } = require('../utils/apiResponse')

const getBrandVoice = async (req, res) => {
  const doc = await BrandVoice.findOne({ user: req.user._id })
  ok(res, { brandVoice: doc || null })
}

const saveBrandVoice = async (req, res) => {
  const fields = ['brandName', 'industry', 'tagline', 'targetAudience', 'brandValues', 'toneKeywords', 'competitorBrands', 'sampleContent', 'styleNotes']
  const update = {}
  fields.forEach((f) => { if (req.body[f] !== undefined) update[f] = req.body[f] })
  update.isGenerated = false  // mark as stale until AI regenerates

  const doc = await BrandVoice.findOneAndUpdate(
    { user: req.user._id },
    { user: req.user._id, ...update },
    { upsert: true, new: true }
  )
  ok(res, { brandVoice: doc }, 'Brand voice saved')
}

const deleteBrandVoice = async (req, res) => {
  await BrandVoice.findOneAndDelete({ user: req.user._id })
  ok(res, {}, 'Brand voice deleted')
}

module.exports = { getBrandVoice, saveBrandVoice, deleteBrandVoice }
