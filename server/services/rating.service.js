const Task = require('../models/Task');
const WorkerRating = require('../models/WorkerRating');

const httpError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const getOwnedTask = async (teamLeadId, taskId) => {
  const task = await Task.findOne({ _id: taskId, isDeleted: false })
    .populate('assignedWorkers', 'fullName username')
    .lean();
  if (!task) throw httpError('Task not found', 404);
  if (String(task.createdBy) !== String(teamLeadId)) throw httpError('Only the team lead who owns this task can rate it', 403);
  return task;
};

// Every assigned worker with their rating for this task (null if not rated yet)
const getTaskRatings = async (teamLeadId, taskId) => {
  const task = await getOwnedTask(teamLeadId, taskId);
  const ratings = await WorkerRating.find({ taskId: task._id }).lean();
  const byWorker = Object.fromEntries(ratings.map((r) => [String(r.workerId), r]));
  return {
    task: { _id: task._id, title: task.title, workType: task.workType, status: task.status },
    canRate: task.status === 'COMPLETED',
    workers: (task.assignedWorkers || []).map((w) => {
      const r = byWorker[String(w._id)];
      return {
        workerId: w._id,
        name: w.fullName || w.username,
        stars: r?.stars ?? null,
        comment: r?.comment ?? '',
        ratedAt: r?.updatedAt ?? null,
      };
    }),
  };
};

const upsertTaskRatings = async (teamLeadId, taskId, ratings) => {
  const task = await getOwnedTask(teamLeadId, taskId);
  if (task.status !== 'COMPLETED') throw httpError('Workers can only be rated after the task is COMPLETED', 400);
  if (!Array.isArray(ratings) || !ratings.length) throw httpError('ratings must be a non-empty array', 400);

  const assigned = new Set((task.assignedWorkers || []).map((w) => String(w._id)));
  for (const r of ratings) {
    if (!assigned.has(String(r.workerId))) throw httpError(`Worker ${r.workerId} is not assigned to this task`, 400);
    if (!Number.isInteger(Number(r.stars)) || Number(r.stars) < 1 || Number(r.stars) > 5) throw httpError('stars must be an integer from 1 to 5', 400);
    if (r.comment && String(r.comment).length > 300) throw httpError('comment must be at most 300 characters', 400);
  }

  await WorkerRating.bulkWrite(
    ratings.map((r) => ({
      updateOne: {
        filter: { taskId: task._id, workerId: r.workerId },
        update: {
          $set: { stars: Number(r.stars), comment: String(r.comment || '').trim(), ratedBy: teamLeadId, workType: task.workType },
        },
        upsert: true,
      },
    }))
  );
  return getTaskRatings(teamLeadId, taskId);
};

module.exports = { getTaskRatings, upsertTaskRatings };
