const mongoose = require('mongoose');

const LeaveRequestSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    teamLead: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    leaveType: {
      type: String,
      enum: ['SICK', 'CASUAL', 'EMERGENCY', 'OTHER'],
      default: 'CASUAL',
    },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    totalDays: { type: Number, default: 1 },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    /** Snapshot at submit for team-lead review / dashboard integration */
    exceedsEntitlement: { type: Boolean, default: false },
    paidDaysInRequest: { type: Number, default: 0 },
    excessUnpaidDays: { type: Number, default: 0 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewNote: { type: String, default: '' },
  },
  { timestamps: true }
);

LeaveRequestSchema.pre('save', function computeTotalDays() {
  if (this.fromDate && this.toDate) {
    const a = new Date(this.fromDate).setHours(0, 0, 0, 0);
    const b = new Date(this.toDate).setHours(0, 0, 0, 0);
    this.totalDays = Math.max(1, Math.round((b - a) / 86400000) + 1);
  }
});

module.exports = mongoose.model('LeaveRequest', LeaveRequestSchema);

