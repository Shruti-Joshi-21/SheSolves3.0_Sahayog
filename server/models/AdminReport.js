const mongoose = require('mongoose');

const AdminReportSchema = new mongoose.Schema(
  {
    fromTeamLead: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    originalReportId: { type: mongoose.Schema.Types.ObjectId, ref: 'FieldReport', required: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
    summary: { type: String, required: true, trim: true },
    forwardedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AdminReport', AdminReportSchema);
