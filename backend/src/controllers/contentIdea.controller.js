const ContentIdea = require('../models/ContentIdea')
const { ok, created, notFound } = require('../utils/apiResponse')

const listIdeas = async (req, res) => {
  const { type, isSaved, platform, page = 1, limit = 20 } = req.query
  const filter = { user: req.user._id }
  if (type) filter.type = type
  if (isSaved !== undefined) filter.isSaved = isSaved === 'true'
  if (platform) filter.platform = platform

  const total = await ContentIdea.countDocuments(filter)
  const ideas = await ContentIdea.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean()

  ok(res, { ideas, total, page: Number(page), pages: Math.ceil(total / limit) })
}

const saveIdeas = async (req, res) => {
  const { ideas } = req.body   // array of idea objects from generate controller
  if (!Array.isArray(ideas) || ideas.length === 0) {
    return require('../utils/apiResponse').badRequest(res, 'ideas array is required')
  }

  const docs = await ContentIdea.insertMany(
    ideas.map((idea) => ({ ...idea, user: req.user._id }))
  )
  created(res, { ideas: docs }, `${docs.length} ideas saved`)
}

const toggleSaved = async (req, res) => {
  const idea = await ContentIdea.findOne({ _id: req.params.id, user: req.user._id })
  if (!idea) return notFound(res, 'Idea not found')
  idea.isSaved = !idea.isSaved
  await idea.save()
  ok(res, { idea }, `Idea ${idea.isSaved ? 'saved' : 'unsaved'}`)
}

const deleteIdea = async (req, res) => {
  await ContentIdea.findOneAndDelete({ _id: req.params.id, user: req.user._id })
  ok(res, {}, 'Idea deleted')
}

module.exports = { listIdeas, saveIdeas, toggleSaved, deleteIdea }
