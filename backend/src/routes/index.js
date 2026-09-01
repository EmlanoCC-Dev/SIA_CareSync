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

const router = Router();

router.use('/users', userRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/audit-logs', auditLogRoutes);

module.exports = router;
