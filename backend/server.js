require('dotenv').config()
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const morgan = require('morgan')

const { connect: connectDB } = require('./src/config/database')
const logger = require('./src/utils/logger')
const { ok, error: apiError } = require('./src/utils/apiResponse')
const routes = require('./src/routes')
const { initAgenda } = require('./src/jobs/agenda')
const { recoverStuckPosts } = require('./src/jobs/postScheduler.job')

// ─── App ──────────────────────────────────────────────────────────────────────
const app = express()

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3001',
]
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}))

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ─── HTTP logging ─────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev', { stream: { write: (msg) => logger.http(msg.trim()) } }))
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', routes)

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => ok(res, { uptime: process.uptime() }, 'OK'))

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => apiError(res, `Route ${req.method} ${req.path} not found`, 404))

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { message: err.message, stack: err.stack })
  const statusCode = err.statusCode || err.status || 500
  apiError(res, err.message || 'Internal server error', statusCode)
})

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '5000', 10)

;(async () => {
  try {
    await connectDB()
    await recoverStuckPosts()
    await initAgenda()
    app.listen(PORT, () => {
      logger.info(`PostFlow API running on port ${PORT} [${process.env.NODE_ENV}]`)
    })
  } catch (err) {
    logger.error('Failed to start server', { err: err.message })
    process.exit(1)
  }
})()

module.exports = app
