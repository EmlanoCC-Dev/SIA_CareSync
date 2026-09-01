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
  APPOINTMENT_APPROVED: 'appointment.approved',
  APPOINTMENT_CANCELLED: 'appointment.cancelled',
  APPOINTMENT_COMPLETED: 'appointment.completed',

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
