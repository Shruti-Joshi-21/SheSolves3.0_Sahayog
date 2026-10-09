/**
 * Attendance trust score (Challenge 3).
 *
 * computeConfidence(signals) turns the raw check-in/out signals into a 0–100 score,
 * a band (TRUSTED / REVIEW / SUSPICIOUS) and a per-signal breakdown for the UI.
 * Pure function — gatherTrustContext() does the DB lookups it needs.
 *
 * Each signal is scored 0..1 (ratio) and multiplied by its weight; the breakdown
 * stores the earned points as `score` so the UI can draw score / weight bars.
 */
const AttendanceRecord = require('../models/AttendanceRecord');
const { getDistanceInMeters } = require('../utils/haversine');

const WEIGHTS = { face: 30, liveness: 20, geofence: 20, timing: 10, device: 10, travel: 10 };
const BANDS = { TRUSTED: 80, REVIEW: 50 };
const IMPOSSIBLE_SPEED_KMH = 80;
const REASON_BELOW_RATIO = 0.5; // a signal below half its weight becomes a "reason"

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const lerp = (from, to, t) => from + (to - from) * clamp01(t);

function scoreFace({ available, distance, matched } = {}) {
  if (!available || distance == null) {
    return { ratio: 0.5, detail: 'Face service unavailable — neutral score' };
  }
  const d = Number(distance);
  let ratio;
  if (d <= 0.35) ratio = 1;
  else if (d <= 0.5) ratio = lerp(1, 0.6, (d - 0.35) / 0.15);
  else if (d <= 0.7) ratio = lerp(0.6, 0, (d - 0.5) / 0.2);
  else ratio = 0;
  if (matched === false) ratio = Math.min(ratio, 0.3);
  const detail = matched === false
    ? `Face did not match registered photo (distance ${d.toFixed(2)})`
    : `Face matched (distance ${d.toFixed(2)})`;
  return { ratio, detail };
}

function scoreLiveness({ passed, confidence, action, reason } = {}) {
  const label = action ? ` "${action}"` : '';
  if (passed === true) {
    const c = typeof confidence === 'number' ? clamp01(confidence) : 1;
    return { ratio: Math.max(0.7, c), detail: `Liveness${label} passed` };
  }
  if (passed === false) {
    return { ratio: 0, detail: `Liveness${label} failed${reason ? ` — ${reason}` : ''}` };
  }
  return { ratio: 0.5, detail: 'Liveness not checked — neutral score' };
}

function scoreGeofence({ distanceM, radiusM } = {}) {
  if (distanceM == null || !radiusM) return { ratio: 0, detail: 'No GPS location' };
  const d = Math.round(distanceM);
  if (distanceM <= radiusM) return { ratio: 1, detail: `Inside geofence (${d}m / ${radiusM}m)` };
  if (distanceM <= radiusM * 1.5) {
    return {
      ratio: lerp(0.6, 0.2, (distanceM - radiusM) / (radiusM * 0.5)),
      detail: `Just outside geofence (${d}m / ${radiusM}m)`,
    };
  }
  return { ratio: 0, detail: `Far outside geofence (${d}m / ${radiusM}m)` };
}

function scoreTiming({ timeValid = true, isEarly = false, earlyMinutes = 0 } = {}) {
  if (timeValid && !isEarly) return { ratio: 1, detail: 'Within allowed time window' };
  if (!timeValid && isEarly) return { ratio: 0, detail: `Outside time window and ${earlyMinutes}m early checkout` };
  if (isEarly) return { ratio: 0.5, detail: `Early checkout (${earlyMinutes}m early)` };
  return { ratio: 0.3, detail: 'Outside allowed time window' };
}

function scoreDevice({ deviceId, knownDeviceId, historyCount = 0, sharedWithOthers = 0 } = {}) {
  if (!deviceId) return { ratio: 0.3, detail: 'No device id sent' };
  if (sharedWithOthers > 0) {
    return { ratio: 0, detail: `Device also used by ${sharedWithOthers} other worker(s) — possible proxy` };
  }
  if (!knownDeviceId || historyCount === 0) return { ratio: 0.8, detail: 'First recorded device for this worker' };
  if (deviceId === knownDeviceId) return { ratio: 1, detail: 'Usual device' };
  return { ratio: 0.4, detail: 'New device — differs from usual one' };
}

