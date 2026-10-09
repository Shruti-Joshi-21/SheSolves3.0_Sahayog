const express = require('express');
const { generateJSON, Type, MODEL } = require('../services/ai.service');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../utils/constants');
const aiController = require('../controllers/ai.controller');

const router = express.Router();

// GET /api/ai/health — proves the Gemini key works on the deployed server.
// source: 'ai' = working, 'fallback' = check GEMINI_API_KEY / GEMINI_MODEL on Render.
router.get('/health', async (req, res) => {
  const result = await generateJSON({
    system: 'You are a health check. Reply exactly as instructed.',
    prompt: 'Return {"ok": true}.',
    schema: { type: Type.OBJECT, properties: { ok: { type: Type.BOOLEAN } }, required: ['ok'] },
    fallback: { ok: false },
    timeoutMs: 15000,
  });
  res.json({ model: MODEL, ...result });
});

// New AI feature routes go below (AI lane). Keep handlers thin: call a function in services/ai/.

// Ch4 — multilingual AI field report (team lead: own tasks only, checked in the controller)
router.post(
  '/reports/:fieldReportId/generate',
  verifyToken,
  authorizeRoles(ROLES.TEAM_LEAD, ROLES.ADMIN),
  aiController.generateReport
);

module.exports = router;
