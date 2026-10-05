const User = require('../models/User');
const Task = require('../models/Task');
const AttendanceRecord = require('../models/AttendanceRecord');
const LeaveRequest = require('../models/LeaveRequest');
const FieldReport = require('../models/FieldReport');
const Notification = require('../models/Notification');
const { ROLES } = require('../utils/constants');
const { sendSuccess, sendError } = require('../utils/response');

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(base, n) {
  const x = new Date(base);
  x.setDate(x.getDate() + n);
  return x;
}

function monthRange(offsetMonths = 0) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offsetMonths;
  const start = new Date(y, m, 1, 0, 0, 0, 0);
  const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function startOfMonthDate(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function defaultPeriodLabel(createdAt) {
  const d = new Date(createdAt);
  const start = new Date(d);
  start.setDate(start.getDate() - 6);
  const opts = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)}–${d.toLocaleDateString('en-US', { day: 'numeric' })}`;
}

function formatReportDoc(r, taskLean) {
  const task = taskLean || r.task;
  const submittedBy = r.submittedBy || task?.createdBy || r.worker;
  const attachments =
    r.attachments && r.attachments.length ? r.attachments : r.images || [];
  return {
    _id: r._id,
    submittedBy,
    period: r.period || defaultPeriodLabel(r.createdAt),
    summary: r.summary || r.description,
    attachments,
    presentCount: r.presentCount ?? 0,
    absentCount: r.absentCount ?? 0,
    flaggedCount: r.flaggedCount ?? 0,
    tasksCompleted: r.tasksCompleted ?? 0,
    totalTasks: r.totalTasks ?? 0,
    isRead: !!r.isRead,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    status: r.status,
    task: task?._id || r.task,
  };
}

async function buildAttendanceMatch(query) {
  const start = query.startDate ? startOfDay(new Date(query.startDate)) : startOfMonthDate(new Date());
  const end = query.endDate ? endOfDay(new Date(query.endDate)) : new Date();
  let taskIds = null;
  if (query.teamLeadId) {
    taskIds = await Task.find({ createdBy: query.teamLeadId, isDeleted: false }).distinct('_id');
  }
  if (query.taskType) {
    const canonical = mapWorkTypeToCanonical(query.taskType);
    const tasks = await Task.find({ isDeleted: false }).select('workType _id').lean();
    const matchTypeIds = tasks
      .filter((t) => mapWorkTypeToCanonical(t.workType) === canonical)
      .map((t) => t._id);
    if (taskIds === null) {
      taskIds = matchTypeIds;
    } else {
      const set = new Set(matchTypeIds.map(String));
      taskIds = taskIds.filter((id) => set.has(String(id)));
    }
  }
  const match = {
    isDeleted: false,
    $or: [
      { checkInTime: { $gte: start, $lte: end } },
      { checkInTime: null, createdAt: { $gte: start, $lte: end } },
    ],
  };
  if (taskIds !== null) {
    match.task = taskIds.length ? { $in: taskIds } : { $in: [] };
  }
  return { start, end, match };
}

function mapWorkTypeToCanonical(workType) {
  const w = String(workType || '')
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (w === 'WASTE_COLLECTION' || w.includes('WASTE')) return 'WASTE_COLLECTION';
  if (w === 'RECYCLING' || w.includes('RECYCL')) return 'RECYCLING';
  if (w === 'AWARENESS_DRIVE' || w.includes('AWARENESS')) return 'AWARENESS_DRIVE';
  return 'OTHER';
}

function initialsFromFullName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

async function sumTaskHoursToday(taskId) {
  const dayStart = startOfDay();
  const dayEnd = addDays(dayStart, 1);
  const records = await AttendanceRecord.find({
    task: taskId,
    isDeleted: false,
    checkInTime: { $gte: dayStart, $lt: dayEnd },
    checkOutTime: { $exists: true, $ne: null },
  }).lean();
  let ms = 0;
  for (const r of records) {
    if (r.checkOutTime && r.checkInTime) {
      ms += new Date(r.checkOutTime) - new Date(r.checkInTime);
    }
  }
  return Math.round((ms / 3600000) * 10) / 10;
}

const getTeamLeads = async (req, res) => {
  try {
    const teamLeads = await User.find({ role: 'TEAM_LEAD', isDeleted: false, isActive: true })
      .select('_id fullName')
      .lean();
    return sendSuccess(res, { teamLeads }, 'Success');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch team leads', 500);
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ isDeleted: false })
      .select('_id fullName username role isActive assignedTeamLead createdAt')
      .populate('assignedTeamLead', 'fullName')
      .sort({ createdAt: -1 })
      .lean();
    return sendSuccess(res, { users }, 'Success');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch users', 500);
  }
};

const toggleUserActive = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, isDeleted: false });
    if (!user) return sendError(res, 'User not found', 404);
    user.isActive = !user.isActive;
    await user.save();
    const u = await User.findById(user._id)
      .select('-password')
      .populate('assignedTeamLead', 'fullName')
      .lean();
    return sendSuccess(res, { user: u }, 'Success');
  } catch (error) {
    return sendError(res, error.message || 'Update failed', 500);
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, isDeleted: false });
    if (!user) return sendError(res, 'User not found', 404);
    const { fullName, role, assignedTeamLead, isActive } = req.body;
    if (fullName !== undefined) user.fullName = String(fullName).trim();
    if (role !== undefined && ['ADMIN', 'TEAM_LEAD', 'FIELD_WORKER'].includes(role)) {
      user.role = role;
    }
    if (assignedTeamLead !== undefined) {
      user.assignedTeamLead = assignedTeamLead || null;
    }
    if (isActive !== undefined) user.isActive = !!isActive;
    await user.save();
    const u = await User.findById(user._id)
      .select('-password')
      .populate('assignedTeamLead', 'fullName')
      .lean();
    return sendSuccess(res, { user: u }, 'Success');
  } catch (error) {
    return sendError(res, error.message || 'Update failed', 500);
  }
};

const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    await User.findByIdAndUpdate(id, { $set: { isActive: !!is_active } });
    return sendSuccess(res, {}, 'User status updated successfully');
  } catch (error) {
    return sendError(res, error.message || 'Update failed', 500);
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndUpdate(id, { $set: { isDeleted: true, isActive: false } });
    return sendSuccess(res, {}, 'User deleted successfully');
  } catch (error) {
    return sendError(res, error.message || 'Delete failed', 500);
  }
};

const getStats = async (req, res) => {
  try {
    const [totalUsers, totalTasks, verifiedAttendances, flaggedAttendances] = await Promise.all([
      User.countDocuments({ isDeleted: false }),
      Task.countDocuments({ isDeleted: false }),
      AttendanceRecord.countDocuments({ status: 'VERIFIED', isDeleted: false }),
      AttendanceRecord.countDocuments({ status: 'FLAGGED', isDeleted: false }),
    ]);
    return sendSuccess(
      res,
      {
        totalUsers,
        totalTasks,
        verifiedAttendances,
        flaggedAttendances,
      },
      'Success'
    );
  } catch (error) {
    return sendError(res, error.message || 'Failed to load stats', 500);
  }
};

const getOverviewStats = async (req, res) => {
  try {
    const { start: monthStart, end: monthEnd } = monthRange(0);
    const todayStart = startOfDay();
    const todayEnd = addDays(todayStart, 1);

    const [
      totalFieldWorkers,
      newWorkersThisMonth,
      totalTeamLeads,
      tasksThisMonth,
      tasksCompletedThisMonth,
      verifiedAttMonth,
      totalAttMonth,
      teamLeadIdsOnDuty,
    ] = await Promise.all([
      User.countDocuments({
        role: ROLES.FIELD_WORKER,
        isActive: true,
        isDeleted: false,
      }),
      User.countDocuments({
        role: ROLES.FIELD_WORKER,
        isDeleted: false,
        createdAt: { $gte: monthStart, $lte: monthEnd },
      }),
      User.countDocuments({
        role: ROLES.TEAM_LEAD,
        isActive: true,
        isDeleted: false,
      }),
      Task.countDocuments({
        isDeleted: false,
        createdAt: { $gte: monthStart, $lte: monthEnd },
      }),
      Task.countDocuments({
        isDeleted: false,
        status: 'COMPLETED',
        createdAt: { $gte: monthStart, $lte: monthEnd },
      }),
      AttendanceRecord.countDocuments({
        isDeleted: false,
        status: 'VERIFIED',
        createdAt: { $gte: monthStart, $lte: monthEnd },
      }),
      AttendanceRecord.countDocuments({
        isDeleted: false,
        createdAt: { $gte: monthStart, $lte: monthEnd },
      }),
      Task.distinct('createdBy', {
        isDeleted: false,
        date: { $gte: todayStart, $lt: todayEnd },
        status: { $ne: 'CANCELLED' },
      }),
    ]);

    const activeLeads = await User.countDocuments({
      _id: { $in: teamLeadIdsOnDuty },
      role: ROLES.TEAM_LEAD,
      isActive: true,
      isDeleted: false,
    });

    let attendanceRate = 0;
    if (totalAttMonth > 0) {
      attendanceRate = Math.round((verifiedAttMonth / totalAttMonth) * 1000) / 10;
    }

    return sendSuccess(
      res,
      {
        totalFieldWorkers,
        newWorkersThisMonth,
        totalTeamLeads,
        teamLeadsActiveToday: activeLeads,
        tasksThisMonth,
        tasksCompletedThisMonth,
        attendanceRate,
      },
      'Success'
    );
  } catch (error) {
    return sendError(res, error.message || 'Failed to load overview', 500);
  }
};

const getAttendanceTrend = async (req, res) => {
  try {
    let days = parseInt(req.query.days, 10);
    if (Number.isNaN(days) || days < 1) days = 14;
    if (days > 90) days = 90;

    const trend = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const day = addDays(startOfDay(), -i);
      const next = addDays(day, 1);

      const [present, absent] = await Promise.all([
        AttendanceRecord.countDocuments({
          isDeleted: false,
          status: 'VERIFIED',
          $or: [
            { checkInTime: { $gte: day, $lt: next } },
            { checkInTime: null, createdAt: { $gte: day, $lt: next } },
          ],
        }),
        AttendanceRecord.countDocuments({
          isDeleted: false,
          status: { $ne: 'VERIFIED' },
          $or: [
            { checkInTime: { $gte: day, $lt: next } },
            { checkInTime: null, createdAt: { $gte: day, $lt: next } },
          ],
        }),
      ]);

      const dateLabel = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      trend.push({ date: dateLabel, present, absent });
    }

    return sendSuccess(res, { trend }, 'Success');
  } catch (error) {
    return sendError(res, error.message || 'Failed to load attendance trend', 500);
  }
};

const getTasksByType = async (req, res) => {
  try {
    const CANONICAL = ['WASTE_COLLECTION', 'RECYCLING', 'AWARENESS_DRIVE', 'OTHER'];
    const tasks = await Task.find({ isDeleted: false }).select('workType').lean();
    const counts = { WASTE_COLLECTION: 0, RECYCLING: 0, AWARENESS_DRIVE: 0, OTHER: 0 };
    for (const t of tasks) {
      const c = mapWorkTypeToCanonical(t.workType);
      counts[c] += 1;
    }
    const total = tasks.length;
    const types = CANONICAL.map((type) => ({
      type,
      count: counts[type],
      percentage: total === 0 ? 0 : Math.round((counts[type] / total) * 1000) / 10,
    }));
    return sendSuccess(res, { types }, 'Success');
  } catch (error) {
    return sendError(res, error.message || 'Failed to load task types', 500);
  }
};

const getActiveTeamLeads = async (req, res) => {
  try {
    const todayStart = startOfDay();
    const todayEnd = addDays(todayStart, 1);

    const tasks = await Task.find({
      isDeleted: false,
      date: { $gte: todayStart, $lt: todayEnd },
      status: { $ne: 'CANCELLED' },
    })
      .populate('createdBy', 'fullName _id')
      .lean();

    const activeTeamLeads = [];
    for (const task of tasks) {
      const lead = task.createdBy;
      if (!lead || !lead._id) continue;

      const workersAssigned = Array.isArray(task.assignedWorkers) ? task.assignedWorkers.length : 0;
      const hoursLogged = await sumTaskHoursToday(task._id);

      let completionRate = 0;
      if (task.status === 'COMPLETED') completionRate = 100;
      else if (task.status === 'ACTIVE') completionRate = 50;

      activeTeamLeads.push({
        id: lead._id.toString(),
        name: lead.fullName,
        initials: initialsFromFullName(lead.fullName),
        todayTask: task.title,
        taskType: mapWorkTypeToCanonical(task.workType),
        locationName: task.locationName,
        workersAssigned,
        hoursLogged,
        completionRate,
        taskStatus: task.status,
      });
    }

    return sendSuccess(res, { activeTeamLeads }, 'Success');
  } catch (error) {
    return sendError(res, error.message || 'Failed to load active team leads', 500);
  }
};

const getImpactMetrics = async (req, res) => {
  try {
    const cur = monthRange(0);
    const prev = monthRange(-1);

    const [wasteCur, wastePrev, drivesCur, drivesPrev, verifiedRecs, totalFieldWorkers] =
      await Promise.all([
        FieldReport.aggregate([
          {
            $match: {
              createdAt: { $gte: cur.start, $lte: cur.end },
            },
          },
          {
            $group: {
              _id: null,
              kg: { $sum: { $ifNull: ['$wasteCollectedKg', 0] } },
            },
          },
        ]),
        FieldReport.aggregate([
          {
            $match: {
              createdAt: { $gte: prev.start, $lte: prev.end },
            },
          },
          {
            $group: {
              _id: null,
              kg: { $sum: { $ifNull: ['$wasteCollectedKg', 0] } },
            },
          },
        ]),
        Task.countDocuments({
          isDeleted: false,
          status: 'COMPLETED',
          createdAt: { $gte: cur.start, $lte: cur.end },
        }),
        Task.countDocuments({
          isDeleted: false,
          status: 'COMPLETED',
          createdAt: { $gte: prev.start, $lte: prev.end },
        }),
        AttendanceRecord.find({
          isDeleted: false,
          status: 'VERIFIED',
          checkInTime: { $exists: true, $ne: null },
          checkOutTime: { $exists: true, $ne: null },
          createdAt: { $gte: cur.start, $lte: cur.end },
        }).lean(),
        User.countDocuments({
          role: ROLES.FIELD_WORKER,
          isActive: true,
          isDeleted: false,
        }),
      ]);

    const kgCur = wasteCur[0]?.kg || 0;
    const kgPrev = wastePrev[0]?.kg || 0;
    const wasteCollectedTonnes = Math.round((kgCur / 1000) * 10) / 10;
    const wasteCollectedLastMonthTonnes = Math.round((kgPrev / 1000) * 10) / 10;

    let totalMs = 0;
    for (const r of verifiedRecs) {
      totalMs += new Date(r.checkOutTime) - new Date(r.checkInTime);
    }
    const totalFieldHours = Math.round((totalMs / 3600000) * 10) / 10;
    const avgHoursPerWorker =
      totalFieldWorkers > 0
        ? Math.round((totalFieldHours / totalFieldWorkers) * 10) / 10
        : 0;

    return sendSuccess(
      res,
      {
        wasteCollectedTonnes,
        wasteCollectedLastMonthTonnes,
        drivesCompleted: drivesCur,
        drivesCompletedLastMonth: drivesPrev,
        totalFieldHours,
        avgHoursPerWorker,
      },
      'Success'
    );
  } catch (error) {
    return sendError(res, error.message || 'Failed to load impact metrics', 500);
  }
};

const getSystemAlerts = async (req, res) => {
  try {
    const alerts = [];
    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 86400000);
    const threeDaysAgo = new Date(now - 3 * 86400000);
    const todayStart = startOfDay();
    const tomorrowEnd = endOfDay(addDays(new Date(), 1));

    const teamLeads = await User.find({
      role: ROLES.TEAM_LEAD,
      isActive: true,
      isDeleted: false,
    }).lean();

    for (const tl of teamLeads) {
      const taskIds = await Task.find({ createdBy: tl._id }).distinct('_id');
      const last = await FieldReport.findOne({ task: { $in: taskIds } })
        .sort({ createdAt: -1 })
        .lean();
      if (!last || new Date(last.createdAt) < sevenDaysAgo) {
        const daysSince = last
          ? Math.floor((now - new Date(last.createdAt).getTime()) / 86400000)
          : 7;
        alerts.push({
          type: 'TEAM_LEAD_NO_REPORT',
          message: `${tl.fullName} hasn't submitted a report in ${Math.max(daysSince, 7)} days`,
          severity: 'warning',
          timestamp: new Date().toISOString(),
          count: 1,
        });
      }
    }

    const unassignedByDay = await Task.aggregate([
      {
        $match: {
          isDeleted: false,
          date: { $gte: todayStart, $lte: tomorrowEnd },
          $expr: { $eq: [{ $size: { $ifNull: ['$assignedWorkers', []] } }, 0] },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$date' },
          },
          n: { $sum: 1 },
        },
      },
    ]);

    for (const g of unassignedByDay) {
      if (g.n > 0) {
        const d = new Date(`${g._id}T12:00:00`);
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        alerts.push({
          type: 'TASK_NO_WORKERS',
          message: `${g.n} task(s) have no workers assigned for ${dateStr}`,
          severity: 'critical',
          timestamp: new Date().toISOString(),
          count: g.n,
        });
      }
    }

    const staleLeave = await LeaveRequest.countDocuments({
      status: 'PENDING',
      createdAt: { $lt: threeDaysAgo },
    });
    if (staleLeave > 0) {
      alerts.push({
        type: 'STALE_LEAVE',
        message: `${staleLeave} leave requests have been pending for over 3 days`,
        severity: 'warning',
        timestamp: new Date().toISOString(),
        count: staleLeave,
      });
    }

    const facePending = await User.countDocuments({
      role: ROLES.FIELD_WORKER,
      isActive: true,
      isDeleted: false,
      $or: [{ faceImagePath: null }, { faceImagePath: '' }],
    });
    if (facePending > 0) {
      alerts.push({
        type: 'FACE_PENDING',
        message: `Face registration pending for ${facePending} field workers`,
        severity: 'info',
        timestamp: new Date().toISOString(),
        count: facePending,
      });
    }

    const todayEnd = addDays(todayStart, 1);
    const inProgressToday = await Task.find({
      isDeleted: false,
      status: 'ACTIVE',
      date: { $gte: todayStart, $lt: todayEnd },
    })
      .select('_id')
      .lean();

    let noAttCount = 0;
    for (const t of inProgressToday) {
      const c = await AttendanceRecord.countDocuments({ task: t._id, isDeleted: false });
      if (c === 0) noAttCount += 1;
    }
    if (noAttCount > 0) {
      alerts.push({
        type: 'NO_ATTENDANCE_TODAY',
        message: `No attendance data recorded for ${noAttCount} active task(s) today`,
        severity: 'critical',
        timestamp: new Date().toISOString(),
        count: noAttCount,
      });
    }

    const order = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => order[a.severity] - order[b.severity]);

    return sendSuccess(res, { alerts }, 'Success');
  } catch (error) {
    return sendError(res, error.message || 'Failed to load alerts', 500);
  }
};

