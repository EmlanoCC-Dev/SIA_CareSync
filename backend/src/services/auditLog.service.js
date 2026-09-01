/**
 * Audit Log Service
 * ─────────────────
 * Module 9: Audit Log
 * Layer:    Business Logic
 *
 * Persists immutable audit records. Called by the audit
 * log event handler — not directly by controllers.
 */

const AuditLog = require('../models/AuditLog');

/**
 * Write an audit log entry.
 * @param {Object} data
 * @param {string}   data.action       - e.g., 'APPOINTMENT_APPROVED'
 * @param {ObjectId} data.performedBy  - User who performed the action
 * @param {string}   data.targetModel  - e.g., 'Appointment', 'User'
 * @param {ObjectId} data.targetId     - ID of the affected document
 * @param {Object}   data.changes      - Snapshot of relevant data
 */
async function logAction({ action, performedBy, targetModel, targetId, changes }) {
  return AuditLog.create({
    action,
    performedBy,
    targetModel,
    targetId,
    changes,
  });
}

/**
 * Query audit logs with optional filters.
 */
async function list(filters = {}, { page = 1, limit = 50 } = {}) {
  const query = {};
  if (filters.action) query.action = filters.action;
  if (filters.performedBy) query.performedBy = filters.performedBy;
  if (filters.targetModel) query.targetModel = filters.targetModel;

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('performedBy', 'firstName lastName email role'),
    AuditLog.countDocuments(query),
  ]);

  return { logs, total, page, limit };
}

module.exports = { logAction, list };
