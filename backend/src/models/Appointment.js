/**
 * Appointment Model
 * ─────────────────
 * Module 2: Appointment Module
 * Module 4: Version Tracking (via statusHistory sub-document)
 * Layer:    Data Access
 *
 * Statuses: Pending → Confirmed → Completed
 *                   → Cancelled (from any state)
 *
 * statusHistory embeds Module 4 (Version Tracking) — each status
 * transition is recorded with who changed it and when.
 */

const mongoose = require('mongoose');

// ── Sub-schema: Status History Entry (Module 4) ──────────
const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
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

// ── Main Schema ──────────────────────────────────────────
const appointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient reference is required'],
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // Assigned later by staff
    },
    date: {
      type: Date,
      required: [true, 'Appointment date is required'],
    },
    timeSlot: {
      type: String, // e.g., "09:00-09:30"
      trim: true,
    },
    reason: {
      type: String,
      required: [true, 'Reason for appointment is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
      default: 'Pending',
    },

    // Module 4: Version Tracking — full history of status changes
    statusHistory: [statusHistorySchema],

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

// ── Index for common queries ─────────────────────────────
appointmentSchema.index({ patient: 1, date: -1 });
appointmentSchema.index({ status: 1, date: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