const getReports = async (req, res) => {
  try {
    const rows = await FieldReport.find()
      .populate('worker', 'fullName username')
      .populate({
        path: 'task',
        select: 'createdBy title workType',
        populate: { path: 'createdBy', select: 'fullName username _id' },
      })
      .populate('submittedBy', 'fullName username')
      .sort({ createdAt: -1 })
      .lean();

    const reports = rows.map((r) => formatReportDoc(r, r.task));
    return sendSuccess(res, { reports }, 'Success');
  } catch (error) {
    return sendError(res, error.message || 'Failed to load reports', 500);
  }
};

const markReportRead = async (req, res) => {
  try {
    const report = await FieldReport.findByIdAndUpdate(
      req.params.id,
      { $set: { isRead: true } },
      { new: true }
    )
      .populate('worker', 'fullName username')
      .populate({
        path: 'task',
        select: 'createdBy title workType',
        populate: { path: 'createdBy', select: 'fullName username _id' },
      })
      .populate('submittedBy', 'fullName username')
      .lean();
    if (!report) return sendError(res, 'Report not found', 404);
    return sendSuccess(res, { report: formatReportDoc(report, report.task) }, 'Success');
  } catch (error) {
    return sendError(res, error.message || 'Failed to update report', 500);
  }
};

const requestReport = async (req, res) => {
  try {
    const adminId = req.user?.userId;
    const lead = await User.findOne({
      _id: req.params.id,
      role: ROLES.TEAM_LEAD,
      isDeleted: false,
    });
    if (!lead) return sendError(res, 'Team lead not found', 404);
    await Notification.create({
      recipient: lead._id,
      sender: adminId,
      type: 'REPORT_REQUEST',
      message:
        'Admin has requested your weekly field report. Please submit it as soon as possible.',
      isRead: false,
    });
    return sendSuccess(res, {}, 'Report request sent');
  } catch (error) {
    return sendError(res, error.message || 'Failed to send request', 500);
  }
};

