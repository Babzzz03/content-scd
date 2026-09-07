const multer = require('multer')
const { CloudinaryStorage } = require('multer-storage-cloudinary')
const cloudinary = require('cloudinary').v2
const { badRequest } = require('../utils/apiResponse')

// ─── Configure Cloudinary ─────────────────────────────────────────────────────

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// ─── Cloudinary storage engine ────────────────────────────────────────────────

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith('video/')
    return {
      folder:         'postflow/uploads',
      resource_type:  isVideo ? 'video' : 'image',
      // Use original filename stem as public_id prefix for readability
      public_id:      `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, '').replace(/\s+/g, '_')}`,
      // Cloudinary will normalise format automatically
      transformation: isVideo ? [] : [{ quality: 'auto', fetch_format: 'auto' }],
    }
  },
})

// ─── File filter ──────────────────────────────────────────────────────────────

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime']
  if (allowed.includes(file.mimetype)) return cb(null, true)
  cb(new Error(`File type ${file.mimetype} not allowed`), false)
}

const maxMb = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10)

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxMb * 1024 * 1024 },
})

// ─── Error wrapper ────────────────────────────────────────────────────────────

const handleUploadError = (uploadMiddleware) => (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (!err) return next()
    if (err instanceof multer.MulterError) {
      return badRequest(res, err.message === 'LIMIT_FILE_SIZE'
        ? `File too large — max ${maxMb} MB`
        : err.message)
    }
    return badRequest(res, err.message || 'Upload failed')
  })
}

module.exports = { upload, handleUploadError, cloudinary }
