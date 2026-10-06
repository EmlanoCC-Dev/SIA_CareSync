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
const { registerSlotFreedHandler } = require('./src/events/handlers/slotFreed.handler');
const routes = require('./src/routes');
const { errorHandler } = require('./src/middleware/errorHandler');
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY);

// ── Middleware ────────────────────────────────────────────
app.use(cors({ origin: (origin, callback) => {
  const allowed = !origin || env.CORS_ORIGINS.includes(origin) ||
    (!env.CORS_ORIGINS.length && process.env.NODE_ENV !== 'production');
  callback(allowed ? null : Object.assign(new Error('This browser origin is not allowed'), { statusCode: 403 }), allowed);
} }));
app.use(express.json());

// ── Static Files (Uploaded Documents) ────────────────────
// Medical files are returned only through authorized appointment downloads.
app.use('/uploads', (_req, res) => res.status(404).json({ success: false, message: 'Use the authenticated appointment download endpoint' }));

// ── Routes (Presentation Layer) ──────────────────────────
app.use('/api', routes);

// Health-check endpoint
app.get('/health', (_req, res) => {
  const connected = require('mongoose').connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'unavailable', timestamp: new Date().toISOString() });
});

// ── Global Error Handler ─────────────────────────────────
app.use(errorHandler);

// ── Start ────────────────────────────────────────────────
async function start() {
  // 1. Connect to MongoDB
  await connectDB();
  await Promise.all([
    require('./src/models/User').init(),
    require('./src/models/WalkIn').init(), require('./src/models/Slot').init(),
    require('./src/models/SlotPlan').init(), require('./src/models/AssignmentRecovery').init(),
    require('./src/models/Notification').init(),
    require('./src/models/Appointment').init(),
    require('./src/models/AppointmentComment').init(),
    require('./src/models/EmailOtp').init(),
  ]);
  if (await require('./src/models/AssignmentRecovery').countDocuments({ state: 'pending' })) {
    throw new Error('Interrupted assignments need reconciliation. Stop clinic writers and run node backend/scripts/recover-assignments.js --offline before starting.');
  }
  for (const plan of await require('./src/models/SlotPlan').find()) {
    await require('./src/services/slot.service').materializePlan(plan);
  }

  // 2. Register event-driven handlers (Module 7 & 9)
  registerAllHandlers();
  registerAuditHandlers();
  registerSlotFreedHandler();

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