const getPendingReportLeads = async (req, res) => {
  try {
    const since = addDays(startOfDay(), -7);
    const reps = await FieldReport.find({ createdAt: { $gte: since } }).select('task').lean();
    const taskIds = [...new Set(reps.map((r) => r.task).filter(Boolean))];
    const tasks = await Task.find({ _id: { $in: taskIds } }).select('createdBy').lean();
    const leadIdsSubmitted = new Set(tasks.map((t) => String(t.createdBy)).filter(Boolean));

    const allLeads = await User.find({
      role: ROLES.TEAM_LEAD,
      isActive: true,
      isDeleted: false,
    }).lean();
    const pendingLeads = [];
    for (const tl of allLeads) {
      if (leadIdsSubmitted.has(String(tl._id))) continue;
      const tlTaskIds = await Task.find({ createdBy: tl._id }).distinct('_id');
      const last = await FieldReport.findOne({ task: { $in: tlTaskIds } })
        .sort({ createdAt: -1 })
        .select('createdAt')
        .lean();
      pendingLeads.push({
        _id: tl._id,
        fullName: tl.fullName,
        username: tl.username,
        lastReportDate: last?.createdAt || null,
      });
    }
    return sendSuccess(res, { pendingLeads }, 'Success');
  } catch (error) {
    return sendError(res, error.message || 'Failed to load pending leads', 500);
  }
};

