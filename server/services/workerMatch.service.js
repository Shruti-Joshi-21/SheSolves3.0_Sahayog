const AttendanceRecord = require('../models/AttendanceRecord');
const WorkerRating = require('../models/WorkerRating');
const haversine = require('../utils/haversine');
const { ATTENDANCE_STATUS, WORK_TYPE_SKILLS } = require('../utils/constants');

// Max points per signal — they add up to 100
const WEIGHTS = { skills: 30, rating: 20, experience: 15, reliability: 15, workload: 10, proximity: 10 };

// Bayesian smoothing: a few ratings get pulled toward a neutral 3.5 so one 5★ can't outrank ten 4.7★
const PRIOR_MEAN = 3.5;
const PRIOR_WEIGHT = 3;

const FATIGUE_HOURS = 35;
const NEAR_KM = 2;
const FAR_KM = 30;

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const round1 = (n) => Math.round(n * 10) / 10;
const lc = (s) => String(s || '').trim().toLowerCase();
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const smoothedAvg = (sum, count) => (PRIOR_MEAN * PRIOR_WEIGHT + sum) / (PRIOR_WEIGHT + count);
const starsToFraction = (stars) => clamp01((stars - 1) / 4);

const resolveRequiredSkills = (workType, requiredSkills) => {
  const explicit = (requiredSkills || []).map(lc).filter(Boolean);
  if (explicit.length) return explicit;
  return (WORK_TYPE_SKILLS[workType] || []).map(lc);
};

// { workerId: { byType: { [workType]: { sum, count } }, sum, count } }
const loadRatingStats = async (workerIds) => {
  const ratings = await WorkerRating.find({ workerId: { $in: workerIds } }).select('workerId workType stars').lean();
  const stats = {};
  ratings.forEach((r) => {
    const key = String(r.workerId);
    stats[key] = stats[key] || { byType: {}, sum: 0, count: 0 };
    const t = (stats[key].byType[r.workType] = stats[key].byType[r.workType] || { sum: 0, count: 0 });
    t.sum += r.stars;
    t.count += 1;
    stats[key].sum += r.stars;
    stats[key].count += 1;
  });
  return stats;
};

// Attendance-derived signals: verified ratio and the last known check-in location
const loadAttendanceStats = async (workerIds) => {
  const records = await AttendanceRecord.find({ worker: { $in: workerIds }, isDeleted: false })
    .select('worker status checkInLocation checkInTime createdAt')
    .sort({ createdAt: -1 })
    .lean();
  const stats = {};
  records.forEach((r) => {
    const key = String(r.worker);
    stats[key] = stats[key] || { verified: 0, problem: 0, lastLocation: null };
    if (r.status === ATTENDANCE_STATUS.VERIFIED) stats[key].verified += 1;
    else if (r.status === ATTENDANCE_STATUS.FLAGGED || r.status === ATTENDANCE_STATUS.REJECTED) stats[key].problem += 1;
    if (!stats[key].lastLocation && r.checkInLocation?.latitude != null && r.checkInLocation?.longitude != null) {
      stats[key].lastLocation = r.checkInLocation;
    }
  });
  return stats;
};

const buildRatingSummary = (stat, workType) => {
  const sameType = stat?.byType?.[workType];
  return {
    avgForWorkType: sameType?.count ? round1(sameType.sum / sameType.count) : null,
    countForWorkType: sameType?.count || 0,
    avgOverall: stat?.count ? round1(stat.sum / stat.count) : null,
    countOverall: stat?.count || 0,
  };
};

