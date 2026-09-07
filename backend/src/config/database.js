const mongoose = require('mongoose')
const logger = require('../utils/logger')

const connect = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/postflow'
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  })
  logger.info(`MongoDB connected: ${mongoose.connection.host}`)
}

mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'))
mongoose.connection.on('error', (err) => logger.error('MongoDB error', { err: err.message }))

module.exports = { connect }
