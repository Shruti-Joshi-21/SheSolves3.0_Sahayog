const mongoose = require('mongoose');

// One team-lead rating per worker per completed task (Round 3 — smart assignment)
const WorkerRatingSchema = new mongoose.Schema(
  {
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ratedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    stars: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', trim: true, maxlength: 300 },
    workType: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

WorkerRatingSchema.index({ taskId: 1, workerId: 1 }, { unique: true });
WorkerRatingSchema.index({ workerId: 1, workType: 1 });

module.exports = mongoose.model('WorkerRating', WorkerRatingSchema);
