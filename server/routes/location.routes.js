const express = require('express');
const router = express.Router();
const locationController = require('../controllers/location.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../utils/constants');

router.get('/search', verifyToken, authorizeRoles(ROLES.TEAM_LEAD, ROLES.ADMIN), locationController.searchLocation);
router.post('/save', verifyToken, authorizeRoles(ROLES.TEAM_LEAD, ROLES.ADMIN), locationController.saveLocation);
router.get('/', verifyToken, locationController.getLocations);

module.exports = router;
