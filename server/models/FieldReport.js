const mongoose = require('mongoose');

const FieldReportSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    attendance: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceRecord' },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    description: { type: String, required: true, trim: true },
    summary: { type: String, default: '' },
    reportFieldResponses: {
      type: [
        {
          fieldName: { type: String, trim: true },
          fieldType: { type: String, trim: true },
          value: { type: mongoose.Schema.Types.Mixed, default: '' },
        },
      ],
      default: [],
    },
    period: { type: String, default: '' },
    images: [{ type: String }],
    attachments: [{ type: String }],
    presentCount: { type: Number, default: 0 },
    absentCount: { type: Number, default: 0 },
    flaggedCount: { type: Number, default: 0 },
    tasksCompleted: { type: Number, default: 0 },
    totalTasks: { type: Number, default: 0 },
    isRead: { type: Boolean, default: false },
    status: { type: String, enum: ['SUBMITTED', 'APPROVED', 'REJECTED', 'FORWARDED'], default: 'SUBMITTED' },
    forwardedToAdmin: { type: Boolean, default: false },
    forwardedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewNote: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FieldReport', FieldReportSchema);

