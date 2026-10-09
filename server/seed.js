const bcrypt = require('bcrypt');
require('dotenv').config();

const connectDB = require('./config/db');
const User = require('./models/User');
const Task = require('./models/Task');
const TaskAssignment = require('./models/TaskAssignment');
const AttendanceRecord = require('./models/AttendanceRecord');
const WorkerRating = require('./models/WorkerRating');

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

    // Step 4 — Rating history for smart assignment (Ch1): 4 more workers + past COMPLETED
    // drives with attendance and team-lead ratings, so match scores have real data behind them
    const extraWorkers = await Promise.all(
      [
        { username: 'priya@sevasetu.gov.in', fullName: 'Priya Deshmukh', skills: ['tree plantation', 'composting', 'community awareness'], experienceYears: 4, languages: ['Marathi', 'Hindi'] },
        { username: 'arjun@sevasetu.gov.in', fullName: 'Arjun Patil', skills: ['beach cleanup', 'waste segregation'], experienceYears: 1, languages: ['English', 'Marathi'] },
        { username: 'sneha@sevasetu.gov.in', fullName: 'Sneha Kulkarni', skills: ['water testing', 'data collection', 'first aid'], experienceYears: 6, languages: ['English', 'Marathi'] },
        { username: 'imran@sevasetu.gov.in', fullName: 'Imran Shaikh', skills: ['waste segregation', 'composting', 'tree plantation'], experienceYears: 2, languages: ['Hindi', 'English'] },
      ].map((w) =>
        User.findOneAndUpdate(
          { username: w.username },
          {
            $set: { ...w, password: hashedPwd, role: 'FIELD_WORKER', assignedTeamLead: teamLead._id },
            // Only on insert, so re-seeding never wipes a face registered through the app
            $setOnInsert: { faceImagePath: null, faceEncoding: null },
          },
          { upsert: true, returnDocument: 'after' }
        )
      )
    );
    const [priya, arjun, sneha, imran] = extraWorkers;
    const rahul = worker1;
    const anjali = worker2;

    const daysAgo = (n, h = 9) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      d.setHours(h, 0, 0, 0);
      return d;
    };
    const history = [
      { title: 'Versova Shoreline Cleanup', workType: 'Shoreline Cleanup', locationName: 'Versova Beach', latitude: 19.1351, longitude: 72.8146, ago: 30, crew: [[rahul, 5], [arjun, 4], [imran, 4]] },
      { title: 'Dadar Chowpatty Cleanup', workType: 'Shoreline Cleanup', locationName: 'Dadar Chowpatty', latitude: 19.0176, longitude: 72.8383, ago: 23, crew: [[rahul, 5], [arjun, 3]] },
      { title: 'Aarey Tree Plantation', workType: 'Tree Plantation', locationName: 'Aarey Colony', latitude: 19.155, longitude: 72.8722, ago: 20, crew: [[priya, 5], [imran, 4]] },
      { title: 'Andheri Waste Segregation Drive', workType: 'Waste Collection', locationName: 'Andheri West', latitude: 19.1364, longitude: 72.8296, ago: 16, crew: [[rahul, 4], [imran, 5], [arjun, 4]] },
      { title: 'Powai Lake Water Survey', workType: 'Survey Drive', locationName: 'Powai Lake', latitude: 19.1273, longitude: 72.905, ago: 13, crew: [[anjali, 5], [sneha, 5]] },
      { title: 'Bandra Awareness Campaign', workType: 'Awareness Campaign', locationName: 'Bandra Bandstand', latitude: 19.0544, longitude: 72.8203, ago: 10, crew: [[anjali, 4], [priya, 5]] },
      { title: 'Goregaon Recycling Drive', workType: 'Recycling Drive', locationName: 'Goregaon East', latitude: 19.1663, longitude: 72.8526, ago: 8, crew: [[imran, 5], [priya, 4], [arjun, 2]] },
    ];

    for (const h of history) {
      const task = await Task.findOneAndUpdate(
        { title: h.title },
        {
          title: h.title,
          description: `${h.workType} at ${h.locationName}.`,
          locationName: h.locationName,
          latitude: h.latitude,
          longitude: h.longitude,
          allowedRadius: 300,
          date: daysAgo(h.ago, 0),
          startTime: '09:00',
          endTime: '13:00',
          workType: h.workType,
          requiredSkills: skillsForWorkType(h.workType),
          createdBy: teamLead._id,
          assignedWorkers: h.crew.map(([w]) => w._id),
          status: 'COMPLETED',
          isDeleted: false,
        },
        { upsert: true, returnDocument: 'after' }
      );

      for (const [w, stars] of h.crew) {
        await TaskAssignment.findOneAndUpdate({ taskId: task._id, workerId: w._id }, { taskId: task._id, workerId: w._id }, { upsert: true });
        // Poorly rated attendance is flagged so reliability differs between workers
        const flagged = stars <= 2;
        await AttendanceRecord.findOneAndUpdate(
          { worker: w._id, task: task._id },
          {
            worker: w._id,
            task: task._id,
            checkInTime: daysAgo(h.ago, 9),
            checkInLocation: { latitude: h.latitude + 0.0004, longitude: h.longitude + 0.0004 },
            checkInFaceMatch: !flagged,
            checkOutTime: daysAgo(h.ago, 13),
            checkOutLocation: { latitude: h.latitude + 0.0003, longitude: h.longitude - 0.0002 },
            checkOutFaceMatch: true,
            status: flagged ? 'FLAGGED' : 'VERIFIED',
            flagReasons: flagged ? ['Face mismatch at check-in'] : [],
            tlApprovalStatus: flagged ? 'PENDING' : 'APPROVED',
            isDeleted: false,
            // Dated to the drive itself, otherwise it shows up in today's attendance views
            createdAt: daysAgo(h.ago, 9),
            updatedAt: daysAgo(h.ago, 13),
          },
          { upsert: true, timestamps: false }
        );
        await WorkerRating.findOneAndUpdate(
          { taskId: task._id, workerId: w._id },
          { taskId: task._id, workerId: w._id, ratedBy: teamLead._id, stars, workType: h.workType },
          { upsert: true }
        );
      }
    }

    console.log(`Skill profiles added to ${workersWithoutSkills.length} other worker(s), requiredSkills to ${taskUpdates.length} task(s)`);
    console.log('Seeding complete!');
    console.log('─────────────────────────────');
    console.log('Login credentials:');
    console.log('FIELD_WORKER → worker@sevasetu.gov.in / password123');
    console.log('FIELD_WORKER → anjali@sevasetu.gov.in / password123');
    console.log('FIELD_WORKER → priya@ / arjun@ / sneha@ / imran@sevasetu.gov.in / password123');
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