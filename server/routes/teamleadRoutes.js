const express = require('express');
const teamleadController = require('../controllers/teamleadController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
const guard = [verifyToken, authorizeRoles(ROLES.TEAM_LEAD)];

router.get('/dashboard-summary', ...guard, teamleadController.getDashboardSummary);
router.get('/tasks', ...guard, teamleadController.getTasks);
router.post('/tasks', ...guard, teamleadController.createTask);
router.get('/tasks/:taskId', ...guard, teamleadController.getTaskById);
router.patch('/tasks/:taskId/status', ...guard, teamleadController.updateTaskStatus);
router.get('/available-workers', ...guard, teamleadController.getAvailableWorkers);
router.get('/location-search', ...guard, teamleadController.searchLocation);
router.get('/leave-requests', ...guard, teamleadController.getLeaveRequests);
router.patch('/leave-requests/:leaveId', ...guard, teamleadController.updateLeaveStatus);
router.get('/attendance', ...guard, teamleadController.getAttendance);
router.get('/attendance/flagged', ...guard, teamleadController.getFlaggedRecords);
router.patch('/attendance/flagged/:recordId/resolve', ...guard, teamleadController.resolveFlaggedRecord);
router.post('/attendance/:recordId/resolve', ...guard, teamleadController.resolveFlaggedRecord);
router.get('/field-reports', ...guard, teamleadController.getFieldReports);
router.get('/field-reports/:reportId', ...guard, teamleadController.getFieldReportById);
router.post('/field-reports/:reportId/forward', ...guard, teamleadController.forwardReportToAdmin);

module.exports = router;