const getAnalyticsKPIs = async (req, res) => {
  try {
    const { match } = await buildAttendanceMatch(req.query);
    const [totalPresent, totalAbsent, lateCheckIns] = await Promise.all([
      AttendanceRecord.countDocuments({ ...match, status: 'VERIFIED' }),
      AttendanceRecord.countDocuments({ ...match, status: 'REJECTED' }),
      AttendanceRecord.countDocuments({ ...match, isLate: true }),
    ]);
    const denom = totalPresent + totalAbsent;
    const overallRate = denom > 0 ? Math.round((totalPresent / denom) * 1000) / 10 : 0;
    return sendSuccess(res, { totalPresent, totalAbsent, overallRate, lateCheckIns }, 'Success');
  } catch (error) {
    return sendError(res, error.message || 'Failed to load KPIs', 500);
  }
};

const getAnalyticsTrend = async (req, res) => {
  try {
    const { start, end, match: baseMatch } = await buildAttendanceMatch(req.query);
    const taskPart = {};
    if (baseMatch.task) taskPart.task = baseMatch.task;
    const trend = [];
    let cursor = new Date(start);
    const endCap = new Date(end);
    let days = 0;
    while (cursor <= endCap && days < 31) {
      const next = addDays(cursor, 1);
      const dayMatch = {
        isDeleted: false,
        ...taskPart,
        $or: [
          { checkInTime: { $gte: cursor, $lt: next } },
          { checkInTime: null, createdAt: { $gte: cursor, $lt: next } },
        ],
      };
      const [present, absent] = await Promise.all([
        AttendanceRecord.countDocuments({ ...dayMatch, status: 'VERIFIED' }),
        AttendanceRecord.countDocuments({ ...dayMatch, status: 'REJECTED' }),
      ]);
      const d = present + absent;
      const rate = d > 0 ? Math.round((present / d) * 1000) / 10 : 0;
      trend.push({
        date: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        present,
        absent,
        rate,
      });
      cursor = next;
      days += 1;
    }
    return sendSuccess(res, { trend }, 'Success');
  } catch (error) {
    return sendError(res, error.message || 'Failed to load trend', 500);
  }
};

