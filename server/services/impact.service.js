const Task = require('../models/Task');
const AttendanceRecord = require('../models/AttendanceRecord');
const FieldReport = require('../models/FieldReport');
const { generateJSON, Type } = require('./ai.service');

const TREND_MONTHS = 6;
const GALLERY_LIMIT = 12;
const STORY_TTL_MS = 30 * 60 * 1000;
// When Gemini is down, reuse the templated story briefly instead of waiting on every request
const FALLBACK_TTL_MS = 2 * 60 * 1000;
const WINDOW_DAYS = 30;
const DAY_MS = 86400000;

// Report fields that hold a quantity of waste, e.g. "Waste collected (kg)", "Total weight (kg)"
const WASTE_FIELD = /(waste|weight|garbage|plastic|trash).*(kg)|\(kg\)/i;

const round1 = (n) => Math.round(n * 10) / 10;

const monthStart = (offset = 0) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1);
};

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (d) => d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });

const deltaPct = (cur, prev) => {
  if (!prev) return cur ? 100 : 0;
  return round1(((cur - prev) / prev) * 100);
};

const kpi = (cur, prev, total) => ({ value: cur, previous: prev, deltaPct: deltaPct(cur, prev), total });

const wasteKgOf = (report) =>
  (report.reportFieldResponses || []).reduce((sum, f) => {
    if (!WASTE_FIELD.test(f.fieldName || '')) return sum;
    const n = Number(f.value);
    return Number.isFinite(n) && n > 0 ? sum + n : sum;
  }, 0);

const hoursOf = (r) =>
  r.checkInTime && r.checkOutTime ? Math.max(0, (new Date(r.checkOutTime) - new Date(r.checkInTime)) / 3600000) : 0;

const inRange = (date, start, end) => {
  const t = new Date(date).getTime();
  return t >= start.getTime() && t < end.getTime();
};

// ---------- AI impact story (cached) ----------
let storyCache = { key: '', at: 0, value: null };

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const templatedStory = (k, topType) =>
  `In the last ${WINDOW_DAYS} days our field teams completed ${plural(k.drivesCompleted.value, 'drive')} across ` +
  `${plural(k.locationsCovered.value, 'location')}, contributing ${k.volunteerHours.value} verified volunteer hours` +
  `${k.wasteCollectedKg.value ? ` and collecting ${k.wasteCollectedKg.value} kg of waste` : ''}.` +
  `${topType ? ` Overall, ${topType} has been our most active area of work.` : ''}` +
  ` Attendance is verified by GPS geofencing and face checks${k.photoEvidence.value ? `, backed by ${k.photoEvidence.value} photos of evidence` : ''}.`;

