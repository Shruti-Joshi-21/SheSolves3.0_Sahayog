const Task = require('../models/Task');
const AttendanceRecord = require('../models/AttendanceRecord');
const FieldReport = require('../models/FieldReport');

const validateCheckIn = async (taskId, lat, lon) => {
    const task = await Task.findById(taskId);
    if (!task) return false;

    const distance = calculateDistance(lat, lon, task.latitude, task.longitude);
    return distance <= task.allowedRadius;
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

const verifyFaceMatch = async (imagePath, storedEncodingB64) => {
  // Legacy verify call removed — face verification now handled by
  // workerController.js via /verify-face
  void imagePath;
  void storedEncodingB64;
  return { match: false, matched: false, reason: 'Legacy service disabled' };
};

const createCheckIn = async (checkInData) => {
    const { userId, taskId, lat, lon, imagePath, status, faceMatched, flagReasons } = checkInData;

    const rec = await AttendanceRecord.create({
        worker: userId,
        task: taskId,
        checkInTime: new Date(),
        checkInLocation: { latitude: lat, longitude: lon },
        checkInFaceMatch: faceMatched,
        beforeImage: imagePath,
        status,
        flagReasons: flagReasons || [],
    });

    return rec._id.toString();
};

const createCheckOut = async (attendanceId, checkoutData) => {
    const { lat, lon, imagePath, status, faceMatched, flagReasons } = checkoutData;
    await AttendanceRecord.findByIdAndUpdate(attendanceId, {
        $set: {
            checkOutTime: new Date(),
            checkOutLocation: { latitude: lat, longitude: lon },
            checkOutFaceMatch: faceMatched,
            afterImage: imagePath,
            status,
        },
        ...(flagReasons && flagReasons.length ? { $addToSet: { flagReasons: { $each: flagReasons } } } : {}),
    });
};

const createFlag = async (attendanceId, reason) => {
    await AttendanceRecord.findByIdAndUpdate(attendanceId, { $addToSet: { flagReasons: reason }, $set: { status: 'FLAGGED' } });
};

const submitReport = async (reportData) => {
    const { workerId, taskId, attendanceId, description, imagesPaths } = reportData;
    const report = await FieldReport.create({
        worker: workerId,
        task: taskId,
        attendance: attendanceId,
        description,
        images: imagesPaths || [],
        status: 'SUBMITTED',
    });
    return report._id.toString();
};

const getAllAttendance = async () => {
    return AttendanceRecord.find({ isDeleted: false })
        .populate('worker', 'fullName username role')
        .populate('task', 'title locationName date startTime endTime')
        .sort({ checkInTime: -1, createdAt: -1 });
};

const reviewAttendance = async (id, status) => {
    await AttendanceRecord.findByIdAndUpdate(id, { $set: { status } });
};

module.exports = {
  validateCheckIn,
  verifyFaceMatch,
  createCheckIn,
  createFlag,
  createCheckOut,
  submitReport,
  getAllAttendance,
  reviewAttendance,
};
