const mongoose = require('mongoose');

const AttendanceRecordSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    checkInTime: { type: Date },
    checkInLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    checkInFaceMatch: { type: Boolean },
    beforeImage: { type: String },
    checkOutTime: { type: Date },
    checkOutLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    checkOutFaceMatch: { type: Boolean },
    afterImage: { type: String },
    status: { type: String, enum: ['PENDING', 'VERIFIED', 'FLAGGED', 'REJECTED'], default: 'PENDING' },
    isLate: { type: Boolean, default: false },
    flagReasons: [{ type: String }],
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolutionRemark: { type: String, default: '' },
    isEarlyCheckout: { type: Boolean, default: false },
    earlyCheckoutReason: { type: String, default: '' },
    earlyCheckoutMinutes: { type: Number, default: 0 },
    tlApprovalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AttendanceRecord', AttendanceRecordSchema);

