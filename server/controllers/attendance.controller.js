const attendanceService = require('../services/attendance.service');
const AttendanceRecord = require('../models/AttendanceRecord');
const User = require('../models/User');
const { sendSuccess, sendError } = require('../utils/response');

function getUserId(req) {
  return req.user?.userId || req.userId;
}

const checkIn = async (req, res) => {
  try {
    const { taskId, lat, lon } = req.body;
    const userId = getUserId(req);
    if (!userId) return sendError(res, 'Unauthorized', 401);

    const isLocationValid = await attendanceService.validateCheckIn(taskId, lat, lon);
    let status = 'VERIFIED';
    const flags = [];

    if (!isLocationValid) {
      status = 'FLAGGED';
      flags.push('OUT_OF_RADIUS_CHECKIN');
    }

    let faceMatched = true;
    let imagePath = null;
    if (req.file) {
      imagePath = req.file.path;
      const user = await User.findById(userId).select('faceEncoding role');
      if (user?.role === 'FIELD_WORKER' && user.faceEncoding) {
        const matchResult = await attendanceService.verifyFaceMatch(
          imagePath,
          user.faceEncoding.toString('base64')
        );
        faceMatched = !!matchResult.matched;
        if (!matchResult.matched) {
          status = 'FLAGGED';
          flags.push('FACE_MISMATCH_CHECKIN');
        }
      }
    }

    const attendanceId = await attendanceService.createCheckIn({
      userId,
      taskId,
      lat: Number(lat),
      lon: Number(lon),
      imagePath,
      status,
      faceMatched,
      flagReasons: flags,
    });

    return sendSuccess(res, { id: attendanceId, status, flags }, 'Check-in recorded');
  } catch (error) {
    return sendError(res, error.message || 'Check-in failed', 500);
  }
};

const checkOut = async (req, res) => {
  try {
    const { taskId, lat, lon } = req.body;
    const workerId = getUserId(req);
    if (!workerId) return sendError(res, 'Unauthorized', 401);

    const attendance = await AttendanceRecord.findOne({
      task: taskId,
      worker: workerId,
      checkOutTime: { $exists: false },
    }).sort({ checkInTime: -1, createdAt: -1 });

    if (!attendance) {
      return sendError(res, 'Active check-in not found', 400);
    }

    const isLocationValid = await attendanceService.validateCheckIn(taskId, lat, lon);
    let status = 'VERIFIED';
    const flags = [];

    if (!isLocationValid) {
      status = 'FLAGGED';
      flags.push('OUT_OF_RADIUS_CHECKOUT');
    }

    let faceMatched = true;
    let imagePath = null;
    if (req.file) {
      imagePath = req.file.path;
      const user = await User.findById(workerId).select('faceEncoding role');
      if (user?.role === 'FIELD_WORKER' && user.faceEncoding) {
        const matchResult = await attendanceService.verifyFaceMatch(
          imagePath,
          user.faceEncoding.toString('base64')
        );
        faceMatched = !!matchResult.matched;
        if (!matchResult.matched) {
          status = 'FLAGGED';
          flags.push('FACE_MISMATCH_CHECKOUT');
        }
      }
    }

    await attendanceService.createCheckOut(attendance._id.toString(), {
      lat: Number(lat),
      lon: Number(lon),
      imagePath,
      status,
      faceMatched,
      flagReasons: flags,
    });

    return sendSuccess(res, { status, flags }, 'Check-out successful');
  } catch (error) {
    return sendError(res, error.message || 'Check-out failed', 500);
  }
};

const submitReport = async (req, res) => {
  try {
    const { taskId, description } = req.body;
    const workerId = getUserId(req);
    if (!workerId) return sendError(res, 'Unauthorized', 401);

    const attendance = await AttendanceRecord.findOne({ task: taskId, worker: workerId }).sort({
      checkInTime: -1,
      createdAt: -1,
    });
    if (!attendance) {
      return sendError(res, 'Attendance record not found', 400);
    }

    const imagesPaths = req.files ? req.files.map((f) => f.path) : [];
    await attendanceService.submitReport({
      workerId,
      taskId,
      attendanceId: attendance._id.toString(),
      description,
      imagesPaths,
    });
    return sendSuccess(res, {}, 'Report submitted successfully');
  } catch (error) {
    return sendError(res, error.message || 'Report submit failed', 500);
  }
};

const getAllAttendance = async (req, res) => {
  try {
    const data = await attendanceService.getAllAttendance();
    return sendSuccess(res, data);
  } catch (error) {
    return sendError(res, error.message || 'Failed to load attendance', 500);
  }
};

const getCurrentAttendance = async (req, res) => {
  try {
    const { taskId } = req.params;
    const workerId = getUserId(req);
    if (!workerId) return sendError(res, 'Unauthorized', 401);
    const record = await AttendanceRecord.findOne({ task: taskId, worker: workerId }).sort({
      checkInTime: -1,
      createdAt: -1,
    });
    return sendSuccess(res, record || null);
  } catch (error) {
    return sendError(res, error.message || 'Failed to load record', 500);
  }
};

const reviewAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return sendError(res, 'status is required', 400);
    await attendanceService.reviewAttendance(id, status);
    return sendSuccess(res, {}, 'Attendance updated');
  } catch (error) {
    return sendError(res, error.message || 'Review failed', 500);
  }
};

module.exports = {
  checkIn,
  checkOut,
  submitReport,
  getAllAttendance,
  reviewAttendance,
  getCurrentAttendance,
};
