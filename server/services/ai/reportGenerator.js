/**
 * AI field-report generator (Challenge 4) — turns a worker's raw field report + photos +
 * attendance record into a consistent, donor-ready report in English, Hindi or Marathi.
 *
 * Never fails: if Gemini is down, a templated report is built from the raw data
 * (source: 'fallback') so the team lead always gets a document.
 * Result is saved to FieldReport.aiReport = { ...report, lang, generatedAt, source }.
 */
const FieldReport = require('../../models/FieldReport');
const AttendanceRecord = require('../../models/AttendanceRecord');
require('../../models/User'); // registered for populate()
require('../../models/Task');
const { generateJSON, Type } = require('../ai.service');

const REPORT_TIMEOUT_MS = 40000; // vision over up to 5 photos (ai.service tries a 2nd model inside this)
const RETRY_DELAY_MS = 3000;
const RETRY_TIMEOUT_MS = 30000; // 40 + 3 + 30 s stays under the UI's 90 s request timeout
const MAX_REPORT_IMAGES = 3; // + before/after attendance photos = generateJSON's 5-image cap

const LANGS = { en: 'English', hi: 'Hindi (Devanagari script)', mr: 'Marathi (Devanagari script)' };

const SYSTEM = `You write field reports for an Indian NGO (Sahayog) from data submitted by field workers.
Readers are NGO admins, local partners and donors. Be factual, concise and specific.
Only state what is supported by the provided data or clearly visible in the photos — never invent numbers.
If photos do not match the task's work type, say so plainly in the evidence assessment.`;

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Short report title' },
    summary: { type: Type.STRING, description: '2-4 sentence executive summary' },
    workDone: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Bullet points of work completed' },
    quantities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          value: { type: Type.STRING },
          unit: { type: Type.STRING },
        },
        required: ['label', 'value', 'unit'],
      },
      description: 'Measurable outputs taken from the submitted data (unit may be empty)',
    },
    issuesFound: { type: Type.ARRAY, items: { type: Type.STRING } },
    evidenceAssessment: {
      type: Type.OBJECT,
      properties: {
        photosMatchTask: { type: Type.BOOLEAN },
        notes: { type: Type.STRING },
      },
      required: ['photosMatchTask', 'notes'],
    },
    attendanceNote: { type: Type.STRING, description: 'One sentence on attendance timing and trust' },
    recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
    language: { type: Type.STRING, description: 'Language code the report is written in' },
  },
  required: ['title', 'summary', 'workDone', 'quantities', 'issuesFound', 'evidenceAssessment', 'attendanceNote', 'recommendations', 'language'],
};

// Labels for the templated fallback, so it is still in the requested language.
const T = {
  en: {
    title: (t) => `Field report: ${t}`,
    summary: (w, t, loc, d) => `${w} completed "${t}" at ${loc} on ${d}.`,
    noIssues: 'No issues reported by the worker.',
    evidence: (n) => (n ? `${n} photo(s) attached — automatic photo check unavailable, please review manually.` : 'No photos attached to this report.'),
    attendance: (inT, outT, band, score) =>
      `Checked in ${inT || '—'}, checked out ${outT || '—'}.${band ? ` Attendance trust: ${band} (${score}/100).` : ''}`,
    noAttendance: 'No linked attendance record found.',
    rec: 'Review the photos and submitted data before forwarding to admin.',
  },
  hi: {
    title: (t) => `क्षेत्र रिपोर्ट: ${t}`,
    summary: (w, t, loc, d) => `${w} ने ${d} को ${loc} में "${t}" कार्य पूरा किया।`,
    noIssues: 'कार्यकर्ता द्वारा कोई समस्या दर्ज नहीं की गई।',
    evidence: (n) => (n ? `${n} फ़ोटो संलग्न — स्वचालित फ़ोटो जाँच उपलब्ध नहीं, कृपया स्वयं जाँचें।` : 'इस रिपोर्ट के साथ कोई फ़ोटो नहीं है।'),
    attendance: (inT, outT, band, score) =>
      `चेक-इन ${inT || '—'}, चेक-आउट ${outT || '—'}।${band ? ` उपस्थिति विश्वसनीयता: ${band} (${score}/100)।` : ''}`,
    noAttendance: 'कोई जुड़ा हुआ उपस्थिति रिकॉर्ड नहीं मिला।',
    rec: 'एडमिन को भेजने से पहले फ़ोटो और दर्ज डेटा की समीक्षा करें।',
  },
  mr: {
    title: (t) => `क्षेत्र अहवाल: ${t}`,
    summary: (w, t, loc, d) => `${w} यांनी ${d} रोजी ${loc} येथे "${t}" काम पूर्ण केले.`,
    noIssues: 'कार्यकर्त्याने कोणतीही समस्या नोंदवलेली नाही.',
    evidence: (n) => (n ? `${n} फोटो जोडले आहेत — स्वयंचलित फोटो तपासणी उपलब्ध नाही, कृपया स्वतः तपासा.` : 'या अहवालासोबत कोणताही फोटो नाही.'),
    attendance: (inT, outT, band, score) =>
      `चेक-इन ${inT || '—'}, चेक-आउट ${outT || '—'}.${band ? ` उपस्थिती विश्वासार्हता: ${band} (${score}/100).` : ''}`,
    noAttendance: 'जोडलेला उपस्थिती रेकॉर्ड सापडला नाही.',
    rec: 'अ‍ॅडमिनकडे पाठवण्यापूर्वी फोटो आणि नोंदवलेला डेटा तपासा.',
  },
};

