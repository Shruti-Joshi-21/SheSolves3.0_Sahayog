const multer = require('multer');
const { attendanceStorage, reportStorage } = require('../config/cloudinary');

// Generic upload for legacy routes that use .array('images', 5)
// (e.g. attendance.routes.js POST /report)
const upload = multer({
  storage: reportStorage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/pjpeg'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new Error(`Unsupported image type: ${file.mimetype}`));
  },
});

module.exports = upload;

