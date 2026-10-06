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
    const pageNumber = Number(page || 1), pageSize = Number(limit || 50);
    if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 200 || !Number.isSafeInteger((pageNumber - 1) * pageSize)) {
      throw Object.assign(new Error('Use a positive page number and a page size from 1 to 200'), { statusCode: 400 });
    }
    const result = await auditLogService.list(
      { action, performedBy, targetModel },
      { page: pageNumber, limit: pageSize }
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
