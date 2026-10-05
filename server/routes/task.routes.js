const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../utils/constants');

router.post('/create', verifyToken, authorizeRoles(ROLES.TEAM_LEAD, ROLES.ADMIN), taskController.create);
router.get('/worker', verifyToken, taskController.getWorkerTasks);
router.get('/all', verifyToken, authorizeRoles(ROLES.TEAM_LEAD, ROLES.ADMIN), taskController.getAll);

module.exports = router;
