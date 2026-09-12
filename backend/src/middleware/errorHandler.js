/**
 * 404 handler - runs when no route matched the request.
 */
function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
}

/**
 * Centralized error handler - catches anything passed to next(err),
 * plus any error thrown synchronously in a route (Express 5 auto-forwards
 * rejected promises from async handlers to this middleware too).
 * Never leaks stack traces or internal details to the client.
 */
// eslint-disable-next-line no-unused-vars
function globalErrorHandler(err, req, res, next) {
  console.error('Unhandled error:', err);

  if (err && err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid identifier or parameter format' });
  }

  if (err && err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Invalid data', details: err.message });
  }

  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    return res.status(400).json({ error: 'Malformed JSON in request body' });
  }

  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request payload too large' });
  }

  res.status(err && err.statusCode ? err.statusCode : 500).json({
    error: 'Internal server error'
  });
}

module.exports = { notFoundHandler, globalErrorHandler };
