const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const { verifyToken } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/upload.middleware');

// GET /api/attendance/...
router.get('/current/:taskId', verifyToken, attendanceController.getCurrentAttendance);
router.get('/all', verifyToken, attendanceController.getAllAttendance);

// POST /api/attendance/...
// Legacy check-in / check-out disabled — face + attendance flow uses /api/worker/checkin|checkout + Python /verify-face
// router.post('/check-in', verifyToken, upload.single('face'), attendanceController.checkIn);
// router.post('/check-out', verifyToken, upload.single('face'), attendanceController.checkOut);
router.post('/report', verifyToken, upload.array('images', 5), attendanceController.submitReport);

// PATCH /api/attendance/...
router.patch('/:id/review', verifyToken, attendanceController.reviewAttendance);

module.exports = router;
