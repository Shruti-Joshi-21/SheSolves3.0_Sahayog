const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/response');
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1] || null;

  if (!token) {
    return sendError(res, 'Unauthorized', 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id ?? decoded.userId;
    req.user = { userId, role: decoded.role, name: decoded.name };
    req.userId = userId;
    req.userRole = decoded.role;
    return next();
  } catch (err) {
    return sendError(res, 'Unauthorized', 401);
  }
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user?.role) {
      return sendError(res, 'Unauthorized', 401);
    }
    if (!roles.includes(req.user.role)) {
      return sendError(res, 'Forbidden', 403);
    }
    return next();
  };
}

module.exports = { verifyToken, authorizeRoles };