const scoreWorker = (worker, ctx) => {
  const key = String(worker._id);
  const breakdown = {};
  const reasons = [];
  const add = (signal, fraction, detail) => {
    breakdown[signal] = { score: round1(fraction * WEIGHTS[signal]), max: WEIGHTS[signal], detail };
  };

  // Skills
  const workerSkills = (worker.skills || []).map(lc);
  const matchedSkills = ctx.requiredSkills.filter((s) => workerSkills.includes(s));
  if (ctx.requiredSkills.length) {
    add('skills', matchedSkills.length / ctx.requiredSkills.length, `${matchedSkills.length}/${ctx.requiredSkills.length} required skills`);
    matchedSkills.forEach((s) => reasons.push(`Has '${s}' skill`));
  } else {
    add('skills', 0.5, 'No specific skills required');
  }

  // Performance rating — same work type first, then overall at half weight, else neutral
  const rating = buildRatingSummary(ctx.ratingStats[key], ctx.workType);
  const sameType = ctx.ratingStats[key]?.byType?.[ctx.workType];
  const overall = ctx.ratingStats[key];
  if (sameType?.count) {
    add('rating', starsToFraction(smoothedAvg(sameType.sum, sameType.count)), `${rating.avgForWorkType}★ from ${plural(sameType.count, 'rating')} on ${ctx.workType}`);
    reasons.push(`Rated ${rating.avgForWorkType}★ across ${plural(sameType.count, 'similar drive')}`);
  } else if (overall?.count) {
    const f = starsToFraction(smoothedAvg(overall.sum, overall.count));
    add('rating', 0.5 + (f - 0.5) * 0.5, `${rating.avgOverall}★ overall (${plural(overall.count, 'rating')}), none for ${ctx.workType}`);
    reasons.push(`Rated ${rating.avgOverall}★ overall`);
  } else {
    add('rating', 0.5, 'No ratings yet — neutral score');
    reasons.push('No ratings yet');
  }

  // Experience — similar completed drives (cap 5) + years in the field (cap 6)
  const similarDone = ctx.completedByType[key]?.[ctx.workType] || 0;
  const years = Number(worker.experienceYears) || 0;
  add('experience', 0.6 * Math.min(similarDone, 5) / 5 + 0.4 * Math.min(years, 6) / 6, `${plural(similarDone, 'similar drive')} completed, ${plural(years, 'year')} experience`);
  if (similarDone) reasons.push(`Completed ${plural(similarDone, 'similar drive')}`);
  if (years >= 3) reasons.push(`${years} years of field experience`);

  // Reliability — verified vs flagged/rejected attendance
  const att = ctx.attendanceStats[key];
  const judged = (att?.verified || 0) + (att?.problem || 0);
  if (judged) {
    const pct = Math.round((att.verified / judged) * 100);
    add('reliability', att.verified / judged, `${pct}% verified attendance (${judged} records)`);
    if (pct >= 90) reasons.push(`${pct}% verified attendance`);
    else if (pct < 70) reasons.push(`Only ${pct}% verified attendance`);
  } else {
    add('reliability', 0.5, 'No attendance history yet');
  }

  // Workload — fewer hours this week = fresher worker
  const hours = Number(worker.weeklyHours) || 0;
  add('workload', clamp01(1 - hours / 40), `${hours}h scheduled this week`);
  if (hours > FATIGUE_HOURS) reasons.push(`⚠ ${hours}h this week — fatigue risk`);
  else if (hours <= 8) reasons.push('Light workload this week');

  // Proximity — last check-in location to the task site
  const last = att?.lastLocation;
  if (last && ctx.taskLat != null && ctx.taskLng != null) {
    const km = haversine.getDistanceInMeters(ctx.taskLat, ctx.taskLng, last.latitude, last.longitude) / 1000;
    add('proximity', clamp01(1 - (km - NEAR_KM) / (FAR_KM - NEAR_KM)), `${round1(km)} km from last check-in`);
    if (km <= 5) reasons.push(`${round1(km)} km from site`);
  } else {
    add('proximity', 0.5, ctx.taskLat == null ? 'Task location not set' : 'No known location');
  }

  const matchScore = Math.round(Object.values(breakdown).reduce((s, b) => s + b.score, 0));
  return { matchScore, breakdown, reasons, ratingSummary: rating, matchedSkills };
};

/**
 * Rank already-available workers for a task.
 * @param workers   [{ _id, skills, experienceYears, weeklyHours, ... }]
 * @param task      { workType, requiredSkills, latitude, longitude }
 * @param completedTasks  COMPLETED tasks of these workers: [{ workType, assignedWorkers }]
 */
const rankWorkers = async (workers, task, completedTasks = []) => {
  if (!workers.length) return [];
  const workerIds = workers.map((w) => w._id);

  const completedByType = {};
  completedTasks.forEach((t) =>
    (t.assignedWorkers || []).forEach((wid) => {
      const key = String(wid);
      completedByType[key] = completedByType[key] || {};
      completedByType[key][t.workType] = (completedByType[key][t.workType] || 0) + 1;
    })
  );

  const [ratingStats, attendanceStats] = await Promise.all([loadRatingStats(workerIds), loadAttendanceStats(workerIds)]);
  const lat = task.latitude === '' || task.latitude == null ? null : Number(task.latitude);
  const lng = task.longitude === '' || task.longitude == null ? null : Number(task.longitude);
  const ctx = {
    workType: task.workType || '',
    requiredSkills: resolveRequiredSkills(task.workType, task.requiredSkills),
    taskLat: Number.isFinite(lat) ? lat : null,
    taskLng: Number.isFinite(lng) ? lng : null,
    completedByType,
    ratingStats,
    attendanceStats,
  };

  const ranked = workers
    .map((w) => ({ ...w, ...scoreWorker(w, ctx), recommended: false }))
    .sort((a, b) => b.matchScore - a.matchScore);
  ranked[0].recommended = true;
  return ranked;
};

module.exports = { rankWorkers, resolveRequiredSkills, WEIGHTS };
