const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    message: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['FLAG', 'LEAVE', 'REPORT', 'TASK', 'GENERAL', 'REPORT_REQUEST'],
      default: 'GENERAL',
    },
    isRead: { type: Boolean, default: false },
    relatedId: { type: mongoose.Schema.Types.ObjectId },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', NotificationSchema);