const buildImpactStory = async (kpis, byWorkType) => {
  const topType = byWorkType[0]?.workType || '';
  const key = JSON.stringify([kpis.drivesCompleted.value, kpis.volunteerHours.value, kpis.wasteCollectedKg.value, kpis.locationsCovered.value, topType]);
  if (storyCache.key === key && Date.now() - storyCache.at < (storyCache.value?.source === 'ai' ? STORY_TTL_MS : FALLBACK_TTL_MS)) {
    return storyCache.value;
  }

  const fallbackText = templatedStory(kpis, topType);
  const result = await generateJSON({
    system:
      'You write short, warm, factual impact summaries for an Indian environmental NGO, for donors and partners. ' +
      'Use only the numbers given. No exaggeration, no invented facts, no names. 2-3 sentences, under 70 words.',
    prompt: `Verified impact data — kpis.*.value is the last ${WINDOW_DAYS} days, .previous the ${WINDOW_DAYS} days before, .total all time; byWorkType is all time (JSON):\n${JSON.stringify({ kpis, byWorkType: byWorkType.slice(0, 5) })}\nWrite the impact story and up to 3 short highlight phrases.`,
    schema: {
      type: Type.OBJECT,
      properties: {
        story: { type: Type.STRING },
        highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['story'],
    },
    fallback: { story: fallbackText, highlights: [] },
    timeoutMs: 10000,
  });

  const value = { text: result.story || fallbackText, highlights: result.highlights || [], source: result.source };
  storyCache = { key, at: Date.now(), value };
  return value;
};

// ---------- main aggregation ----------
/**
 * Organisation-wide impact for the Impact dashboard (admin) and the public donor page.
 * @param {{ includeStory?: boolean }} opts
 */
const getImpact = async ({ includeStory = true } = {}) => {
  // Rolling windows, so deltas stay meaningful early in a calendar month
  const now = new Date();
  const curStart = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);
  const prevStart = new Date(now.getTime() - 2 * WINDOW_DAYS * DAY_MS);
  const nextStart = new Date(now.getTime() + 1);

  const [completedTasks, attendance, reports] = await Promise.all([
    Task.find({ isDeleted: false, status: 'COMPLETED' }).select('title workType locationName latitude longitude date').lean(),
    AttendanceRecord.find({ isDeleted: false, status: { $ne: 'REJECTED' } })
      .select('worker task status checkInTime checkOutTime beforeImage afterImage createdAt')
      .populate('task', 'title workType locationName date')
      .lean(),
    FieldReport.find({ status: { $ne: 'REJECTED' } }).select('task reportFieldResponses images createdAt').populate('task', 'workType').lean(),
  ]);

  const verified = attendance.filter((a) => a.status === 'VERIFIED');
  const attDate = (a) => a.checkInTime || a.createdAt;

  // Per-period sums
  const periodStats = (start, end) => {
    const drives = completedTasks.filter((t) => inRange(t.date, start, end));
    const verifiedIn = verified.filter((a) => inRange(attDate(a), start, end));
    const reportsIn = reports.filter((r) => inRange(r.createdAt, start, end));
    const attendanceIn = attendance.filter((a) => inRange(attDate(a), start, end));
    return {
      drivesCompleted: drives.length,
      volunteerHours: round1(verifiedIn.reduce((s, a) => s + hoursOf(a), 0)),
      wasteCollectedKg: round1(reportsIn.reduce((s, r) => s + wasteKgOf(r), 0)),
      locationsCovered: new Set(drives.map((t) => t.locationName)).size,
      workersActive: new Set(attendanceIn.map((a) => String(a.worker))).size,
      photoEvidence:
        attendanceIn.reduce((s, a) => s + (a.beforeImage ? 1 : 0) + (a.afterImage ? 1 : 0), 0) +
        reportsIn.reduce((s, r) => s + (r.images?.length || 0), 0),
    };
  };

  const epoch = new Date(0);
  const cur = periodStats(curStart, nextStart);
  const prev = periodStats(prevStart, curStart);
  const all = periodStats(epoch, new Date(8640000000000000));

  const kpis = Object.fromEntries(Object.keys(cur).map((k) => [k, kpi(cur[k], prev[k], all[k])]));

  // Activities by work type (all time)
  const typeMap = {};
  const ensureType = (t) => (typeMap[t] = typeMap[t] || { workType: t, drives: 0, volunteerHours: 0, wasteCollectedKg: 0 });
  completedTasks.forEach((t) => (ensureType(t.workType || 'Other').drives += 1));
  verified.forEach((a) => {
    if (a.task?.workType) ensureType(a.task.workType).volunteerHours += hoursOf(a);
  });
  reports.forEach((r) => {
    const kg = wasteKgOf(r);
    if (kg && r.task?.workType) ensureType(r.task.workType).wasteCollectedKg += kg;
  });
  const byWorkType = Object.values(typeMap)
    .map((t) => ({ ...t, volunteerHours: round1(t.volunteerHours), wasteCollectedKg: round1(t.wasteCollectedKg) }))
    .sort((a, b) => b.drives - a.drives || b.volunteerHours - a.volunteerHours);

  // Monthly trend (oldest → newest)
  const trend = [];
  for (let i = TREND_MONTHS - 1; i >= 0; i -= 1) {
    const start = monthStart(-i);
    const s = periodStats(start, monthStart(-i + 1));
    trend.push({
      month: monthKey(start),
      label: monthLabel(start),
      drivesCompleted: s.drivesCompleted,
      volunteerHours: s.volunteerHours,
      wasteCollectedKg: s.wasteCollectedKg,
    });
  }

  // Locations covered (map pins), most drives first
  const locMap = {};
  completedTasks.forEach((t) => {
    if (t.latitude == null || t.longitude == null) return;
    const key = t.locationName;
    locMap[key] = locMap[key] || { locationName: t.locationName, latitude: t.latitude, longitude: t.longitude, drives: 0, workTypes: new Set(), lastDriveAt: null };
    locMap[key].drives += 1;
    locMap[key].workTypes.add(t.workType);
    if (!locMap[key].lastDriveAt || new Date(t.date) > new Date(locMap[key].lastDriveAt)) locMap[key].lastDriveAt = t.date;
  });
  const locations = Object.values(locMap)
    .map((l) => ({ ...l, workTypes: Array.from(l.workTypes) }))
    .sort((a, b) => b.drives - a.drives);

  // Before/after gallery from verified attendance — no worker names (shown publicly)
  const gallery = verified
    .filter((a) => a.beforeImage && a.afterImage && a.task)
    .sort((a, b) => new Date(attDate(b)) - new Date(attDate(a)))
    .slice(0, GALLERY_LIMIT)
    .map((a) => ({
      attendanceId: a._id,
      taskTitle: a.task.title,
      workType: a.task.workType,
      locationName: a.task.locationName,
      date: attDate(a),
      beforeImage: a.beforeImage,
      afterImage: a.afterImage,
    }));

  const data = {
    generatedAt: new Date(),
    period: {
      current: { start: curStart, end: now, label: `Last ${WINDOW_DAYS} days` },
      previous: { start: prevStart, end: curStart, label: `Previous ${WINDOW_DAYS} days` },
    },
    kpis,
    byWorkType,
    trend,
    locations,
    gallery,
  };
  if (includeStory) data.impactStory = await buildImpactStory(kpis, byWorkType);
  return data;
};

module.exports = { getImpact };