const getVerificationStatus = async (req, res) => {
  try {
    const { match } = await buildAttendanceMatch(req.query);
    const [verified, pending, rejected, flagged] = await Promise.all([
      AttendanceRecord.countDocuments({ ...match, status: 'VERIFIED' }),
      AttendanceRecord.countDocuments({ ...match, status: 'PENDING' }),
      AttendanceRecord.countDocuments({ ...match, status: 'REJECTED' }),
      AttendanceRecord.countDocuments({ ...match, status: 'FLAGGED' }),
    ]);
    return sendSuccess(res, { verified, pending, rejected, flagged }, 'Success');
  } catch (error) {
    return sendError(res, error.message || 'Failed to load verification', 500);
  }
};

const getTeamComparison = async (req, res) => {
  try {
    const { match } = await buildAttendanceMatch(req.query);
    const agg = await AttendanceRecord.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'tasks',
          localField: 'task',
          foreignField: '_id',
          as: 'taskDoc',
        },
      },
      { $unwind: '$taskDoc' },
      {
        $group: {
          _id: '$taskDoc.createdBy',
          verified: {
            $sum: { $cond: [{ $eq: ['$status', 'VERIFIED'] }, 1, 0] },
          },
          total: { $sum: 1 },
        },
      },
    ]);
    const leadIds = agg.map((a) => a._id).filter(Boolean);
    const leads = await User.find({ _id: { $in: leadIds } }).select('fullName').lean();
    const nameById = Object.fromEntries(leads.map((u) => [String(u._id), u.fullName]));
    const teams = agg.map((a) => ({
      teamLeadName: nameById[String(a._id)] || 'Unknown',
      verified: a.verified,
      total: a.total,
      rate: a.total > 0 ? Math.round((a.verified / a.total) * 1000) / 10 : 0,
    }));
    return sendSuccess(res, { teams }, 'Success');
  } catch (error) {
    return sendError(res, error.message || 'Failed to load team comparison', 500);
  }
};