const isUrl = (u) => typeof u === 'string' && /^https?:\/\//.test(u);
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : null);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

// "Waste collected (kg)" → { label: 'Waste collected', unit: 'kg' }
function splitLabel(fieldName = '') {
  const m = String(fieldName).match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? { label: m[1], unit: m[2] } : { label: String(fieldName), unit: '' };
}

function numericQuantities(responses = []) {
  return responses
    .filter((r) => r.fieldName && r.value !== '' && r.value != null && !Number.isNaN(Number(r.value)))
    .map((r) => ({ ...splitLabel(r.fieldName), value: String(r.value) }));
}

function buildFallback(ctx, lang) {
  const t = T[lang] || T.en;
  const { report, task, worker, attendance, reportImages } = ctx;
  const taskTitle = task?.title || 'Task';
  const textFields = (report.reportFieldResponses || []).filter(
    (r) => r.fieldName && r.value !== '' && r.value != null && Number.isNaN(Number(r.value))
  );
  const isIssue = (r) => /issue|problem|challenge|concern/i.test(r.fieldName);
  const issues = textFields.filter(isIssue).map((r) => String(r.value));
  const otherFields = textFields.filter((r) => !isIssue(r)).map((r) => `${r.fieldName}: ${r.value}`);
  const shortLoc = (task?.locationName || '—').split(',').slice(0, 2).join(',').trim();

  return {
    title: t.title(taskTitle),
    summary: `${t.summary(worker?.fullName || 'Worker', taskTitle, shortLoc, fmtDate(task?.date))} ${report.description || ''}`.trim(),
    workDone: [report.description, ...otherFields].filter(Boolean),
    quantities: numericQuantities(report.reportFieldResponses),
    issuesFound: issues.length ? issues : [t.noIssues],
    evidenceAssessment: { photosMatchTask: null, notes: t.evidence(reportImages.length) },
    attendanceNote: attendance
      ? t.attendance(fmtTime(attendance.checkInTime), fmtTime(attendance.checkOutTime), attendance.confidenceBand, attendance.confidenceScore)
      : t.noAttendance,
    recommendations: [t.rec],
    language: lang,
  };
}

