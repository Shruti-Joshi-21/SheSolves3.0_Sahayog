const express = require('express');
const impactController = require('../controllers/impact.controller');

// Public, read-only routes — no login. Never return personal data from here.
const router = express.Router();

router.get('/impact', impactController.getImpact);

module.exports = router;