const getTaskTypeAttendance = async (req, res) => {
  try {
    const { match } = await buildAttendanceMatch(req.query);
    const recs = await AttendanceRecord.find(match).select('task status').lean();
    const taskIds = [...new Set(recs.map((r) => String(r.task)).filter(Boolean))];
    const tasks = await Task.find({ _id: { $in: taskIds } }).select('workType').lean();
    const typeByTask = Object.fromEntries(
      tasks.map((t) => [String(t._id), mapWorkTypeToCanonical(t.workType)])
    );
    const buckets = {
      WASTE_COLLECTION: { present: 0, absent: 0 },
      RECYCLING: { present: 0, absent: 0 },
      AWARENESS_DRIVE: { present: 0, absent: 0 },
      OTHER: { present: 0, absent: 0 },
    };
    for (const r of recs) {
      const typ = typeByTask[String(r.task)] || 'OTHER';
      if (r.status === 'VERIFIED') buckets[typ].present += 1;
      else if (r.status === 'REJECTED') buckets[typ].absent += 1;
    }
    const taskTypes = Object.keys(buckets).map((type) => ({
      type,
      present: buckets[type].present,
      absent: buckets[type].absent,
    }));
    return sendSuccess(res, { taskTypes }, 'Success');
  } catch (error) {
    return sendError(res, error.message || 'Failed to load task type attendance', 500);
  }
};

