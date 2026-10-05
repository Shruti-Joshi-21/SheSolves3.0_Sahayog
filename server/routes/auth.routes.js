const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const multer = require('multer');
const { faceStorage } = require('../config/cloudinary');
const { verifyToken } = require('../middlewares/authMiddleware');

const upload = multer({
  storage: faceStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Only jpeg/jpg/png files are allowed'));
  },
});

router.post(
  '/signup/field-worker',
  upload.single('faceImage'),
  authController.signupFieldWorker
);

router.post('/signup/team-lead', authController.signupTeamLead);
router.post('/signup/admin', authController.signupAdmin);
router.post('/login', authController.login);
router.get('/me', verifyToken, authController.getMe);

module.exports = router;