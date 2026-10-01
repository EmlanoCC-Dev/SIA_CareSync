/**
 * Healthcare Appointment System — Entry Point
 *
 * Boots the Express server, connects to MongoDB,
 * registers event handlers, and mounts API routes.
 */

const express = require('express');
const cors = require('cors');
const { connectDB } = require('./src/config/db');
const env = require('./src/config/env');
const { registerAllHandlers } = require('./src/events/handlers/notification.handler');
const { registerAuditHandlers } = require('./src/events/handlers/auditLog.handler');
const routes = require('./src/routes');
const { errorHandler } = require('./src/middleware/errorHandler');
const app = express();

// ── Middleware ────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Static Files (Uploaded Documents) ────────────────────
// Medical files are returned only through authorized appointment downloads.
app.use('/uploads', (_req, res) => res.status(404).json({ success: false, message: 'Use the authenticated appointment download endpoint' }));

// ── Routes (Presentation Layer) ──────────────────────────
app.use('/api', routes);

// Health-check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Global Error Handler ─────────────────────────────────
app.use(errorHandler);

// ── Start ────────────────────────────────────────────────
async function start() {
  // 1. Connect to MongoDB
  await connectDB();

  // 2. Register event-driven handlers (Module 7 & 9)
  registerAllHandlers();
  registerAuditHandlers();

  // 3. Listen
  const PORT = env.PORT;
  app.listen(PORT, () => {
    console.log(`\n🚀  Server running on http://localhost:${PORT}`);
    console.log(`📋  API base path: http://localhost:${PORT}/api\n`);
  });
}

if (require.main === module) start().catch((err) => {
  console.error('❌  Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