const getMonthlyComparison = async (req, res) => {
  try {
    const now = new Date();
    const thisStart = startOfMonthDate(now);
    const thisEnd = new Date();
    const lastMonthEnd = new Date(thisStart);
    lastMonthEnd.setMilliseconds(-1);
    const lastStart = startOfMonthDate(lastMonthEnd);

    async function monthStats(start, end) {
      const m = {
        isDeleted: false,
        $or: [
          { checkInTime: { $gte: start, $lte: end } },
          { checkInTime: null, createdAt: { $gte: start, $lte: end } },
        ],
      };
      const [totalPresent, totalAbsent] = await Promise.all([
        AttendanceRecord.countDocuments({ ...m, status: 'VERIFIED' }),
        AttendanceRecord.countDocuments({ ...m, status: 'REJECTED' }),
      ]);
      const d = totalPresent + totalAbsent;
      const rate = d > 0 ? Math.round((totalPresent / d) * 1000) / 10 : 0;
      return { totalPresent, totalAbsent, rate };
    }

    const thisMonth = await monthStats(thisStart, thisEnd);
    const lastMonth = await monthStats(lastStart, lastMonthEnd);
    const delta = Math.round((thisMonth.rate - lastMonth.rate) * 10) / 10;
    return sendSuccess(res, { thisMonth, lastMonth, delta }, 'Success');
  } catch (error) {
    return sendError(res, error.message || 'Failed to load monthly comparison', 500);
  }
};

const getRawAttendanceData = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const { match } = await buildAttendanceMatch(req.query);
    const total = await AttendanceRecord.countDocuments(match);
    const records = await AttendanceRecord.find(match)
      .populate('worker', 'fullName')
      .populate({ path: 'task', select: 'title workType createdBy', populate: { path: 'createdBy', select: 'fullName' } })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const rows = records.map((r) => {
      const present = r.status === 'VERIFIED' ? 1 : 0;
      const absent = r.status === 'REJECTED' ? 1 : 0;
      const denom = present + absent || 1;
      const rate = Math.round((present / denom) * 1000) / 10;
      return {
        _id: r._id,
        teamLead: r.task?.createdBy,
        task: r.task,
        date: r.checkInTime || r.createdAt,
        present,
        absent,
        rate,
        status: r.status,
        worker: r.worker,
      };
    });

    return sendSuccess(
      res,
      {
        records: rows,
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
      },
      'Success'
    );
  } catch (error) {
    return sendError(res, error.message || 'Failed to load raw data', 500);
  }
};

