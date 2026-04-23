/**
 * server.js — Application entry point
 *
 * Boots the Express HTTP server, wires up global middleware,
 * and mounts all route groups. Firebase Admin is initialized
 * via config/firebase.js before any route handler runs.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');

// Route modules
const foodRoutes = require('./routes/food');
const goalsRoutes = require('./routes/goals');
const healthRoutes = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

// Allow all origins during development; restrict in production via env config
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : '*',
}));

// Parse JSON bodies (e.g., goal updates, manual meal entries)
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded bodies (form submissions)
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---------------------------------------------------------------------------
// Route mounting
// ---------------------------------------------------------------------------

// POST /api/food/scan         — Analyze a food photo via Gemini Vision
// POST /api/food/manual       — Log a manually typed meal
// GET  /api/food/log/:uid/:date — Fetch all meals for a user on a given date
app.use('/api/food', foodRoutes);

// GET  /api/goals/:uid         — Retrieve daily macro targets
// POST /api/goals/:uid         — Create or update daily targets
// GET  /api/goals/:uid/balance — Remaining calories/macros vs. consumed
app.use('/api/goals', goalsRoutes);

// POST /api/health/sync        — Ingest workout data from HealthKit/Google Fit
// GET  /api/health/summary/:uid/:date — Return aggregated health stats
app.use('/api/health', healthRoutes);

// ---------------------------------------------------------------------------
// Health-check endpoint (used by load balancers / CI pipelines)
// ---------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Global error handler — catches errors forwarded via next(err)
// ---------------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message, err.stack);

  // Multer specific error (e.g., file too large)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Uploaded file exceeds the 10 MB limit.' });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ---------------------------------------------------------------------------
// Start listening
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[SERVER] Running on http://localhost:${PORT}`);
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app; // exported for testing
