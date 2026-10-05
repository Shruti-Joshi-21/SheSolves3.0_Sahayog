const axios = require('axios');
const Task = require('../models/Task');
const User = require('../models/User');
const LeaveRequest = require('../models/LeaveRequest');
const AttendanceRecord = require('../models/AttendanceRecord');
const FieldReport = require('../models/FieldReport');
const TaskAssignment = require('../models/TaskAssignment');
const AdminReport = require('../models/AdminReport');
const { LEAVE_STATUS, ATTENDANCE_STATUS } = require('../utils/constants');
const haversine = require('../utils/haversine');

const toName = (user) => user?.fullName || '';
const initialsFromName = (fullName = '') =>
  fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || '')
    .join('');

const startOfDay = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (d) => {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date;
};

const parseTimeToMinutes = (t = '00:00') => {
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const durationInHours = (start, end) => Math.max(0, (parseTimeToMinutes(end) - parseTimeToMinutes(start)) / 60);

const getWorkersByTeamLead = async (teamLeadId) =>
  User.find({ role: 'FIELD_WORKER', isDeleted: false, assignedTeamLead: teamLeadId }).select('_id fullName').lean();

const getTopWorkTypeByWorkerMap = async (workerIds) => {
  if (!workerIds.length) return {};
  const tasks = await Task.find({ assignedWorkers: { $in: workerIds }, status: 'COMPLETED', isDeleted: false })
    .select('workType assignedWorkers')
    .lean();
  const frequency = {};
  for (const wid of workerIds.map(String)) frequency[wid] = {};
  tasks.forEach((task) => {
    task.assignedWorkers.forEach((id) => {
      const key = String(id);
      if (!frequency[key]) return;
      frequency[key][task.workType] = (frequency[key][task.workType] || 0) + 1;
    });
  });
  const result = {};
  Object.entries(frequency).forEach(([wid, counts]) => {
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    result[wid] = top?.[0] || 'General';
  });
  return result;
};

const getDashboardData = async (teamLeadId) => {
  const workers = await getWorkersByTeamLead(teamLeadId);
  const workerIds = workers.map((w) => w._id);
  const workerIdStrings = workerIds.map(String);

  const [allTasks, todaysTasksRaw, taskStatusAgg, pendingLeaves] = await Promise.all([
    Task.find({ createdBy: teamLeadId, isDeleted: false }).select('_id title workType locationName startTime endTime allowedRadius assignedWorkers status').lean(),
    Task.find({ createdBy: teamLeadId, isDeleted: false, status: 'ACTIVE', date: { $gte: startOfDay(new Date()), $lte: endOfDay(new Date()) } })
      .populate('assignedWorkers', 'fullName')
      .lean(),
    Task.aggregate([
      { $match: { createdBy: teamLeadId, isDeleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    LeaveRequest.countDocuments({ worker: { $in: workerIds }, status: LEAVE_STATUS.PENDING }),
  ]);

  const taskIds = allTasks.map((t) => t._id);
  const todaysAttendance = await AttendanceRecord.find({
    task: { $in: taskIds },
    createdAt: { $gte: startOfDay(new Date()), $lte: endOfDay(new Date()) },
    isDeleted: false,
  })
    .select('_id worker task status')
    .lean();

  const statusMap = Object.fromEntries(taskStatusAgg.map((r) => [r._id, r.count]));
  const presentToday = todaysAttendance.filter((a) => a.status === ATTENDANCE_STATUS.VERIFIED || a.status === ATTENDANCE_STATUS.PENDING).length;
  const flaggedToday = todaysAttendance.filter((a) => a.status === ATTENDANCE_STATUS.FLAGGED).length;

  const checkedByTask = {};
  todaysAttendance.forEach((r) => {
    const key = String(r.task);
    checkedByTask[key] = checkedByTask[key] || new Set();
    checkedByTask[key].add(String(r.worker));
  });

  const todaysTasks = todaysTasksRaw.slice(0, 5).map((task) => ({
    _id: task._id,
    title: task.title,
    workType: task.workType,
    locationName: task.locationName,
    startTime: task.startTime,
    endTime: task.endTime,
    allowedRadius: task.allowedRadius,
    totalWorkers: task.assignedWorkers?.length || 0,
    checkedInCount: checkedByTask[String(task._id)]?.size || 0,
    status: task.status,
  }));

  const workerCheckedMap = {};
  todaysAttendance.forEach((r) => {
    const wid = String(r.worker);
    workerCheckedMap[wid] = r.status === ATTENDANCE_STATUS.VERIFIED || r.status === ATTENDANCE_STATUS.PENDING;
  });
  const topWorkTypeMap = await getTopWorkTypeByWorkerMap(workerIds);

  const workerAttendance = workers.map((worker) => ({
    _id: worker._id,
    name: toName(worker),
    initials: initialsFromName(toName(worker)),
    topWorkType: topWorkTypeMap[String(worker._id)] || 'General',
    checkedIn: !!workerCheckedMap[String(worker._id)],
  }));

  return {
    stats: {
      activeTasks: statusMap.ACTIVE || 0,
      totalWorkers: workers.length,
      presentToday,
      flaggedToday,
      pendingLeaves,
    },
    todaysTasks,
    workerAttendance,
  };
};

const getTasks = (teamLeadId) =>
  Task.find({ createdBy: teamLeadId, isDeleted: false }).populate('assignedWorkers', 'fullName').sort({ createdAt: -1 }).lean();

const createTask = async (teamLeadId, body) => {
  const task = await Task.create({
    title: body.title,
    description: body.description || '',
    workType: body.workType,
    locationName: body.locationName,
    latitude: Number(body.latitude),
    longitude: Number(body.longitude),
    allowedRadius: Number(body.allowedRadius),
    date: new Date(body.date),
    startTime: body.startTime,
    endTime: body.endTime,
    checkInBuffer: Number.isFinite(Number(body.checkInBuffer)) ? Number(body.checkInBuffer) : 15,
    checkOutBuffer: Number.isFinite(Number(body.checkOutBuffer)) ? Number(body.checkOutBuffer) : 15,
    assignedWorkers: Array.isArray(body.assignedWorkers) ? body.assignedWorkers : [],
    reportFields: Array.isArray(body.reportFields) ? body.reportFields : [],
    createdBy: teamLeadId,
  });
  if (Array.isArray(body.assignedWorkers) && body.assignedWorkers.length) {
    await TaskAssignment.insertMany(body.assignedWorkers.map((workerId) => ({ taskId: task._id, workerId })));
  }
  return Task.findById(task._id).populate('assignedWorkers', 'fullName').lean();
};

const getTaskById = (teamLeadId, taskId) =>
  Task.findOne({ _id: taskId, createdBy: teamLeadId, isDeleted: false }).populate('assignedWorkers', 'fullName username').lean();

const updateTaskStatus = (teamLeadId, taskId, status) =>
  Task.findOneAndUpdate({ _id: taskId, createdBy: teamLeadId, isDeleted: false }, { $set: { status } }, { new: true })
    .populate('assignedWorkers', 'fullName')
    .lean();

const getAvailableWorkers = async (teamLeadId, date, startTime, endTime) => {
  const workers = await getWorkersByTeamLead(teamLeadId);
  if (!workers.length) return [];

  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const windowStart = parseTimeToMinutes(startTime);
  const windowEnd = parseTimeToMinutes(endTime);

  // Excludes workers assigned by ANY team lead, not just current one
  const tasksSameDay = await Task.find({ date: { $gte: dayStart, $lte: dayEnd }, isDeleted: false }).select('_id startTime endTime').lean();
  const busyTaskIds = tasksSameDay
    .filter((task) => {
      const s = parseTimeToMinutes(task.startTime);
      const e = parseTimeToMinutes(task.endTime);
      return s < windowEnd && windowStart < e;
    })
    .map((task) => task._id);

  const busyAssignments = await TaskAssignment.find({ taskId: { $in: busyTaskIds }, workerId: { $in: workers.map((w) => w._id) } }).select('workerId').lean();
  const busySet = new Set(busyAssignments.map((a) => String(a.workerId)));
  const available = workers.filter((w) => !busySet.has(String(w._id)));

  const completedTasks = await Task.find({
    assignedWorkers: { $in: available.map((w) => w._id) },
    status: 'COMPLETED',
    isDeleted: false,
  })
    .select('workType assignedWorkers')
    .lean();

  const workHistoryMap = {};
  available.forEach((w) => (workHistoryMap[String(w._id)] = new Set()));
  completedTasks.forEach((task) => {
    task.assignedWorkers.forEach((wid) => {
      const key = String(wid);
      if (workHistoryMap[key]) workHistoryMap[key].add(task.workType);
    });
  });

  const weekStart = startOfDay(new Date());
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = endOfDay(new Date(weekStart));
  weekEnd.setDate(weekEnd.getDate() + 6);

  const weeklyTasks = await Task.find({
    assignedWorkers: { $in: available.map((w) => w._id) },
    date: { $gte: weekStart, $lte: weekEnd },
    isDeleted: false,
  })
    .select('assignedWorkers startTime endTime')
    .lean();

  const weeklyHours = {};
  available.forEach((w) => (weeklyHours[String(w._id)] = 0));
  weeklyTasks.forEach((task) => {
    const hrs = durationInHours(task.startTime, task.endTime);
    task.assignedWorkers.forEach((wid) => {
      const key = String(wid);
      if (weeklyHours[key] != null) weeklyHours[key] += hrs;
    });
  });

  return available.map((worker) => ({
    _id: worker._id,
    name: toName(worker),
    initials: initialsFromName(toName(worker)),
    workHistory: Array.from(workHistoryMap[String(worker._id)] || []),
    weeklyHours: Number((weeklyHours[String(worker._id)] || 0).toFixed(1)),
  }));
};

const searchLocation = async (q) => {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    q
  )}&format=json&addressdetails=1&limit=5`;
  const response = await axios.get(url, { headers: { 'User-Agent': 'SevaSetu/1.0' } });
  return (response.data || []).map((item) => ({
    displayName: item.display_name,
    latitude: parseFloat(item.lat),
    longitude: parseFloat(item.lon),
  }));
};

const getLeaveRequests = async (teamLeadId, status) => {
  const workers = await getWorkersByTeamLead(teamLeadId);
  const workerIds = workers.map((w) => w._id);
  const query = { worker: { $in: workerIds } };
  if (status) query.status = status;
  const leaves = await LeaveRequest.find(query).populate('worker', 'fullName').sort({ createdAt: -1 }).lean();
  return leaves.map((leave) => {
    const from = new Date(leave.fromDate);
    const to = new Date(leave.toDate);
    const days = Math.max(1, Math.round((endOfDay(to) - startOfDay(from)) / 86400000) + 1);
    return {
      ...leave,
      workerName: toName(leave.worker),
      initials: initialsFromName(toName(leave.worker)),
      days,
    };
  });
};

const updateLeaveStatus = async (teamLeadId, leaveId, status, remark) => {
  const leave = await LeaveRequest.findById(leaveId).populate('worker', 'assignedTeamLead');
  if (!leave) return null;
  if (String(leave.worker?.assignedTeamLead) !== String(teamLeadId)) return false;
  leave.status = status;
  leave.reviewNote = remark || '';
  leave.reviewedBy = teamLeadId;
  await leave.save();
  return leave.toObject();
};

const getAttendance = async (teamLeadId, date) => {
  const from = startOfDay(date);
  const to = endOfDay(date);
  const tasks = await Task.find({ createdBy: teamLeadId, isDeleted: false }).select('_id title locationName latitude longitude allowedRadius').lean();
  const taskIds = tasks.map((t) => t._id);

  const records = await AttendanceRecord.find({
    task: { $in: taskIds },
    createdAt: { $gte: from, $lte: to },
    isDeleted: false,
  })
    .populate('worker', 'fullName')
    .populate('task', 'title locationName latitude longitude allowedRadius')
    .sort({ createdAt: -1 })
    .lean();

  const groupedMap = {};
  const summary = { present: 0, absent: 0, flagged: 0, pending: 0 };

  records.forEach((record) => {
    if (!record.task) return;
    const taskId = String(record.task._id);
    if (!groupedMap[taskId]) groupedMap[taskId] = { task: record.task, records: [] };
    let distanceAtCheckIn = null;
    if (record.checkInLocation?.latitude != null && record.checkInLocation?.longitude != null) {
      distanceAtCheckIn = haversine.getDistanceInMeters(
        record.task.latitude,
        record.task.longitude,
        record.checkInLocation.latitude,
        record.checkInLocation.longitude
      );
    }
    groupedMap[taskId].records.push({ ...record, distanceAtCheckIn: distanceAtCheckIn ? Math.round(distanceAtCheckIn) : null });
    if (record.status === ATTENDANCE_STATUS.VERIFIED) summary.present += 1;
    else if (record.status === ATTENDANCE_STATUS.REJECTED) summary.absent += 1;
    else if (record.status === ATTENDANCE_STATUS.FLAGGED) summary.flagged += 1;
    else summary.pending += 1;
  });

  return { date, grouped: Object.values(groupedMap), summary };
};

const getFlaggedRecords = async (teamLeadId) => {
  const taskIds = (
    await Task.find({ createdBy: teamLeadId, isDeleted: false }).select('_id')
  ).map((t) => t._id);
  const records = await AttendanceRecord.find({
    task: { $in: taskIds },
    status: ATTENDANCE_STATUS.FLAGGED,
    isDeleted: false,
  })
    .populate('worker', 'fullName')
    .populate('task', 'title locationName latitude longitude allowedRadius createdBy')
    .sort({ createdAt: -1 })
    .lean();
  return records.map((record) => {
    let distanceAtCheckIn = null;
    if (record.task && record.checkInLocation?.latitude != null && record.checkInLocation?.longitude != null) {
      distanceAtCheckIn = Math.round(
        haversine.getDistanceInMeters(
          record.task.latitude,
          record.task.longitude,
          record.checkInLocation.latitude,
          record.checkInLocation.longitude
        )
      );
    }
    return { ...record, distanceAtCheckIn };
  });
};

const resolveFlaggedRecord = async (teamLeadId, recordId, action, remark) => {
  const record = await AttendanceRecord.findById(recordId).populate('task', 'createdBy');
  if (!record || !record.task) return null;
  if (String(record.task.createdBy) !== String(teamLeadId)) return false;
  record.status = action === 'APPROVE' ? ATTENDANCE_STATUS.VERIFIED : ATTENDANCE_STATUS.REJECTED;
  record.tlApprovalStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  record.resolvedBy = teamLeadId;
  record.resolutionRemark = remark || '';
  await record.save();
  return record.toObject();
};

const getFieldReports = async (teamLeadId, status) => {
  const taskIds = (await Task.find({ createdBy: teamLeadId, isDeleted: false }).select('_id')).map((t) => t._id);
  const query = { task: { $in: taskIds } };
  if (status) query.status = status;
  return FieldReport.find(query)
    .populate('worker', 'fullName')
    .populate('task', 'title workType locationName reportFields')
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();
};

const getFieldReportById = async (teamLeadId, reportId) => {
  const report = await FieldReport.findById(reportId)
    .populate('worker', 'fullName username')
    .populate('task', 'title workType locationName reportFields createdBy')
    .populate('attendance');
  if (!report?.task) return null;
  if (String(report.task.createdBy) !== String(teamLeadId)) return false;
  return report.toObject();
};

const forwardReportToAdmin = async (teamLeadId, reportId, summary) => {
  const report = await FieldReport.findById(reportId).populate('task', 'createdBy');
  if (!report?.task) return null;
  if (String(report.task.createdBy) !== String(teamLeadId)) return false;

  await AdminReport.create({
    fromTeamLead: teamLeadId,
    originalReportId: report._id,
    taskId: report.task?._id || report.task,
    summary,
  });

  report.status = 'FORWARDED';
  report.forwardedToAdmin = true;
  report.forwardedAt = new Date();
  await report.save();
  return report.toObject();
};

module.exports = {
  getTeamLeadDashboardData: getDashboardData,
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
