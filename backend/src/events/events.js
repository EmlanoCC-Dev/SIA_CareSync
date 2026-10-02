/**
 * Event Name Constants
 * ────────────────────
 * Event-Driven Integration Layer
 *
 * All event names live here to prevent typos and provide
 * a single source of truth for the pub/sub contract.
 *
 * Naming convention: MODULE.ACTION  (dot-separated, lowercase)
 */

const EVENTS = {
  // ── Module 2: Appointment ──────────────────────────────
  APPOINTMENT_BOOKED: 'appointment.booked',
  APPOINTMENT_ASSIGNED: 'appointment.assigned',
  SCHEDULE_UPDATED: 'doctor.scheduleUpdated',
  SLOT_STATUS_UPDATED: 'slot.statusUpdated',
  APPOINTMENT_APPROVED: 'appointment.approved',
  APPOINTMENT_DECLINED: 'appointment.declined',
  APPOINTMENT_CANCELLED: 'appointment.cancelled',
  APPOINTMENT_NO_SHOW: 'appointment.noShow',
  APPOINTMENT_CHECKED_IN: 'appointment.checkedIn',
  APPOINTMENT_COMPLETED: 'appointment.completed',

  // ── Slot lifecycle ─────────────────────────────────────
  SLOT_FREED: 'slot.freed',

  // ── Walk-in Queue ──────────────────────────────────────
  WALKIN_ADDED: 'walkIn.added',
  WALKIN_SLOT_ASSIGNED: 'walkIn.slotAssigned',
  WALKIN_STATUS_UPDATED: 'walkIn.statusUpdated',

  // ── Module 5: Review & Approval Workflow ───────────────
  REVISION_REQUESTED: 'appointment.revisionRequested',

  // ── Module 8: Queue ────────────────────────────────────
  PATIENT_CHECKED_IN: 'queue.patientCheckedIn',
  PATIENT_TURN_ALERT: 'queue.patientTurnAlert',

  // ── Module 3: Document Submission (placeholder) ────────
  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_VERIFIED: 'document.verified',

  // ── Module 6: Comment/Feedback (placeholder) ───────────
  COMMENT_ADDED: 'comment.added',
};

module.exports = EVENTS;
