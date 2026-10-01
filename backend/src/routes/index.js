/**
 * Route Index
 * ───────────
 * Mounts all sub-routers under /api.
 *
 * Route map:
 *   /api/users         → Module 1: User Management
 *   /api/appointments  → Module 2: Appointment Module
 *   /api/audit-logs    → Module 9: Audit Log
 *
 * Future:
 *   /api/documents     → Module 3: Document Submission
 *   /api/reviews       → Module 5: Review & Approval Workflow
 *   /api/comments      → Module 6: Comment/Feedback
 *   /api/dashboard     → Module 8: Dashboard/Report
 */

const { Router } = require('express');

const userRoutes = require('./user.routes');
const appointmentRoutes = require('./appointment.routes');
const auditLogRoutes = require('./auditLog.routes');
const walkInRoutes = require('./walkIn.routes');
const slotRoutes = require('./slot.routes');
const systemRoutes = require('./system.routes');

const router = Router();
const { protect } = require('../middleware/auth');

// Exact public exceptions; every other API request requires a verified login.
const publicRequests = new Set([
  'POST /users/login', 'POST /users/register',
  'GET /system/time', 'HEAD /system/time',
  'GET /walkins/now-serving', 'HEAD /walkins/now-serving',
]);
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  const route = `${req.method} ${req.path.replace(/\/+$/, '').toLowerCase()}`;
  if (publicRequests.has(route)) return next();
  return protect(req, res, next);
});
router.use((req, res, next) => {
  if (Object.values(req.query).some(value => typeof value !== 'string')) {
    return res.status(400).json({ success: false, message: 'Query parameters must be single text values' });
  }
  next();
});

router.use('/users', userRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/walkins', walkInRoutes);
router.use('/slots', slotRoutes);
router.use('/system', systemRoutes);
router.use('/reports', require('./report.routes'));
router.use((_req, res) => res.status(404).json({ success: false, message: 'API endpoint not found' }));

module.exports = router;
