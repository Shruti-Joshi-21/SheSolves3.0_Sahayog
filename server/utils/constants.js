const ROLES = {
  ADMIN: 'ADMIN',
  TEAM_LEAD: 'TEAM_LEAD',
  FIELD_WORKER: 'FIELD_WORKER',
};

const ATTENDANCE_STATUS = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  FLAGGED: 'FLAGGED',
  REJECTED: 'REJECTED',
};

const LEAVE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};
const REPORT_STATUS = ['SUBMITTED', 'APPROVED', 'REJECTED'];

const WORKER_SKILLS = [
  'waste segregation',
  'tree plantation',
  'beach cleanup',
  'composting',
  'community awareness',
  'water testing',
  'data collection',
  'first aid',
];

// Default required skills per task workType (used when a task has no requiredSkills)
const WORK_TYPE_SKILLS = {
  'Waste Collection': ['waste segregation'],
  'Recycling Drive': ['waste segregation', 'composting'],
  'Awareness Campaign': ['community awareness'],
  'Shoreline Cleanup': ['beach cleanup', 'waste segregation'],
  'Tree Plantation': ['tree plantation'],
  'Survey Drive': ['data collection'],
  Inspection: ['data collection', 'water testing'],
  Other: [],
};

module.exports = { ROLES, ATTENDANCE_STATUS, LEAVE_STATUS, REPORT_STATUS, WORKER_SKILLS, WORK_TYPE_SKILLS };
