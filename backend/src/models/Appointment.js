/**
 * Appointment Model
 * ─────────────────
 * Module 2: Appointment Module
 * Module 4: Version Tracking (via statusHistory sub-document)
 * Layer:    Data Access
 *
 * Full lifecycle statuses:
 *   Pending → Confirmed → In Progress → Completed
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
  'Confirmed',
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
      default: Date.now,
    },
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
      // Not strictly required — walk-ins don't have a User account.
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

    // ── Consultation data (filled by doctor during/after visit) ──
    consultationNotes: {
      type: String,
      trim: true,
    },
    documents: [documentSchema],

    // Module 6: Comment/Feedback (placeholder field)
    remarks: {
      type: String,
      trim: true,
    },

    // Module 8: Queue position (placeholder)
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

module.exports = mongoose.model('Appointment', appointmentSchema);
module.exports.APPOINTMENT_STATUSES = APPOINTMENT_STATUSES;