function scoreTravel({ prev, current } = {}) {
  if (!prev || !current || prev.latitude == null || current.latitude == null) {
    return { ratio: 1, detail: 'No previous location to compare' };
  }
  const meters = getDistanceInMeters(prev.latitude, prev.longitude, current.latitude, current.longitude);
  const km = meters / 1000;
  if (km < 1) return { ratio: 1, detail: `Moved ${Math.round(meters)}m since last record` };
  const hours = (new Date(current.time) - new Date(prev.time)) / 3600000;
  const speed = hours > 0 ? km / hours : Infinity;
  const speedTxt = Number.isFinite(speed) ? `${Math.round(speed)} km/h` : 'instant';
  if (speed > IMPOSSIBLE_SPEED_KMH) {
    return { ratio: 0, detail: `Impossible travel: ${km.toFixed(1)} km since last record (${speedTxt})` };
  }
  if (speed > IMPOSSIBLE_SPEED_KMH / 2) {
    return { ratio: 0.6, detail: `Fast travel: ${km.toFixed(1)} km (${speedTxt})` };
  }
  return { ratio: 1, detail: `Plausible travel: ${km.toFixed(1)} km (${speedTxt})` };
}

const SCORERS = {
  face: scoreFace,
  liveness: scoreLiveness,
  geofence: scoreGeofence,
  timing: scoreTiming,
  device: scoreDevice,
  travel: scoreTravel,
};

function bandFor(score) {
  if (score >= BANDS.TRUSTED) return 'TRUSTED';
  if (score >= BANDS.REVIEW) return 'REVIEW';
  return 'SUSPICIOUS';
}

/**
 * @param {object} input { face, liveness, geofence, timing, device, travel } — see scorers above
 * @returns {{ score:number, band:string, signals:object, reasons:string[] }}
 */
function computeConfidence(input = {}) {
  const signals = {};
  const reasons = [];
  let total = 0;
  for (const [name, weight] of Object.entries(WEIGHTS)) {
    const { ratio, detail } = SCORERS[name](input[name] || {});
    const points = Math.round(ratio * weight * 10) / 10;
    signals[name] = { score: points, weight, detail };
    total += points;
    if (ratio < REASON_BELOW_RATIO) reasons.push(detail);
  }
  const score = Math.round(total);
  return { score, band: bandFor(score), signals, reasons };
}

function mostCommon(values) {
  const counts = {};
  let best = null;
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
    if (best === null || counts[v] > counts[best]) best = v;
  }
  return best;
}

/**
 * DB lookups for the device + travel signals.
 * @param {object} p { workerId, deviceId, excludeRecordId }
 * @returns {{ knownDeviceId, historyCount, sharedWithOthers, prevPoint }}
 */
async function gatherTrustContext({ workerId, deviceId, excludeRecordId }) {
  const filter = { worker: workerId, isDeleted: false };
  if (excludeRecordId) filter._id = { $ne: excludeRecordId };

  const recent = await AttendanceRecord.find(filter)
    .sort({ checkInTime: -1 })
    .limit(10)
    .select('deviceId checkInTime checkInLocation checkOutTime checkOutLocation')
    .lean();

  const deviceIds = recent.map((r) => r.deviceId).filter(Boolean);

  let sharedWithOthers = 0;
  if (deviceId) {
    const since = new Date(Date.now() - 7 * 24 * 3600000);
    const others = await AttendanceRecord.distinct('worker', {
      deviceId,
      worker: { $ne: workerId },
      isDeleted: false,
      checkInTime: { $gte: since },
    });
    sharedWithOthers = others.length;
  }

  let prevPoint = null;
  const last = recent[0];
  if (last) {
    if (last.checkOutTime && last.checkOutLocation?.latitude != null) {
      prevPoint = { ...last.checkOutLocation, time: last.checkOutTime };
    } else if (last.checkInTime && last.checkInLocation?.latitude != null) {
      prevPoint = { ...last.checkInLocation, time: last.checkInTime };
    }
  }

  return { knownDeviceId: mostCommon(deviceIds), historyCount: deviceIds.length, sharedWithOthers, prevPoint };
}

module.exports = { computeConfidence, gatherTrustContext, WEIGHTS, BANDS };
