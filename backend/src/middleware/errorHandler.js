/**
 * Global Error Handler
 * ────────────────────
 * Catches all errors passed via next(err) and returns
 * a consistent JSON error response.
 */

function errorHandler(err, _req, res, _next) {
  if (res.headersSent) return _next(err);
  const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : err.name === 'MulterError' ? 400 :
    err.statusCode || err.status || (['CastError', 'ValidationError'].includes(err.name) ? 400 : 500);
  const message = err.code === 'LIMIT_FILE_SIZE' ? 'The file exceeds the 25 MB upload limit.' :
    err.type === 'entity.parse.failed' ? 'The request body must be valid JSON.' :
    err.type === 'entity.too.large' ? 'The request body is too large.' :
    process.env.NODE_ENV === 'production' && statusCode >= 500 && !err.statusCode ? 'The service is temporarily unavailable. Try again shortly.' : err.message || 'Internal Server Error';

  // Log full error in development
  if (process.env.NODE_ENV !== 'production') {
    console.error(`\n❌  [${statusCode}] ${message}`);
    if (statusCode === 500) console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

module.exports = { errorHandler };
