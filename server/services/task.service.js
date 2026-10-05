const Task = require('../models/Task');
const TaskLocation = require('../models/TaskLocation');

const createTask = async (taskData) => {
  const { title, description, location_id, start_time, end_time, created_by, worker_ids } = taskData;
  const loc = await TaskLocation.findById(location_id);
  if (!loc) {
    const err = new Error('Location not found');
    err.statusCode = 400;
    throw err;
  }
  const task = await Task.create({
    title,
    description: description || '',
    locationName: loc.name,
    latitude: loc.latitude,
    longitude: loc.longitude,
    allowedRadius: loc.radius,
    date: new Date(),
    startTime: String(start_time),
    endTime: String(end_time),
    workType: 'GENERAL',
    createdBy: created_by,
    assignedWorkers: Array.isArray(worker_ids) ? worker_ids : [],
  });
  return task._id.toString();
};

const assignWorkers = async (taskId, workerIds) => {
  await Task.findByIdAndUpdate(taskId, { $addToSet: { assignedWorkers: { $each: workerIds } } });
};

const getTasksByWorker = async (workerId) => {
  return Task.find({ assignedWorkers: workerId, isDeleted: false }).sort({ createdAt: -1 });
};

const getAllTasks = async () => {
  return Task.find({ isDeleted: false }).populate('createdBy', 'fullName username role').sort({ createdAt: -1 });
};

module.exports = { createTask, assignWorkers, getTasksByWorker, getAllTasks };
