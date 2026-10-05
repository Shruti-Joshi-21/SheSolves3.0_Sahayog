const axios = require('axios');
const FormData = require('form-data');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const AttendanceRecord = require('../models/AttendanceRecord');
const LeaveRequest = require('../models/LeaveRequest');
const FieldReport = require('../models/FieldReport');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getDistanceInMeters } = require('../utils/haversine');
const { sendSuccess, sendError } = require('../utils/response');
const { ROLES } = require('../utils/constants');

const TOTAL_LEAVES_PER_YEAR = 12;
const WORKER_LEAVE_TYPES = ['SICK', 'CASUAL', 'EMERGENCY', 'OTHER'];

/** Multipart parsers may expose repeated fields as arrays — normalize to one value. */
function firstFormScalar(val) {
  if (val == null) return val;
  if (Array.isArray(val)) {
    const last = val[val.length - 1];
    return last != null ? last : val[0];
  }
  return val;
}

function notificationRecipientId(createdByRef) {
  if (createdByRef == null) return null;
  if (typeof createdByRef === 'object' && createdByRef._id != null) return createdByRef._id;
  return createdByRef;
}

function parseBodyDate(str) {
  if (!str) return null;
  const ymd = String(str).split('T')[0];
  const parts = ymd.split('-').map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return new Date(str);
  const [y, m, d] = parts;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function parseJsonBodyValue(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

function normalizeReportFieldResponses(raw) {
  const parsed = parseJsonBodyValue(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => ({
      fieldName: item?.fieldName != null ? String(item.fieldName).trim() : '',
      fieldType: item?.fieldType != null ? String(item.fieldType).trim() : '',
      value: item?.value,
    }))
    .filter((item) => item.fieldName);
}

function normalizeYesNoValue(value) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const s = String(value ?? '')
    .trim()
    .toLowerCase();
  if (s === 'yes' || s === 'true' || s === '1') return 'Yes';
  if (s === 'no' || s === 'false' || s === '0') return 'No';
  return '';
}

function leaveSpanDays(fromDate, toDate) {
  return Math.ceil((new Date(toDate) - new Date(fromDate)) / (1000 * 60 * 60 * 24)) + 1;
}

function sumApprovedLeaveDays(leaves) {
  return leaves
    .filter((l) => l.status === 'APPROVED')
    .reduce((sum, l) => sum + leaveSpanDays(l.fromDate, l.toDate), 0);
}

function startEndOfToday() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}

function startOfCalendarDay(d) {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate(), 0, 0, 0, 0);
}

function startOfLast7Days() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function checkIsEarly(endTimeStr, now) {
  const parts = String(endTimeStr || '').split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) || 0;
  if (Number.isNaN(h)) return { isEarly: false, minutes: 0 };
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  const diffMs = base.getTime() - now.getTime();
  const minutes = Math.floor(diffMs / 60000);
  return { isEarly: minutes > 0, minutes: Math.max(0, minutes) };
}

