/**
 * Appointment Model
 * ─────────────────
 * Module 2: Appointment Module
 * Module 4: Version Tracking (status and consultation content snapshots)
 * Layer:    Data Access
 *
 * Full lifecycle statuses:
 *   Pending → Confirmed → Checked In → In Progress → Completed
 *           → Declined  (staff/doctor rejects while Pending)
 *           → Cancelled (patient/doctor cancels after Confirmed)
 *           → No-show   (patient didn't show up)
 *
 * statusHistory embeds Module 4 (Version Tracking) — each status
 * transition is recorded with who changed it and when.
 */

const mongoose = require('mongoose');

// ── Full status enum ─────────────────────────────────────
const APPOINTMENT_STATUSES = [
  'Pending',
  'Needs correction',
  'Confirmed',
  'Checked In',
  'Declined',
  'In Progress',
  'Completed',
  'Cancelled',
  'No-show',
];

// ── Sub-schema: Status History Entry (Module 4) ──────────
const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: APPOINTMENT_STATUSES,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

// ── Sub-schema: Uploaded Document ────────────────────────
const documentVersionSchema = new mongoose.Schema({
  version: { type: Number, required: true },
  filename: { type: String, required: true, trim: true },
  url: { type: String, required: true, trim: true },
  type: { type: String, trim: true },
  uploadedAt: { type: Date, default: null },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  uploaderName: { type: String, default: null },
  uploaderRole: { type: String, default: null },
}, { _id: false });

const noteVersionSchema = new mongoose.Schema({
  version: { type: Number, required: true },
  notes: { type: String, default: '' },
  savedAt: { type: Date, default: null },
  savedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  authorName: { type: String, default: null },
  authorRole: { type: String, default: null },
}, { _id: false });

const documentSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String, // e.g., 'consultation_notes', 'lab_result', 'xray'
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: null,
    },
    version: { type: Number, default: 1 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    uploaderName: { type: String, default: null },
    uploaderRole: { type: String, default: null },
    versions: [documentVersionSchema],
    archivedAt: { type: Date, default: null },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    archivedByName: { type: String, default: null },
  },
  { _id: true }
);

// ── Main Schema ──────────────────────────────────────────
const appointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      // Optional for walk-ins; linked when a patient verifies the matching email.
      // Validated at the service layer instead.
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // Assigned later by staff
    },

    // ── Slot reference (canonical time data) ─────────────
    slot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Slot',
      default: null,
    },

    // ── Walk-in reference (for non-registered patients) ──
    walkIn: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WalkIn',
      default: null,
    },

    date: {
      type: Date,
      required: [true, 'Appointment date is required'],
    },
    timeSlot: {
      type: String, // e.g., "09:00-09:15" — kept for backward compat
      trim: true,
    },
    reason: {
      type: String,
      required: [true, 'Reason for appointment is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: APPOINTMENT_STATUSES,
      default: 'Pending',
    },

    // ── Decline / cancel reason ──────────────────────────
    declineReason: {
      type: String,
      trim: true,
    },

    // Module 4: Version Tracking — full history of status changes
    statusHistory: [statusHistorySchema],
    bookingRevision: { type: Number, default: 0 },
    bookingHistory: [{
      _id: false,
      revision: { type: Number, required: true },
      action: { type: String, enum: ['Correction requested', 'Resubmitted'], required: true },
      previousReason: { type: String, required: true },
      reason: { type: String, required: true },
      explanation: { type: String, default: '' },
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      actorName: { type: String, required: true },
      actorRole: { type: String, required: true },
      changedAt: { type: Date, required: true },
    }],

    // ── Consultation data (filled by doctor during/after visit) ──
    consultationNotes: {
      type: String,
      trim: true,
    },
    documents: [documentSchema],
    notesRevision: { type: Number, default: 0 },
    noteVersions: [noteVersionSchema],
    archivedDocuments: [documentSchema],

    // Legacy single remark; discussions are stored in AppointmentComment.
    remarks: {
      type: String,
      trim: true,
    },

    // Scheduled arrival tickets have their own A- prefix on the public board.
    queueDay: { type: String },
    checkedInAt: { type: Date },
    queueNumber: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ── Custom validation: must have patient OR walkIn ───────
appointmentSchema.pre('validate', function (next) {
  if (!this.patient && !this.walkIn) {
    next(new Error('Appointment must reference either a patient or a walk-in'));
  } else {
    next();
  }
});

// ── Indexes for common queries ───────────────────────────
appointmentSchema.index({ patient: 1, date: -1 });
appointmentSchema.index({ status: 1, date: 1 });
appointmentSchema.index({ slot: 1 });
appointmentSchema.index({ walkIn: 1 });
appointmentSchema.index({ queueDay: 1, queueNumber: 1 }, {
  unique: true, name: 'unique_scheduled_daily_ticket', partialFilterExpression: { queueDay: { $type: 'string' } },
});

module.exports = mongoose.model('Appointment', appointmentSchema);
module.exports.APPOINTMENT_STATUSES = APPOINTMENT_STATUSES;
