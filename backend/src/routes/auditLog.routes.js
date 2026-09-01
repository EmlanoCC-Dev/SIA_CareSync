/**
 * Audit Log Routes
 * ────────────────
 * Module 9: Audit Log
 * Layer:    Presentation (Route Definitions)
 *
 * Admin-only read access to the audit trail.
 */

const { Router } = require('express');
const auditLogController = require('../controllers/auditLog.controller');
const { protect, authorize } = require('../middleware/auth');

const router = Router();

// Only admins can view audit logs
router.get('/', protect, authorize('Admin'), auditLogController.list);

module.exports = router;
