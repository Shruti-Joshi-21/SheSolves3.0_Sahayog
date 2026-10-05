const teamleadService = require('../services/teamlead.service');
const { sendSuccess, sendError } = require('../utils/response');
const { LEAVE_STATUS } = require('../utils/constants');

const getTeamLeadId = (req) => req.user?._id || req.user?.userId;

const getDashboardSummary = async (req, res, next) => {
  try {
    const teamLeadId = getTeamLeadId(req);
    const data = await teamleadService.getTeamLeadDashboardData(teamLeadId);
    return sendSuccess(res, data, 'Dashboard summary fetched');
  } catch (error) {
    return next(error);
  }
};

const getTasks = async (req, res, next) => {
  try {
    const data = await teamleadService.getTasks(getTeamLeadId(req));
    return sendSuccess(res, data, 'Tasks fetched');
  } catch (error) {
    return next(error);
  }
};

const createTask = async (req, res, next) => {
  try {
    const required = ['title', 'locationName', 'latitude', 'longitude', 'allowedRadius', 'date', 'startTime', 'endTime', 'workType'];
    const missing = required.filter((key) => req.body[key] == null || req.body[key] === '');
    if (missing.length) return sendError(res, `Missing required fields: ${missing.join(', ')}`, 400);
    const created = await teamleadService.createTask(getTeamLeadId(req), req.body);
    return sendSuccess(res, created, 'Task created', 201);
  } catch (error) {
    return next(error);
  }
};

const getTaskById = async (req, res, next) => {
  try {
    const task = await teamleadService.getTaskById(getTeamLeadId(req), req.params.taskId);
    if (!task) return sendError(res, 'Task not found', 404);
    return sendSuccess(res, task, 'Task fetched');
  } catch (error) {
    return next(error);
  }
};

const updateTaskStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'COMPLETED', 'CANCELLED'].includes(status)) return sendError(res, 'Invalid task status', 400);
    const task = await teamleadService.updateTaskStatus(getTeamLeadId(req), req.params.taskId, status);
    if (!task) return sendError(res, 'Task not found', 404);
    return sendSuccess(res, task, 'Task status updated');
  } catch (error) {
    return next(error);
  }
};

const getAvailableWorkers = async (req, res, next) => {
  try {
    const { date, startTime, endTime } = req.query;
    if (!date || !startTime || !endTime) return sendError(res, 'date, startTime and endTime are required', 400);
    const data = await teamleadService.getAvailableWorkers(getTeamLeadId(req), date, startTime, endTime);
    return sendSuccess(res, data, 'Available workers fetched');
  } catch (error) {
    return next(error);
  }
};

const searchLocation = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 3) return sendError(res, 'Search query must be at least 3 characters', 400);
    const data = await teamleadService.searchLocation(q);
    return sendSuccess(res, data, 'Location search completed');
  } catch (error) {
    return next(error);
  }
};

const getLeaveRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    if (status && !Object.values(LEAVE_STATUS).includes(status)) return sendError(res, 'Invalid leave status filter', 400);
    const data = await teamleadService.getLeaveRequests(getTeamLeadId(req), status);
    return sendSuccess(res, data, 'Leave requests fetched');
  } catch (error) {
    return next(error);
  }
};

const updateLeaveStatus = async (req, res, next) => {
  try {
    const { status, remark } = req.body;
    if (![LEAVE_STATUS.APPROVED, LEAVE_STATUS.REJECTED].includes(status)) return sendError(res, 'Invalid leave status', 400);
    const data = await teamleadService.updateLeaveStatus(getTeamLeadId(req), req.params.leaveId, status, remark);
    if (data === null) return sendError(res, 'Leave request not found', 404);
    if (data === false) return sendError(res, 'Forbidden', 403);
    return sendSuccess(res, data, 'Leave request updated');
  } catch (error) {
    return next(error);
  }
};

const getAttendance = async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const data = await teamleadService.getAttendance(getTeamLeadId(req), date);
    return sendSuccess(res, data, 'Attendance fetched');
  } catch (error) {
    return next(error);
  }
};

const getFlaggedRecords = async (req, res, next) => {
  try {
    const data = await teamleadService.getFlaggedRecords(getTeamLeadId(req));
    return sendSuccess(res, data, 'Flagged records fetched');
  } catch (error) {
    return next(error);
  }
};

const resolveFlaggedRecord = async (req, res, next) => {
  try {
    const { action, remark } = req.body;
    if (!['APPROVE', 'REJECT'].includes(action)) return sendError(res, 'Invalid action', 400);
    const data = await teamleadService.resolveFlaggedRecord(getTeamLeadId(req), req.params.recordId, action, remark);
    if (data === null) return sendError(res, 'Flagged record not found', 404);
    if (data === false) return sendError(res, 'Forbidden', 403);
    return sendSuccess(res, data, 'Flagged record resolved');
  } catch (error) {
    return next(error);
  }
};

const getFieldReports = async (req, res, next) => {
  try {
    const data = await teamleadService.getFieldReports(getTeamLeadId(req), req.query.status);
    return sendSuccess(res, data, 'Field reports fetched');
  } catch (error) {
    return next(error);
  }
};

const getFieldReportById = async (req, res, next) => {
  try {
    const data = await teamleadService.getFieldReportById(getTeamLeadId(req), req.params.reportId);
    if (data === null) return sendError(res, 'Report not found', 404);
    if (data === false) return sendError(res, 'Forbidden', 403);
    return sendSuccess(res, data, 'Field report fetched');
  } catch (error) {
    return next(error);
  }
};

const forwardReportToAdmin = async (req, res, next) => {
  try {
    const summary = String(req.body.summary || '').trim();
    if (summary.length < 10) return sendError(res, 'Summary must be at least 10 characters', 400);
    const data = await teamleadService.forwardReportToAdmin(getTeamLeadId(req), req.params.reportId, summary);
    if (data === null) return sendError(res, 'Report not found', 404);
    if (data === false) return sendError(res, 'Forbidden', 403);
    return sendSuccess(res, data, 'Report forwarded to admin');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getDashboardSummary,
  getTasks,
  createTask,
  getTaskById,
  updateTaskStatus,
  getAvailableWorkers,
  searchLocation,
  getLeaveRequests,
  updateLeaveStatus,
  getAttendance,
  getFlaggedRecords,
  resolveFlaggedRecord,
  getFieldReports,
  getFieldReportById,
  forwardReportToAdmin,
};
