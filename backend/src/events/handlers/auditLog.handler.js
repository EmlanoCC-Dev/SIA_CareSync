/**
 * Audit Log Event Handler
 * ───────────────────────
 * Module 9: Audit Log
 *
 * Listens for ALL state-changing events and persists an
 * immutable audit record. Every action that modifies data
 * should emit an event that this handler captures.
 */

const emitter = require('../emitter');
const EVENTS = require('../events');
const auditLogService = require('../../services/auditLog.service');

function registerAuditHandlers() {
  // Listen to every defined event and log it
  const auditableEvents = [
    { event: EVENTS.APPOINTMENT_BOOKED, action: 'APPOINTMENT_BOOKED' },
    { event: EVENTS.APPOINTMENT_APPROVED, action: 'APPOINTMENT_APPROVED' },
    { event: EVENTS.APPOINTMENT_DECLINED, action: 'APPOINTMENT_DECLINED' },
    { event: EVENTS.APPOINTMENT_CANCELLED, action: 'APPOINTMENT_CANCELLED' },
    { event: EVENTS.APPOINTMENT_NO_SHOW, action: 'APPOINTMENT_NO_SHOW' },
    { event: EVENTS.APPOINTMENT_CHECKED_IN, action: 'APPOINTMENT_CHECKED_IN' },
    { event: EVENTS.APPOINTMENT_COMPLETED, action: 'APPOINTMENT_COMPLETED' },
    { event: EVENTS.SLOT_FREED, action: 'SLOT_FREED' },
    { event: EVENTS.WALKIN_ADDED, action: 'WALKIN_ADDED' },
    { event: EVENTS.WALKIN_SLOT_ASSIGNED, action: 'WALKIN_SLOT_ASSIGNED' },
    { event: EVENTS.REVISION_REQUESTED, action: 'REVISION_REQUESTED' },
    { event: EVENTS.PATIENT_CHECKED_IN, action: 'PATIENT_CHECKED_IN' },
    { event: EVENTS.DOCUMENT_UPLOADED, action: 'DOCUMENT_UPLOADED' },
    { event: EVENTS.DOCUMENT_VERIFIED, action: 'DOCUMENT_VERIFIED' },
    { event: EVENTS.COMMENT_ADDED, action: 'COMMENT_ADDED' },
  ];

  for (const { event, action } of auditableEvents) {
    emitter.on(event, async (data) => {
      try {
        await auditLogService.logAction({
          action,
          performedBy: data.performedBy || data.userId || null,
          targetModel: data.targetModel || 'Appointment',
          targetId: data.appointment?._id || data.slot?._id || data.walkIn?._id || data.targetId || null,
          changes: data,
        });
        console.log(`📝  [AuditLog] ${action} recorded`);
      } catch (err) {
        // Audit logging should never crash the main flow
        console.error(`⚠️  [AuditLog] Failed to log ${action}:`, err.message);
      }
    });
  }

  console.log('📝  Audit log event handlers registered');
}

module.exports = { registerAuditHandlers };