async function getDashboardData(req, res, next) {
  try {
    const workerId = req.user.userId;
    const oid = new mongoose.Types.ObjectId(workerId);
    const { start, end } = startEndOfToday();
    const weekFrom = startOfLast7Days();

    const workerTaskFilter = {
      assignedWorkers: { $in: [oid] },
      status: 'ACTIVE',
      isDeleted: false,
    };

    let todayTask = await Task.findOne({
      ...workerTaskFilter,
      date: { $gte: start, $lte: end },
    })
      .sort({ date: 1 })
      .populate('createdBy', 'fullName')
      .lean();

    let isUpcoming = false;

    if (!todayTask) {
      const now = new Date();
      const laterToday = await Task.findOne({
        ...workerTaskFilter,
        date: { $gt: now, $lte: end },
      })
        .sort({ date: 1 })
        .limit(1)
        .populate('createdBy', 'fullName')
        .lean();
      if (laterToday) todayTask = laterToday;
    }

    if (!todayTask) {
      const tomorrowStart = new Date(start);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      const upcoming = await Task.findOne({
        ...workerTaskFilter,
        date: { $gte: tomorrowStart },
      })
        .sort({ date: 1 })
        .limit(1)
        .populate('createdBy', 'fullName')
        .lean();
      if (upcoming) {
        todayTask = upcoming;
        isUpcoming = true;
      }
    }

    if (!todayTask) {
      const upcomingAfterEnd = await Task.findOne({
        ...workerTaskFilter,
        date: { $gt: end },
      })
        .sort({ date: 1 })
        .limit(1)
        .populate('createdBy', 'fullName')
        .lean();
      if (upcomingAfterEnd) {
        todayTask = upcomingAfterEnd;
        isUpcoming = true;
      }
    }

    if (!todayTask) {
      const nextByClock = await Task.findOne({
        ...workerTaskFilter,
        date: { $gt: new Date() },
      })
        .sort({ date: 1 })
        .limit(1)
        .populate('createdBy', 'fullName')
        .lean();
      if (nextByClock) {
        todayTask = nextByClock;
        isUpcoming = startOfCalendarDay(nextByClock.date).getTime() > start.getTime();
      }
    }

    if (!todayTask) {
      const earliestActive = await Task.findOne(workerTaskFilter)
        .sort({ date: 1 })
        .limit(1)
        .populate('createdBy', 'fullName')
        .lean();
      if (earliestActive) {
        todayTask = earliestActive;
        isUpcoming = startOfCalendarDay(earliestActive.date).getTime() > start.getTime();
      }
    }

    if (todayTask) {
      if (!isUpcoming) {
        isUpcoming = startOfCalendarDay(todayTask.date).getTime() > start.getTime();
      }
      todayTask = { ...todayTask, isUpcoming };
    }

    const [
      todayAttendance,
      weeklyAttendanceCount,
      totalTasksThisWeek,
      pendingLeaveCount,
      attRecords,
      leaves,
      reports,
      recentTaskRows,
    ] = await Promise.all([
      AttendanceRecord.findOne({
        worker: oid,
        checkInTime: { $exists: true, $ne: null, $gte: start, $lte: end },
        isDeleted: false,
      })
        .sort({ checkInTime: -1 })
        .lean(),

      AttendanceRecord.countDocuments({
        worker: oid,
        checkInTime: { $gte: weekFrom },
        status: 'VERIFIED',
        isDeleted: false,
      }),

      Task.countDocuments({
        assignedWorkers: { $in: [oid] },
        status: 'ACTIVE',
        date: { $gte: weekFrom },
        isDeleted: false,
      }),

      LeaveRequest.countDocuments({
        worker: oid,
        status: 'PENDING',
      }),

      AttendanceRecord.find({ worker: oid, isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(3)
        .populate('task', 'title')
        .lean(),

      LeaveRequest.find({ worker: oid }).sort({ createdAt: -1 }).limit(3).lean(),

      FieldReport.find({ worker: oid }).sort({ createdAt: -1 }).limit(3).populate('task', 'title').lean(),

      Task.find({
        assignedWorkers: { $in: [oid] },
        status: 'ACTIVE',
        isDeleted: false,
      })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select('title updatedAt date')
        .lean(),
    ]);

    const attendanceItems = attRecords.map((r) => ({
      type: 'ATTENDANCE',
      status: r.status,
      time: r.checkInTime || r.createdAt,
      label: r.task?.title || 'Attendance',
      flagReasons: r.flagReasons || [],
    }));

    const leaveItems = leaves.map((l) => ({
      type: 'LEAVE',
      status: l.status,
      time: l.createdAt,
      label: 'Leave Request',
    }));

    const reportItems = reports.map((r) => ({
      type: 'REPORT',
      status: r.status,
      time: r.createdAt,
      label: r.task?.title || 'Report',
    }));

    const taskItems = (recentTaskRows || []).map((t) => ({
      type: 'TASK',
      status: 'ACTIVE',
      time: t.updatedAt || t.date || new Date(0),
      label: t.title || 'Task',
    }));

    const merged = [...attendanceItems, ...leaveItems, ...reportItems, ...taskItems].sort(
      (a, b) => new Date(b.time) - new Date(a.time)
    );
    const recentActivity = merged.slice(0, 5);

    return sendSuccess(
      res,
      {
        todayTask,
        todayAttendance,
        weeklyAttendanceCount,
        totalTasksThisWeek,
        pendingLeaveCount,
        recentActivity,
      },
      'Dashboard data'
    );
  } catch (err) {
    next(err);
  }
}

async function getTodayAttendance(req, res, next) {
  try {
    const workerId = req.user.userId;
    const oid = new mongoose.Types.ObjectId(workerId);
    const { start, end } = startEndOfToday();

    const record = await AttendanceRecord.findOne({
      worker: oid,
      checkInTime: { $exists: true, $ne: null, $gte: start, $lte: end },
      isDeleted: false,
    })
      .sort({ checkInTime: -1 })
      .lean();

    return sendSuccess(res, record, 'Today attendance');
  } catch (err) {
    next(err);
  }
}

function checkWindowAgainstTimeStr(timeStr, bufferMinutes, now, outsideReason) {
  const parts = String(timeStr || '').split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) || 0;
  if (Number.isNaN(h)) {
    return { timeValid: false, reason: outsideReason };
  }
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  const allowedFrom = new Date(base.getTime() - bufferMinutes * 60000);
  const allowedTo = new Date(base.getTime() + bufferMinutes * 60000);
  const timeValid = now >= allowedFrom && now <= allowedTo;
  return { timeValid, reason: timeValid ? '' : outsideReason };
}

async function verifyFaceWithPythonService(faceImageUrl, userId) {
  const baseUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
  try {
    // Fetch the image from Cloudinary URL and forward it as a buffer to Python
    const imgResp = await axios.get(faceImageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    const imageBuffer = Buffer.from(imgResp.data);

    const form = new FormData();
    form.append('image', imageBuffer, { filename: 'face.jpg', contentType: 'image/jpeg' });
    form.append('userId', String(userId));
    const resp = await axios.post(`${baseUrl}/verify-face`, form, {
      headers: form.getHeaders(),
      timeout: 45000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    const match = resp.data?.match === true || resp.data?.match === 'true';
    if (!match) {
      return { faceValid: false, reason: 'Face did not match registered photo' };
    }
    return { faceValid: true, reason: '' };
  } catch (err) {
    return { faceValid: false, reason: 'Face verification service unavailable' };
  }
}

// Returns the Cloudinary secure_url stored in file.path by multer-storage-cloudinary
function getFieldImageUrl(file) {
  if (!file) return '';
  return file.path || '';
}

async function checkIn(req, res, next) {
  try {
    const workerId = req.user.userId;
    const oid = new mongoose.Types.ObjectId(workerId);
    const faceFile = req.files?.faceImage?.[0];
    const fieldFile = req.files?.fieldImage?.[0];
    if (!faceFile || !fieldFile) {
      return sendError(res, 'faceImage and fieldImage are required', 400);
    }

    const taskIdRaw = firstFormScalar(req.body.taskId);
    const latitudeRaw = firstFormScalar(req.body.latitude);
    const longitudeRaw = firstFormScalar(req.body.longitude);
    if (!taskIdRaw || latitudeRaw === undefined || longitudeRaw === undefined) {
      return sendError(res, 'taskId, latitude, and longitude are required', 400);
    }
    const taskId = String(taskIdRaw).trim();
    if (!mongoose.isValidObjectId(taskId)) {
      return sendError(res, 'Invalid task id', 400);
    }

    const lat = parseFloat(latitudeRaw);
    const lon = parseFloat(longitudeRaw);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return sendError(res, 'Invalid latitude or longitude', 400);
    }

    const task = await Task.findOne({
      _id: taskId,
      assignedWorkers: oid,
      status: 'ACTIVE',
      isDeleted: false,
    });

    if (!task) {
      return sendError(res, 'Task not found or not assigned to you', 404);
    }

    const { start, end } = startEndOfToday();
    const duplicate = await AttendanceRecord.findOne({
      worker: oid,
      task: taskId,
      checkInTime: { $exists: true, $ne: null, $gte: start, $lte: end },
      isDeleted: false,
    });
    if (duplicate) {
      return sendError(res, 'Already checked in for this task today', 400);
    }

    const now = new Date();
    const bufferIn = task.checkInBuffer ?? 15;
    const timeCheck = checkWindowAgainstTimeStr(
      task.startTime,
      bufferIn,
      now,
      'Check-in outside allowed time window'
    );
    const timeValid = timeCheck.timeValid;
    const timeReason = timeCheck.reason;

    const distance = getDistanceInMeters(lat, lon, task.latitude, task.longitude);
    let locationValid = true;
    let locationReason = '';
    if (distance > task.allowedRadius) {
      locationValid = false;
      locationReason = `Location too far from task site (${Math.round(distance)}m away, limit: ${task.allowedRadius}m)`;
    }

    // faceFile.path is the Cloudinary https:// URL after upload
    const faceResult = await verifyFaceWithPythonService(faceFile.path, workerId);
    const faceValid = faceResult.faceValid;
    const faceReason = faceResult.reason;

    const flagReasons = [];
    if (!timeValid) flagReasons.push(timeReason);
    if (!locationValid) flagReasons.push(locationReason);
    if (!faceValid) flagReasons.push(faceReason);

    const status = flagReasons.length > 0 ? 'FLAGGED' : 'PENDING';
    const beforeUrl = getFieldImageUrl(fieldFile);

    const record = await AttendanceRecord.create({
      worker: oid,
      task: task._id,
      checkInTime: now,
      checkInLocation: { latitude: lat, longitude: lon },
      checkInFaceMatch: faceValid,
      beforeImage: beforeUrl,
      status,
      flagReasons,
    });

    if (status === 'FLAGGED') {
      try {
        const recipient = notificationRecipientId(task.createdBy);
        if (recipient && mongoose.isValidObjectId(recipient)) {
          const workerDoc = await User.findById(workerId).select('fullName').lean();
          const fullName = workerDoc?.fullName || 'Worker';
          const msg = `Check-in flagged for worker ${fullName} on task ${task.title}: ${flagReasons.join(', ')}`;
          await Notification.create({
            recipient,
            message: msg.slice(0, 4000),
            type: 'FLAG',
            relatedId: record._id,
          });
        }
      } catch (notifyErr) {
        console.error('Check-in notification failed:', notifyErr);
      }
    }

    const message =
      flagReasons.length > 0
        ? 'Checked in with flags — team lead notified'
        : 'Checked in successfully';

    return sendSuccess(
      res,
      {
        attendanceId: record._id,
        status,
        flagReasons,
        checkInTime: record.checkInTime,
        message,
      },
      message
    );
  } catch (err) {
    next(err);
  }
}

async function checkOut(req, res, next) {
  try {
    const workerId = req.user.userId;
    const oid = new mongoose.Types.ObjectId(workerId);
    const faceFile = req.files?.faceImage?.[0];
    const fieldFile = req.files?.fieldImage?.[0];
    if (!faceFile || !fieldFile) {
      return sendError(res, 'faceImage and fieldImage are required', 400);
    }

    const attendanceIdRaw = firstFormScalar(req.body.attendanceId);
    const latitudeRaw = firstFormScalar(req.body.latitude);
    const longitudeRaw = firstFormScalar(req.body.longitude);
    if (!attendanceIdRaw || latitudeRaw === undefined || longitudeRaw === undefined) {
      return sendError(res, 'attendanceId, latitude, and longitude are required', 400);
    }
    const attendanceId = String(attendanceIdRaw).trim();
    if (!mongoose.isValidObjectId(attendanceId)) {
      return sendError(res, 'Invalid attendance id', 400);
    }

    const earlyReason = firstFormScalar(req.body.earlyCheckoutReason) || '';

    const lat = parseFloat(latitudeRaw);
    const lon = parseFloat(longitudeRaw);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return sendError(res, 'Invalid latitude or longitude', 400);
    }

    const record = await AttendanceRecord.findOne({
      _id: attendanceId,
      worker: oid,
      isDeleted: false,
    });

    if (!record) {
      return sendError(res, 'Attendance record not found', 404);
    }
    if (record.checkOutTime) {
      return sendError(res, 'Already checked out', 400);
    }
    if (!record.checkInTime) {
      return sendError(res, 'Cannot check out without checking in first', 400);
    }

    const task = await Task.findById(record.task);
    if (!task) {
      return sendError(res, 'Associated task not found', 404);
    }

    const now = new Date();
    const bufferOut = task.checkOutBuffer ?? 15;
    const timeCheck = checkWindowAgainstTimeStr(
      task.endTime,
      bufferOut,
      now,
      'Check-out outside allowed time window'
    );
    const timeValid = timeCheck.timeValid;
    const timeReason = timeCheck.reason;

    const distance = getDistanceInMeters(lat, lon, task.latitude, task.longitude);
    let locationValid = true;
    let locationReason = '';
    if (distance > task.allowedRadius) {
      locationValid = false;
      locationReason = `Location too far from task site (${Math.round(distance)}m away, limit: ${task.allowedRadius}m)`;
    }

    // faceFile.path is the Cloudinary https:// URL after upload
    const faceResult = await verifyFaceWithPythonService(faceFile.path, workerId);
    const faceValid = faceResult.faceValid;
    const faceReason = faceResult.reason;

    const earlyCheck = checkIsEarly(task.endTime, now);
    const isEarly = earlyCheck.isEarly;
    const earlyMins = earlyCheck.minutes;

    const newFlagReasons = [];
    if (!timeValid) newFlagReasons.push(timeReason);
    if (!locationValid) newFlagReasons.push(locationReason);
    if (!faceValid) newFlagReasons.push(faceReason);
    if (isEarly) newFlagReasons.push(`Early checkout (${earlyMins}m early)`);

    const existingFlags = Array.isArray(record.flagReasons)
      ? record.flagReasons.map((r) => String(r).trim()).filter(Boolean)
      : [];
    const allFlags = [...existingFlags, ...newFlagReasons];
    const finalStatus = allFlags.length === 0 ? 'VERIFIED' : 'FLAGGED';

    const afterImageUrl = getFieldImageUrl(fieldFile);
    const updated = await AttendanceRecord.findOneAndUpdate(
      {
        _id: attendanceId,
        worker: oid,
        isDeleted: false,
        checkOutTime: null,
      },
      {
        $set: {
          checkOutTime: now,
          checkOutLocation: { latitude: lat, longitude: lon },
          checkOutFaceMatch: faceValid,
          afterImage: afterImageUrl,
          status: finalStatus,
          flagReasons: allFlags,
          isEarlyCheckout: isEarly,
          earlyCheckoutReason: earlyReason,
          earlyCheckoutMinutes: earlyMins,
          tlApprovalStatus: isEarly ? 'PENDING' : 'APPROVED',
        },
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      const cur = await AttendanceRecord.findOne({
        _id: attendanceId,
        worker: oid,
        isDeleted: false,
      });
      if (!cur) return sendError(res, 'Attendance record not found', 404);
      if (cur.checkOutTime) return sendError(res, 'Already checked out', 400);
      return sendError(res, 'Could not complete check-out. Please try again.', 409);
    }

    if (finalStatus === 'FLAGGED') {
      try {
        const recipient = notificationRecipientId(task.createdBy);
        if (recipient && mongoose.isValidObjectId(recipient)) {
          const workerDoc = await User.findById(workerId).select('fullName').lean();
          const fullName = workerDoc?.fullName || 'Worker';
          const taskTitle = task.title != null ? String(task.title) : 'Task';
          
          let msg;
          if (isEarly) {
            const h = Math.floor(earlyMins / 60);
            const m = earlyMins % 60;
            const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
            msg = `${fullName} checkedout ${timeStr} early on task ${taskTitle}. Reason: ${earlyReason || 'No reason provided'}`;
          } else {
            msg = `Check-out flagged for worker ${fullName} on task ${taskTitle}: ${allFlags.join(', ')}`;
          }

          await Notification.create({
            recipient,
            message: msg.slice(0, 4000),
            type: isEarly ? 'LEAVE' : 'FLAG', // using LEAVE type for approval flow if appropriate, or just FLAG
            relatedId: updated._id,
          });
        }
      } catch (notifyErr) {
        console.error('Check-out notification failed:', notifyErr);
      }
    }

    const message =
      finalStatus === 'VERIFIED'
        ? 'Attendance verified successfully!'
        : 'Checked out with flags — team lead notified';

    return sendSuccess(
      res,
      {
        attendanceId: updated._id,
        finalStatus,
        flagReasons: allFlags,
        checkInTime: updated.checkInTime,
        checkOutTime: updated.checkOutTime,
        message,
      },
      message
    );
  } catch (err) {
    next(err);
  }
}

async function getAttendanceHistory(req, res, next) {
  try {
    const workerId = req.user.userId;
    const oid = new mongoose.Types.ObjectId(workerId);
    const now = new Date();

    let month = parseInt(req.query.month, 10);
    let year = parseInt(req.query.year, 10);
    if (Number.isNaN(month) || month < 1 || month > 12) {
      month = now.getMonth() + 1;
    }
    if (Number.isNaN(year)) {
      year = now.getFullYear();
    }

    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const baseWorkerFilter = { worker: oid, isDeleted: false };

    const [monthRecords, total, verified, flagged, pending] = await Promise.all([
      AttendanceRecord.find({
        worker: oid,
        isDeleted: false,
        checkInTime: { $gte: monthStart, $lte: monthEnd },
      })
        .populate('task', 'title locationName workType date startTime endTime')
        .sort({ checkInTime: 1 })
        .lean(),
      AttendanceRecord.countDocuments(baseWorkerFilter),
      AttendanceRecord.countDocuments({ ...baseWorkerFilter, status: 'VERIFIED' }),
      AttendanceRecord.countDocuments({ ...baseWorkerFilter, status: 'FLAGGED' }),
      AttendanceRecord.countDocuments({ ...baseWorkerFilter, status: 'PENDING' }),
    ]);

    const attendanceRate = total > 0 ? Math.round((verified / total) * 100) : 0;

    return sendSuccess(
      res,
      {
        records: monthRecords,
        stats: {
          total,
          verified,
          flagged,
          pending,
          attendanceRate,
        },
        month,
        year,
      },
      'Attendance history'
    );
  } catch (err) {
    next(err);
  }
}

async function getAttendanceDetail(req, res, next) {
  try {
    const workerId = req.user.userId;
    const oid = new mongoose.Types.ObjectId(workerId);
    const { id: attendanceId } = req.params;

    if (!mongoose.isValidObjectId(attendanceId)) {
      return sendError(res, 'Record not found', 404);
    }

    const record = await AttendanceRecord.findOne({
      _id: attendanceId,
      worker: oid,
      isDeleted: false,
    })
      .populate('task')
      .populate('worker', 'fullName username')
      .lean();

    if (!record) {
      return sendError(res, 'Record not found', 404);
    }

    return sendSuccess(res, { record }, 'Attendance detail');
  } catch (err) {
    next(err);
  }
}

async function getLeaveData(req, res, next) {
  try {
    const workerId = req.user.userId;
    const oid = new mongoose.Types.ObjectId(workerId);

    const allLeaves = await LeaveRequest.find({ worker: oid })
      .sort({ createdAt: -1 })
      .populate('reviewedBy', 'fullName')
      .lean();

    const usedLeaves = sumApprovedLeaveDays(allLeaves);
    const pendingLeaves = allLeaves.filter((l) => l.status === 'PENDING').length;
    const remaining = TOTAL_LEAVES_PER_YEAR - usedLeaves;

    return sendSuccess(
      res,
      {
        leaves: allLeaves,
        balance: {
          total: TOTAL_LEAVES_PER_YEAR,
          used: usedLeaves,
          remaining,
          pending: pendingLeaves,
        },
      },
      'Leave data'
    );
  } catch (err) {
    next(err);
  }
}

async function submitLeave(req, res, next) {
  try {
    const workerId = req.user.userId;
    const oid = new mongoose.Types.ObjectId(workerId);
    const { fromDate, toDate, reason, leaveType } = req.body;

    if (!fromDate || !toDate || reason == null || reason === '' || !leaveType) {
      return sendError(res, 'fromDate, toDate, reason, and leaveType are required', 400);
    }

    const reasonStr = String(reason).trim();
    if (reasonStr.length < 10) {
      return sendError(res, 'Reason must be at least 10 characters', 400);
    }

    if (!WORKER_LEAVE_TYPES.includes(leaveType)) {
      return sendError(res, 'Invalid leave type', 400);
    }

    const fromD = parseBodyDate(fromDate);
    const toD = parseBodyDate(toDate);
    if (!fromD || !toD || Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime())) {
      return sendError(res, 'Invalid date values', 400);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fromStart = new Date(fromD);
    fromStart.setHours(0, 0, 0, 0);
    if (fromStart < today) {
      return sendError(res, 'Leave start date cannot be in the past', 400);
    }

    const toStart = new Date(toD);
    toStart.setHours(0, 0, 0, 0);
    if (toStart < fromStart) {
      return sendError(res, 'End date must be after start date', 400);
    }

    const overlap = await LeaveRequest.findOne({
      worker: oid,
      status: { $ne: 'REJECTED' },
      fromDate: { $lte: toD },
      toDate: { $gte: fromD },
    }).lean();

    if (overlap) {
      return sendError(res, 'You already have a leave request for these dates', 400);
    }

    const daysRequested = leaveSpanDays(fromD, toD);

    const approvedLeaves = await LeaveRequest.find({ worker: oid, status: 'APPROVED' }).lean();
    const usedLeaves = sumApprovedLeaveDays(approvedLeaves);
    const remainingEntitlement = Math.max(0, TOTAL_LEAVES_PER_YEAR - usedLeaves);
    const paidDaysInRequest = Math.min(daysRequested, remainingEntitlement);
    const excessUnpaidDays = Math.max(0, daysRequested - remainingEntitlement);
    const exceedsEntitlement = excessUnpaidDays > 0;

    const leaveRequest = await LeaveRequest.create({
      worker: oid,
      fromDate: fromD,
      toDate: toD,
      reason: reasonStr,
      leaveType,
      status: 'PENDING',
      exceedsEntitlement,
      paidDaysInRequest,
      excessUnpaidDays,
    });

    const workerName = req.user.name || 'A worker';
    const fromLabel = fromStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const toLabel = toStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const dayWord = (n) => `${n} day${n === 1 ? '' : 's'}`;
    const balanceLine = exceedsEntitlement
      ? `${dayWord(daysRequested)} total. ${dayWord(paidDaysInRequest)} within paid annual leave; ${dayWord(
          excessUnpaidDays
        )} exceed balance (unpaid/extra — pending your approval).`
      : `${dayWord(daysRequested)} total — all within paid annual leave.`;

    const teamLeadMessage = `${workerName} requested ${leaveType} leave (${fromLabel} – ${toLabel}). ${balanceLine}`;

    const teamLeads = await User.find({ role: ROLES.TEAM_LEAD, isDeleted: false }).select('_id').lean();
    if (teamLeads.length > 0) {
      await Notification.insertMany(
        teamLeads.map((tl) => ({
          recipient: tl._id,
          message: teamLeadMessage,
          type: 'LEAVE',
          relatedId: leaveRequest._id,
        }))
      );
    }

    const populated = await LeaveRequest.findById(leaveRequest._id)
      .populate('reviewedBy', 'fullName')
      .lean();

    return sendSuccess(res, { leave: populated }, 'Leave request submitted successfully');
  } catch (err) {
    next(err);
  }
}

async function cancelLeave(req, res, next) {
  try {
    const workerId = req.user.userId;
    const oid = new mongoose.Types.ObjectId(workerId);
    const { id: leaveId } = req.params;

    if (!mongoose.isValidObjectId(leaveId)) {
      return sendError(res, 'Leave request not found', 404);
    }

    const leave = await LeaveRequest.findOne({ _id: leaveId, worker: oid });
    if (!leave) {
      return sendError(res, 'Leave request not found', 404);
    }
    if (leave.status !== 'PENDING') {
      return sendError(res, 'Only pending leave requests can be cancelled', 400);
    }

    await LeaveRequest.deleteOne({ _id: leave._id });
    return sendSuccess(res, {}, 'Leave request cancelled');
  } catch (err) {
    next(err);
  }
}

async function getLeaveRequests(req, res, next) {
  return getLeaveData(req, res, next);
}

async function submitLeaveRequest(req, res, next) {
  const b = req.body;
  if (b.startDate != null && b.fromDate == null) b.fromDate = b.startDate;
  if (b.endDate != null && b.toDate == null) b.toDate = b.endDate;
  return submitLeave(req, res, next);
}

async function cancelLeaveRequest(req, res, next) {
  return cancelLeave(req, res, next);
}

const REPORT_STATUS_FILTER = ['SUBMITTED', 'APPROVED', 'REJECTED'];

async function getWorkerTasks(req, res, next) {
  try {
    const workerId = req.user.userId;
    const oid = new mongoose.Types.ObjectId(workerId);
    const from = new Date();
    from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);

    const tasks = await Task.find({
      assignedWorkers: oid,
      status: { $in: ['ACTIVE', 'COMPLETED'] },
      isDeleted: false,
      date: { $gte: from },
    })
      .sort({ date: -1 })
      .select('title locationName date workType startTime endTime status reportFields')
      .lean();

    return sendSuccess(res, { tasks }, 'Worker tasks');
  } catch (err) {
    next(err);
  }
}

function categorizeWorkerTask(task, dayStart, dayEnd) {
  const d = new Date(task.date);
  if (d < dayStart) return 'PAST';
  if (task.status === 'COMPLETED') return 'PAST';
  if (d > dayEnd) return 'UPCOMING';
  return 'TODAY';
}

async function getAllWorkerTasks(req, res, next) {
  try {
    const workerId = req.user.userId;
    const oid = new mongoose.Types.ObjectId(workerId);
    const { start: dayStart, end: dayEnd } = startEndOfToday();

    const tasksRaw = await Task.find({
      assignedWorkers: { $in: [oid] },
      isDeleted: false,
    })
      .sort({ date: -1 })
      .select(
        'title description workType locationName latitude longitude allowedRadius date startTime endTime checkInBuffer checkOutBuffer status reportFields createdBy assignedWorkers'
      )
      .populate('createdBy', 'fullName')
      .lean();

    const taskIds = tasksRaw.map((t) => t._id);
    const reports =
      taskIds.length === 0
        ? []
        : await FieldReport.find({ worker: oid, task: { $in: taskIds } })
            .select('_id status task')
            .lean();
    const reportByTaskId = new Map(reports.map((r) => [String(r.task), r]));

    const tasks = tasksRaw.map((task) => {
      const report = reportByTaskId.get(String(task._id));
      const category = categorizeWorkerTask(task, dayStart, dayEnd);
      return {
        ...task,
        category,
        reportStatus: report?.status || null,
        reportId: report?._id || null,
      };
    });

    return sendSuccess(res, { tasks }, 'All worker tasks');
  } catch (err) {
    next(err);
  }
}

async function getReports(req, res, next) {
  try {
    const workerId = req.user.userId;
    const oid = new mongoose.Types.ObjectId(workerId);
    const { status: statusParam } = req.query;
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    if (Number.isNaN(page) || page < 1) page = 1;
    if (Number.isNaN(limit) || limit < 1) limit = 10;

    const filter = { worker: oid };
    if (statusParam && REPORT_STATUS_FILTER.includes(String(statusParam).toUpperCase())) {
      filter.status = String(statusParam).toUpperCase();
    }

    const skip = (page - 1) * limit;

    const [
      reports,
      total,
      statsTotal,
      statsSubmitted,
      statsApproved,
      statsRejected,
    ] = await Promise.all([
      FieldReport.find(filter)
        .populate('task', 'title locationName date workType')
        .populate('reviewedBy', 'fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FieldReport.countDocuments(filter),
      FieldReport.countDocuments({ worker: oid }),
      FieldReport.countDocuments({ worker: oid, status: 'SUBMITTED' }),
      FieldReport.countDocuments({ worker: oid, status: 'APPROVED' }),
      FieldReport.countDocuments({ worker: oid, status: 'REJECTED' }),
    ]);

    return sendSuccess(
      res,
      {
        reports,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 0,
        },
        stats: {
          total: statsTotal,
          submitted: statsSubmitted,
          approved: statsApproved,
          rejected: statsRejected,
        },
      },
      'Reports'
    );
  } catch (err) {
    next(err);
  }
}

async function submitReport(req, res, next) {
  try {
    const workerId = req.user.userId;
    const oid = new mongoose.Types.ObjectId(workerId);
    const { taskId, attendanceId, description, summary } = req.body;

    if (!taskId) {
      return sendError(res, 'taskId is required', 400);
    }
    if (description == null || String(description).trim().length < 20) {
      return sendError(res, 'Description must be at least 20 characters', 400);
    }

    if (!mongoose.isValidObjectId(taskId)) {
      return sendError(res, 'Task not found', 404);
    }

    const task = await Task.findOne({
      _id: taskId,
      assignedWorkers: oid,
      isDeleted: false,
    });

    if (!task) {
      return sendError(res, 'Task not found', 404);
    }

    let attendanceRef = null;
    if (attendanceId != null && String(attendanceId).trim() !== '') {
      if (!mongoose.isValidObjectId(attendanceId)) {
        return sendError(res, 'Attendance record not found', 404);
      }
      const att = await AttendanceRecord.findOne({
        _id: attendanceId,
        worker: oid,
        isDeleted: false,
      }).lean();
      if (!att) {
        return sendError(res, 'Attendance record not found', 404);
      }
      attendanceRef = new mongoose.Types.ObjectId(attendanceId);
    }

    const existing = await FieldReport.findOne({ worker: oid, task: taskId }).lean();
    if (existing) {
      return sendError(res, 'Report already submitted for this task', 400);
    }

    const taskFieldDefs = Array.isArray(task.reportFields) ? task.reportFields : [];
    const responseRows = normalizeReportFieldResponses(req.body.reportFieldResponses);
    const responseByName = new Map(responseRows.map((r) => [r.fieldName, r]));
    const reportFieldResponses = [];

    for (const def of taskFieldDefs) {
      const fieldName = String(def?.fieldName || '').trim();
      const fieldType = String(def?.fieldType || '').trim();
      if (!fieldName) continue;

      const incoming = responseByName.get(fieldName);
      const rawValue = incoming ? incoming.value : '';

      if (fieldType === 'Number') {
        const valueStr = String(rawValue ?? '').trim();
        if (valueStr !== '' && Number.isNaN(Number(valueStr))) {
          return sendError(res, `Invalid number value for "${fieldName}"`, 400);
        }
        reportFieldResponses.push({ fieldName, fieldType, value: valueStr });
        continue;
      }

      if (fieldType === 'Yes/No') {
        const normalized = normalizeYesNoValue(rawValue);
        if (String(rawValue ?? '').trim() !== '' && normalized === '') {
          return sendError(res, `Invalid yes/no value for "${fieldName}"`, 400);
        }
        reportFieldResponses.push({ fieldName, fieldType, value: normalized });
        continue;
      }

      if (fieldType === 'Date') {
        const valueStr = String(rawValue ?? '').trim();
        if (valueStr !== '' && Number.isNaN(new Date(valueStr).getTime())) {
          return sendError(res, `Invalid date value for "${fieldName}"`, 400);
        }
        reportFieldResponses.push({ fieldName, fieldType, value: valueStr });
        continue;
      }

      const valueStr = String(rawValue ?? '').trim();
      reportFieldResponses.push({ fieldName, fieldType, value: valueStr });
    }

    const imagePaths = (req.files || []).map((f) => f.path);

    const created = await FieldReport.create({
      worker: oid,
      task: taskId,
      attendance: attendanceRef,
      description: String(description).trim(),
      summary: summary != null ? String(summary).trim() : '',
      reportFieldResponses,
      images: imagePaths,
      status: 'SUBMITTED',
    });

    const report = await FieldReport.findById(created._id)
      .populate('task', 'title locationName date workType')
      .populate('reviewedBy', 'fullName')
      .lean();

    return sendSuccess(res, { report }, 'Report submitted successfully', 201);
  } catch (err) {
    next(err);
  }
}

async function getReportDetail(req, res, next) {
  try {
    const workerId = req.user.userId;
    const oid = new mongoose.Types.ObjectId(workerId);
    const { id: reportId } = req.params;

    if (!mongoose.isValidObjectId(reportId)) {
      return sendError(res, 'Record not found', 404);
    }

    const report = await FieldReport.findOne({
      _id: reportId,
      worker: oid,
    })
      .populate('task')
      .populate('reviewedBy', 'fullName')
      .lean();

    if (!report) {
      return sendError(res, 'Record not found', 404);
    }

    return sendSuccess(res, { report }, 'Report detail');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboardData,
  getTodayAttendance,
  checkIn,
  checkOut,
  getAttendanceHistory,
  getAttendanceDetail,
  getLeaveData,
  submitLeave,
  cancelLeave,
  getLeaveRequests,
  submitLeaveRequest,
  cancelLeaveRequest,
  getWorkerTasks,
  getAllWorkerTasks,
  getReports,
  submitReport,
  getReportDetail,
};