const getLeaveCalendar = async (req, res) => {
  try {
    const monthStr = req.query.month || '';
    let y;
    let m;
    if (/^\d{4}-\d{2}$/.test(monthStr)) {
      const [yy, mm] = monthStr.split('-').map(Number);
      y = yy;
      m = mm - 1;
    } else {
      const now = new Date();
      y = now.getFullYear();
      m = now.getMonth();
    }
    const monthStart = new Date(y, m, 1, 0, 0, 0, 0);
    const monthEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);

    const leaves = await LeaveRequest.find({
      status: 'APPROVED',
      fromDate: { $lte: monthEnd },
      toDate: { $gte: monthStart },
    })
      .populate('worker', 'fullName')
      .lean();

    const calendar = {};
    const addDay = (d, entry) => {
      const key = d.toISOString().slice(0, 10);
      if (!calendar[key]) calendar[key] = [];
      calendar[key].push(entry);
    };

    for (const lv of leaves) {
      const from = new Date(lv.fromDate);
      const to = new Date(lv.toDate);
      for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
        if (d >= monthStart && d <= monthEnd) {
          addDay(d, {
            workerName: lv.worker?.fullName || 'Worker',
            leaveType: lv.leaveType || 'CASUAL',
          });
        }
      }
    }
    return sendSuccess(res, { calendar }, 'Success');
  } catch (error) {
    return sendError(res, error.message || 'Failed to load calendar', 500);
  }
};

const getLeaveSummary = async (req, res) => {
  try {
    const today = startOfDay();
    const tomorrow = addDays(today, 1);
    const { start: monthStart, end: monthEnd } = monthRange(0);

    const onLeaveToday = await LeaveRequest.countDocuments({
      status: 'APPROVED',
      fromDate: { $lt: tomorrow },
      toDate: { $gte: today },
    });

    const totalLeavesThisMonth = await LeaveRequest.countDocuments({
      createdAt: { $gte: monthStart, $lte: monthEnd },
    });

    const typeAgg = await LeaveRequest.aggregate([
      { $match: { createdAt: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: '$leaveType', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 1 },
    ]);
    const mostCommonType = typeAgg[0]?._id || 'OTHER';

    return sendSuccess(res, { onLeaveToday, totalLeavesThisMonth, mostCommonType }, 'Success');
  } catch (error) {
    return sendError(res, error.message || 'Failed to load leave summary', 500);
  }
};

const getLeaveRecords = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const q = {};
    if (req.query.status) q.status = req.query.status;
    if (req.query.leaveType) q.leaveType = req.query.leaveType;
    if (req.query.teamLeadId) q.teamLead = req.query.teamLeadId;
    if (req.query.startDate || req.query.endDate) {
      const s = req.query.startDate ? new Date(req.query.startDate) : new Date(0);
      const e = req.query.endDate ? endOfDay(new Date(req.query.endDate)) : new Date(8640000000000000);
      q.$or = [
        { fromDate: { $gte: s, $lte: e } },
        { toDate: { $gte: s, $lte: e } },
      ];
    }
    const total = await LeaveRequest.countDocuments(q);
    const records = await LeaveRequest.find(q)
      .populate('worker', 'fullName')
      .populate('teamLead', 'fullName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return sendSuccess(
      res,
      { records, total, page, totalPages: Math.ceil(total / limit) || 1 },
      'Success'
    );
  } catch (error) {
    return sendError(res, error.message || 'Failed to load leave records', 500);
  }
};

module.exports = {
  getTeamLeads,
  getAllUsers,
  toggleUserActive,
  updateUser,
  toggleUserStatus,
  deleteUser,
  getStats,
  getReports,
  markReportRead,
  requestReport,
  getPendingReportLeads,
  getAnalyticsKPIs,
  getAnalyticsTrend,
  getVerificationStatus,
  getTeamComparison,
  getTaskTypeAttendance,
  getMonthlyComparison,
  getRawAttendanceData,
  getLeaveCalendar,
  getLeaveSummary,
  getLeaveRecords,
  getOverviewStats,
  getAttendanceTrend,
  getTasksByType,
  getActiveTeamLeads,
  getImpactMetrics,
  getSystemAlerts,
};
