const Task = require('../models/Task');
const AttendanceRecord = require('../models/AttendanceRecord');
const FieldReport = require('../models/FieldReport');

exports.getMapData = async (req, res) => {
  try {
    const { status, dateFrom, dateTo } = req.query;

    const taskFilter = {
      isDeleted: { $ne: true },
      latitude: { $exists: true, $ne: null },
      longitude: { $exists: true, $ne: null },
    };

    if (dateFrom || dateTo) {
      taskFilter.date = {};
      if (dateFrom) taskFilter.date.$gte = new Date(dateFrom);
      if (dateTo) taskFilter.date.$lte = new Date(dateTo);
    }

    const tasks = await Task.find(taskFilter)
      .populate('assignedWorkers', 'fullName')
      .lean();

    const mapData = [];

    for (const task of tasks) {
      const attendanceRecords = await AttendanceRecord.find({
        task: task._id,
        isDeleted: { $ne: true },
      })
        .populate('worker', 'fullName')
        .lean();

      const fieldReports = await FieldReport.find({ task: task._id }).lean();

      const workersList =
        task.assignedWorkers && task.assignedWorkers.length > 0
          ? task.assignedWorkers
          : [null];

      for (const worker of workersList) {
        const workerAttendance = attendanceRecords.find(
          (a) => worker && a.worker?._id?.toString() === worker._id.toString()
        );

        const workerReport = fieldReports.find(
          (r) => worker && r.worker?.toString() === worker._id.toString()
        );

        let derivedStatus = 'PENDING';
        let isFlagged = false;

        if (workerAttendance) {
          isFlagged = workerAttendance.status === 'FLAGGED';

          if (isFlagged) {
            derivedStatus = 'FLAGGED';
          } else if (workerAttendance.checkOutTime) {
            derivedStatus = 'COMPLETED';
          } else if (workerAttendance.checkInTime) {
            derivedStatus = 'IN_PROGRESS';
          }
        }

        if (status && status !== 'ALL' && derivedStatus !== status) {
          continue;
        }

        mapData.push({
          taskId: task._id,
          lat: task.latitude,
          lng: task.longitude,
          taskName: task.title,
          locationAddress: task.locationName || '',
          status: derivedStatus,
          isFlagged,
          workers: worker ? [{ id: worker._id, name: worker.fullName }] : [],
          checkIn: workerAttendance?.checkInTime || null,
          checkOut: workerAttendance?.checkOutTime || null,
          beforePhoto: workerAttendance?.beforeImage || null,
          afterPhoto: workerAttendance?.afterImage || null,
          additionalImages: workerReport?.images || [],
          fieldReportId: workerReport?._id || null,
        });
      }
    }

    res.status(200).json({
      success: true,
      count: mapData.length,
      data: mapData,
    });
  } catch (error) {
    console.error('Error fetching map data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch map data',
      error: error.message,
    });
  }
};