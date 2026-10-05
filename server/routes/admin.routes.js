const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../utils/constants');

const adminOnly = [verifyToken, authorizeRoles(ROLES.ADMIN)];

router.get('/team-leads', ...adminOnly, adminController.getTeamLeads);
router.get('/users', ...adminOnly, adminController.getAllUsers);
router.patch('/users/:id/toggle', ...adminOnly, adminController.toggleUserActive);
router.patch('/users/:id', ...adminOnly, adminController.updateUser);
router.patch('/users/:id/status', ...adminOnly, adminController.toggleUserStatus);
router.delete('/users/:id', ...adminOnly, adminController.deleteUser);
router.get('/stats', ...adminOnly, adminController.getStats);

router.get('/reports/pending-leads', ...adminOnly, adminController.getPendingReportLeads);
router.get('/reports', ...adminOnly, adminController.getReports);
router.patch('/reports/:id/read', ...adminOnly, adminController.markReportRead);
router.post('/reports/:id/request', ...adminOnly, adminController.requestReport);

router.get('/analytics/kpis', ...adminOnly, adminController.getAnalyticsKPIs);
router.get('/analytics/trend', ...adminOnly, adminController.getAnalyticsTrend);
router.get('/analytics/verification', ...adminOnly, adminController.getVerificationStatus);
router.get('/analytics/team-comparison', ...adminOnly, adminController.getTeamComparison);
router.get('/analytics/task-type', ...adminOnly, adminController.getTaskTypeAttendance);
router.get('/analytics/monthly-compare', ...adminOnly, adminController.getMonthlyComparison);
router.get('/analytics/raw', ...adminOnly, adminController.getRawAttendanceData);

router.get('/leave/calendar', ...adminOnly, adminController.getLeaveCalendar);
router.get('/leave/summary', ...adminOnly, adminController.getLeaveSummary);
router.get('/leave/records', ...adminOnly, adminController.getLeaveRecords);

router.get('/overview', ...adminOnly, adminController.getOverviewStats);
router.get('/attendance-trend', ...adminOnly, adminController.getAttendanceTrend);
router.get('/tasks-by-type', ...adminOnly, adminController.getTasksByType);
router.get('/active-teamleads', ...adminOnly, adminController.getActiveTeamLeads);
router.get('/impact-metrics', ...adminOnly, adminController.getImpactMetrics);
router.get('/system-alerts', ...adminOnly, adminController.getSystemAlerts);

module.exports = router;
