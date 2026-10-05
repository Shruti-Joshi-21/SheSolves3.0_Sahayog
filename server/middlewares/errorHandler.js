const { sendError } = require('../utils/response');

function errorHandler(err, req, res, next) {
  if (err.name === 'ValidationError') {
    return sendError(res, err.message, 400);
  }
  if (err.name === 'CastError' || err.name === 'BSONError') {
    return sendError(res, err.message || 'Invalid identifier', 400);
  }
  if (err.name === 'MulterError') {
    return sendError(res, err.message || 'File upload error', 400);
  }
  if (typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 500) {
    return sendError(res, err.message || 'Request error', err.statusCode);
  }
  if (err.name === 'VersionError' || err.name === 'ParallelSaveError') {
    return sendError(res, 'Record was updated elsewhere. Please refresh and try again.', 409);
  }
  if (err.name === 'MongoServerError') {
    if (err.code === 11000) {
      return sendError(res, 'Duplicate record', 400);
    }
    if (err.code === 121) {
      return sendError(res, err.message || 'Document validation failed', 400);
    }
    console.error('[MongoServerError]', err.code, err.message);
    return sendError(res, process.env.NODE_ENV === 'development' ? err.message : 'Database error', 500);
  }
  if (err.code === 11000) {
    return sendError(res, 'Username already exists', 400);
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return sendError(res, 'Invalid token', 401);
  }
  console.error('[Unhandled]', err.name || 'Error', err.message, err.stack);
  return sendError(res, 'Internal server error', 500);
}

module.exports = errorHandler;
