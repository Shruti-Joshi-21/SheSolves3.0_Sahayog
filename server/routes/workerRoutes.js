// Slow venue DNS (~11s/lookup) was timing out Cloudinary uploads — see utils/fastDns.js.
// TODO: move this require to the top of index.js (shared file) so it covers every route.
require('../utils/fastDns');
const express = require('express');
const multer = require('multer');
const router = express.Router();
const workerController = require('../controllers/workerController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../utils/constants');
const { attendanceStorage, reportStorage } = require('../config/cloudinary');
const { sendError } = require('../utils/response');

function badRequest(msg) {
  const e = new Error(msg);
  e.statusCode = 400;
  return e;
}

const attendanceImageMimes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/pjpeg',
  'image/webp',
];

// Both faceImage and fieldImage go to sevasetu/attendance on Cloudinary
const attendanceMulter = multer({
  storage: attendanceStorage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (attendanceImageMimes.includes(file.mimetype)) return cb(null, true);
    cb(badRequest(`Unsupported image type (${file.mimetype || 'unknown'}). Use JPEG, PNG, or WebP.`));
  },
}).fields([
  { name: 'faceImage', maxCount: 1 },
  { name: 'fieldImage', maxCount: 1 },
  { name: 'livenessFrame', maxCount: 1 }, // optional 2nd face frame for the liveness check
]);

// Cloudinary upload errors are plain objects ({ name: 'TimeoutError', http_code: 499 }) that the
// global handler turns into a vague 500 — answer with something the worker can act on instead.
function attendanceUpload(req, res, next) {
  attendanceMulter(req, res, (err) => {
    if (!err) return next();
    if (err.http_code || err.name === 'TimeoutError') {
      console.error('[attendance upload] Cloudinary error:', err.name, err.http_code, err.message);
      const timedOut = err.name === 'TimeoutError' || err.http_code === 499;
      return sendError(
        res,
        timedOut
          ? 'Photo upload timed out — slow network. Please try again.'
          : 'Photo upload failed. Please try again.',
        timedOut ? 504 : 502
      );
    }
    return next(err);
  });
}

const reportUpload = multer({
  storage: reportStorage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (attendanceImageMimes.includes(file.mimetype)) return cb(null, true);
    cb(badRequest(`Unsupported image type (${file.mimetype || 'unknown'}). Use JPEG, PNG, or WebP.`));
  },
}).array('images', 5);


router.get('/dashboard', verifyToken, authorizeRoles(ROLES.FIELD_WORKER), workerController.getDashboardData);
router.get(
  '/tasks/all',
  verifyToken,
  authorizeRoles(ROLES.FIELD_WORKER),
  workerController.getAllWorkerTasks
);
router.get(
  '/attendance/today',
  verifyToken,
  authorizeRoles(ROLES.FIELD_WORKER),
  workerController.getTodayAttendance
);
router.get(
  '/attendance/history',
  verifyToken,
  authorizeRoles(ROLES.FIELD_WORKER),
  workerController.getAttendanceHistory
);
router.get(
  '/attendance/:id',
  verifyToken,
  authorizeRoles(ROLES.FIELD_WORKER),
  workerController.getAttendanceDetail
);
router.post('/checkin', verifyToken, authorizeRoles(ROLES.FIELD_WORKER), attendanceUpload, workerController.checkIn);
router.post('/checkout', verifyToken, authorizeRoles(ROLES.FIELD_WORKER), attendanceUpload, workerController.checkOut);

router.get('/leave', verifyToken, authorizeRoles(ROLES.FIELD_WORKER), workerController.getLeaveRequests);
router.post('/leave', verifyToken, authorizeRoles(ROLES.FIELD_WORKER), workerController.submitLeaveRequest);
router.delete('/leave/:id', verifyToken, authorizeRoles(ROLES.FIELD_WORKER), workerController.cancelLeaveRequest);

router.get('/tasks', verifyToken, authorizeRoles(ROLES.FIELD_WORKER), workerController.getWorkerTasks);
router.get('/reports', verifyToken, authorizeRoles(ROLES.FIELD_WORKER), workerController.getReports);
router.post(
  '/reports',
  verifyToken,
  authorizeRoles(ROLES.FIELD_WORKER),
  reportUpload,
  workerController.submitReport
);
router.get('/reports/:id', verifyToken, authorizeRoles(ROLES.FIELD_WORKER), workerController.getReportDetail);

module.exports = router;
