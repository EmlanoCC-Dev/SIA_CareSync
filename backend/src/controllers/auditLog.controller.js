/**
 * Audit Log Controller
 * ────────────────────
 * Module 9: Audit Log
 * Layer:    Presentation
 *
 * Read-only endpoint — audit logs are written by event
 * handlers, never by direct HTTP calls.
 */

const auditLogService = require('../services/auditLog.service');

/**
 * GET /api/audit-logs
 * List audit logs (admin only). Supports query filters.
 */
async function list(req, res, next) {
  try {
    const { action, performedBy, targetModel, page, limit } = req.query;
    const result = await auditLogService.list(
      { action, performedBy, targetModel },
      { page: parseInt(page) || 1, limit: parseInt(limit) || 50 }
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
