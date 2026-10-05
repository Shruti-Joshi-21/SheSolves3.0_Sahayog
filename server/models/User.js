const mongoose = require('mongoose');

const USER_ROLES = ['ADMIN', 'TEAM_LEAD', 'FIELD_WORKER'];

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, required: true },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    faceImagePath: { type: String, default: null },
    faceEncoding: { type: Buffer, default: null },
    assignedTeamLead: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

userSchema.pre('validate', function enforceRoleFields() {
  if (this.role !== 'FIELD_WORKER') {
    this.faceImagePath = null;
    this.faceEncoding = null;
  }
});

module.exports = mongoose.model('User', userSchema);
