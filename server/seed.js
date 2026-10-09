const bcrypt = require('bcrypt');
require('dotenv').config();

const connectDB = require('./config/db');
const User = require('./models/User');
const Task = require('./models/Task');

const SKILL_POOL = [
  'waste segregation',
  'tree plantation',
  'beach cleanup',
  'composting',
  'community awareness',
  'water testing',
  'data collection',
  'first aid',
];

// workType (as offered in Create Task) → skills a worker needs for it
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

function skillsForWorkType(workType) {
  return WORK_TYPE_SKILLS[workType] || [];
}

// Stable pseudo-random profile per username, so re-running the seed doesn't reshuffle skills
function profileForUsername(username) {
  let h = 0;
  for (const ch of String(username)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const count = 2 + (h % 3); // 2–4 skills
  const skills = [];
  for (let i = 0; skills.length < count; i += 1) {
    const s = SKILL_POOL[(h + i * 3) % SKILL_POOL.length];
    if (!skills.includes(s)) skills.push(s);
  }
  return { skills, experienceYears: 1 + (h % 6) };
}

const seed = async () => {
  try {
    console.log('Starting MongoDB seeding...');
    await connectDB();

    const hashedPwd = await bcrypt.hash('password123', 10);

    // Step 1 — Create admin and teamlead first
    const [admin, teamLead] = await Promise.all([
      User.findOneAndUpdate(
        { username: 'admin@sevasetu.gov.in' },
        {
          fullName: 'Suresh Admin',
          username: 'admin@sevasetu.gov.in',
          password: hashedPwd,
          role: 'ADMIN'
        },
        { upsert: true, returnDocument: 'after' }
      ),
      User.findOneAndUpdate(
        { username: 'lead@sevasetu.gov.in' },
        {
          fullName: 'Vikram Lead',
          username: 'lead@sevasetu.gov.in',
          password: hashedPwd,
          role: 'TEAM_LEAD'
        },
        { upsert: true, returnDocument: 'after' }
      ),
    ]);

    // Step 2 — Create workers using teamLead._id
    const [worker1, worker2] = await Promise.all([
      User.findOneAndUpdate(
        { username: 'worker@sevasetu.gov.in' },
        {
          fullName: 'Rahul Worker',
          username: 'worker@sevasetu.gov.in',
          password: hashedPwd,
          role: 'FIELD_WORKER',
          assignedTeamLead: teamLead._id,
          faceImagePath: null,
          faceEncoding: null,
          skills: ['waste segregation', 'beach cleanup', 'first aid'],
          experienceYears: 3,
          languages: ['English', 'Hindi', 'Marathi'],
        },
        { upsert: true, returnDocument: 'after' }
      ),
      User.findOneAndUpdate(
        { username: 'anjali@sevasetu.gov.in' },
        {
          fullName: 'Anjali Field',
          username: 'anjali@sevasetu.gov.in',
          password: hashedPwd,
          role: 'FIELD_WORKER',
          assignedTeamLead: teamLead._id,
          faceImagePath: null,
          faceEncoding: null,
          skills: ['community awareness', 'data collection', 'water testing'],
          experienceYears: 5,
          languages: ['English', 'Hindi'],
        },
        { upsert: true, returnDocument: 'after' }
      ),
    ]);

    // Step 2b — Give every other field worker (e.g. ones registered through the app) a skill profile
    const workersWithoutSkills = await User.find({
      role: 'FIELD_WORKER',
      $or: [{ skills: { $exists: false } }, { skills: { $size: 0 } }],
    })
      .select('username')
      .lean();
    if (workersWithoutSkills.length > 0) {
      await User.bulkWrite(
        workersWithoutSkills.map((w) => ({
          updateOne: { filter: { _id: w._id }, update: { $set: profileForUsername(w.username) } },
        }))
      );
    }

    // Step 3 — Create tasks
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const now = new Date();
    const later = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const timeStr = (d) => d.toTimeString().slice(0, 5);

    await Promise.all([
      Task.findOneAndUpdate(
        { title: 'Beach Cleanliness Survey' },
        {
          title: 'Beach Cleanliness Survey',
          description: 'Assess the cleanliness of Juhu beach after morning hours.',
          locationName: 'Juhu Beach',
          latitude: 19.0988,
          longitude: 72.8264,
          allowedRadius: 50000,
          date: today,
          startTime: timeStr(now),
          endTime: timeStr(later),
          workType: 'Waste Collection',
          requiredSkills: skillsForWorkType('Waste Collection'),
          checkInBuffer: 120,
          checkOutBuffer: 120,
          createdBy: teamLead._id,
          assignedWorkers: [worker1._id],
          status: 'ACTIVE',
          isDeleted: false
        },
        { upsert: true, returnDocument: 'after' }
      ),
      Task.findOneAndUpdate(
        { title: 'Monument Site Inspection' },
        {
          title: 'Monument Site Inspection',
          description: 'Security and maintenance check at Gateway.',
          locationName: 'Gateway of India',
          latitude: 18.9220,
          longitude: 72.8347,
          allowedRadius: 50000,
          date: today,
          startTime: timeStr(now),
          endTime: timeStr(later),
          workType: 'Inspection',
          requiredSkills: skillsForWorkType('Inspection'),
          checkInBuffer: 120,
          checkOutBuffer: 120,
          createdBy: teamLead._id,
          assignedWorkers: [worker2._id],
          status: 'ACTIVE',
          isDeleted: false
        },
        { upsert: true, returnDocument: 'after' }
      ),
    ]);

    // Step 3b — Backfill requiredSkills on existing tasks from their workType
    const tasksWithoutSkills = await Task.find({
      $or: [{ requiredSkills: { $exists: false } }, { requiredSkills: { $size: 0 } }],
    })
      .select('workType')
      .lean();
    const taskUpdates = tasksWithoutSkills
      .filter((t) => skillsForWorkType(t.workType).length > 0)
      .map((t) => ({
        updateOne: { filter: { _id: t._id }, update: { $set: { requiredSkills: skillsForWorkType(t.workType) } } },
      }));
    if (taskUpdates.length > 0) await Task.bulkWrite(taskUpdates);

    console.log(`Skill profiles added to ${workersWithoutSkills.length} other worker(s), requiredSkills to ${taskUpdates.length} task(s)`);
    console.log('Seeding complete!');
    console.log('─────────────────────────────');
    console.log('Login credentials:');
    console.log('FIELD_WORKER → worker@sevasetu.gov.in / password123');
    console.log('FIELD_WORKER → anjali@sevasetu.gov.in / password123');
    console.log('TEAM_LEAD    → lead@sevasetu.gov.in   / password123');
    console.log('ADMIN        → admin@sevasetu.gov.in  / password123');
    console.log('─────────────────────────────');
    console.log('Workers linked to team lead:', teamLead.fullName);
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
};

seed();