const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ quiet: true });

const connectDB = require('./config/db');
const stopsRouter = require('./routes/stops');
const routesRouter = require('./routes/routes');
const { notFoundHandler, globalErrorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust the first proxy hop (needed for correct client IPs behind a
// load balancer / reverse proxy - relevant for rate limiting).
app.set('trust proxy', 1);

app.use(helmet());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  // If ALLOWED_ORIGINS is unset, allow all origins (useful for local/dev use).
  // In production, set ALLOWED_ORIGINS to a comma-separated allowlist.
  origin: allowedOrigins.length > 0 ? allowedOrigins : true
}));

// Cap request body size to guard against large-payload abuse.
app.use(express.json({ limit: '50kb' }));

// Basic rate limiting to protect against abuse/scraping/DoS.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again shortly.' }
});
app.use('/api', apiLimiter);

app.use('/api/stops', stopsRouter);
app.use('/api/routes', routesRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(notFoundHandler);
app.use(globalErrorHandler);

let server;

const start = async () => {
  await connectDB();
  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

// Safety nets: log and shut down gracefully instead of the process dying
// silently or in an inconsistent state.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down gracefully...`);
  if (server) {
    server.close(() => process.exit(0));
  } else {
    process.exit(0);
  }
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
