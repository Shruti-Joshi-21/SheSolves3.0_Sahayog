const bcrypt = require('bcrypt');
require('dotenv').config();

const connectDB = require('./config/db');
const User = require('./models/User');
const Task = require('./models/Task');

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
          faceEncoding: null
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
          faceEncoding: null
        },
        { upsert: true, returnDocument: 'after' }
      ),
    ]);

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