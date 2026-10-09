const impactService = require('../services/impact.service');
const { sendSuccess } = require('../utils/response');

// GET /api/admin/impact (ADMIN) and GET /api/public/impact (no auth) — same shape
const getImpact = async (req, res, next) => {
  try {
    const includeStory = req.query.story !== 'false';
    const data = await impactService.getImpact({ includeStory });
    return sendSuccess(res, data, 'Impact fetched');
  } catch (error) {
    return next(error);
  }
};

module.exports = { getImpact };
