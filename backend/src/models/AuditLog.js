/**
 * Audit Log Model
 * ───────────────
 * Module 9: Audit Log
 * Layer:    Data Access
 *
 * Immutable record of every state-changing action in the system.
 * Written by the audit log event handler — never updated or deleted.
 */

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: [true, 'Action name is required'],
    trim: true,
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null, // null for system-triggered actions
  },
  targetModel: {
    type: String,
    required: true,
    trim: true,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  changes: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  timestamp: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
});

// ── Indexes ──────────────────────────────────────────────
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ performedBy: 1, timestamp: -1 });
auditLogSchema.index({ targetModel: 1, targetId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
