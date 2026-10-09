const mongoose = require('mongoose');
const FieldReport = require('../models/FieldReport');
const { generateFieldReport, LANGS } = require('../services/ai/reportGenerator');
const { sendSuccess, sendError } = require('../utils/response');
const { ROLES } = require('../utils/constants');

// POST /api/ai/reports/:fieldReportId/generate?lang=en|hi|mr&refresh=1
const generateReport = async (req, res, next) => {
  try {
    const { fieldReportId } = req.params;
    const lang = String(req.query.lang || 'en').toLowerCase();
    const refresh = ['1', 'true'].includes(String(req.query.refresh || '').toLowerCase());

    if (!mongoose.isValidObjectId(fieldReportId)) return sendError(res, 'Invalid report id', 400);
    if (!LANGS[lang]) return sendError(res, 'lang must be one of en, hi, mr', 400);

    const report = await FieldReport.findById(fieldReportId).select('task aiReport').populate('task', 'createdBy');
    if (!report) return sendError(res, 'Field report not found', 404);
    if (req.user.role === ROLES.TEAM_LEAD && String(report.task?.createdBy) !== String(req.user.userId)) {
      return sendError(res, 'You can only generate reports for your own tasks', 403);
    }

    // Cached: same language and a real AI result (a saved fallback is retried)
    const cached = report.aiReport;
    if (!refresh && cached?.lang === lang && cached?.source === 'ai') {
      return sendSuccess(res, { ...cached, cached: true }, 'AI report (cached)');
    }

    const aiReport = await generateFieldReport(fieldReportId, lang);
    const message = aiReport.source === 'ai' ? 'AI report generated' : 'AI unavailable — generated a basic report from the raw data';
    return sendSuccess(res, { ...aiReport, cached: false }, message);
  } catch (err) {
    return next(err);
  }
};

module.exports = { generateReport };