async function loadContext(fieldReportId) {
  const report = await FieldReport.findById(fieldReportId)
    .populate('worker', 'fullName username')
    .populate('task', 'title workType locationName date startTime endTime description createdBy');
  if (!report) return null;

  let attendance = report.attendance ? await AttendanceRecord.findById(report.attendance).lean() : null;
  if (!attendance && report.task) {
    attendance = await AttendanceRecord.findOne({ worker: report.worker?._id, task: report.task._id, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .lean();
  }

  const reportImages = (report.images || []).filter(isUrl).slice(0, MAX_REPORT_IMAGES);
  return { report, task: report.task, worker: report.worker, attendance, reportImages };
}

function buildPrompt(ctx, lang, imageLabels) {
  const { report, task, worker, attendance } = ctx;
  const fields = (report.reportFieldResponses || []).map((r) => `- ${r.fieldName}: ${r.value === '' || r.value == null ? '—' : r.value}`);
  const att = attendance
    ? [
        `Check-in: ${fmtTime(attendance.checkInTime) || '—'} · Check-out: ${fmtTime(attendance.checkOutTime) || '—'} (IST)`,
        `Attendance status: ${attendance.status}${attendance.isLate ? ' (late)' : ''}${attendance.isEarlyCheckout ? ` (early checkout: ${attendance.earlyCheckoutReason || 'no reason'})` : ''}`,
        attendance.confidenceScore != null ? `Attendance trust score: ${attendance.confidenceScore}/100 (${attendance.confidenceBand})` : null,
        attendance.flagReasons?.length ? `Flags: ${attendance.flagReasons.join('; ')}` : null,
      ].filter(Boolean)
    : ['No attendance record linked.'];

  return `Write the whole report (every string value) in ${LANGS[lang]}. Set "language" to "${lang}".
Keep numbers, units and proper names as given. Quantities must come only from the submitted data.

TASK
- Title: ${task?.title || '—'}
- Work type: ${task?.workType || '—'}
- Location: ${task?.locationName || '—'}
- Date: ${fmtDate(task?.date)} ${task?.startTime || ''}–${task?.endTime || ''}
- Task description: ${task?.description || '—'}

WORKER: ${worker?.fullName || '—'}

WORKER'S REPORT
${report.description || '—'}

SUBMITTED DATA
${fields.length ? fields.join('\n') : '- none'}

ATTENDANCE
${att.join('\n')}

PHOTOS (in order)
${imageLabels.length ? imageLabels.map((l, i) => `Image ${i + 1}: ${l}`).join('\n') : 'No photos.'}
Do the photos show "${task?.workType || 'the task'}" work at an outdoor field site? Do before/after photos show visible progress?`;
}

/**
 * @param {string} fieldReportId
 * @param {'en'|'hi'|'mr'} lang
 * @returns {Promise<object|null>} the saved aiReport, or null if the report doesn't exist
 */
async function generateFieldReport(fieldReportId, lang = 'en') {
  const language = LANGS[lang] ? lang : 'en';
  const ctx = await loadContext(fieldReportId);
  if (!ctx) return null;

  const imageUrls = [];
  const imageLabels = [];
  ctx.reportImages.forEach((u, i) => {
    imageUrls.push(u);
    imageLabels.push(`field report photo ${i + 1}`);
  });
  if (isUrl(ctx.attendance?.beforeImage)) {
    imageUrls.push(ctx.attendance.beforeImage);
    imageLabels.push('BEFORE photo taken at check-in');
  }
  if (isUrl(ctx.attendance?.afterImage)) {
    imageUrls.push(ctx.attendance.afterImage);
    imageLabels.push('AFTER photo taken at check-out');
  }

  const request = {
    system: SYSTEM,
    prompt: buildPrompt(ctx, language, imageLabels),
    imageUrls,
    schema: SCHEMA,
    fallback: buildFallback(ctx, language),
  };
  let result = await generateJSON({ ...request, timeoutMs: REPORT_TIMEOUT_MS });
  if (result.source !== 'ai') {
    // Gemini overload spikes are usually short — one more try before the templated report
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    result = await generateJSON({ ...request, timeoutMs: RETRY_TIMEOUT_MS });
  }

  const aiReport = {
    ...result,
    lang: language,
    generatedAt: new Date(),
    source: result.source,
    evidenceImages: imageUrls, // what the AI looked at — UI shows these as thumbnails
  };

  await FieldReport.updateOne({ _id: ctx.report._id }, { $set: { aiReport } });
  return aiReport;
}

module.exports = { generateFieldReport, loadContext, LANGS };
