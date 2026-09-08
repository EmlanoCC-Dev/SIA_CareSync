/**
 * Slot Model
 * ──────────
 * Appointment Lifecycle — Time Slot Management
 * Layer:    Data Access
 *
 * Each slot represents an independently bookable time window
 * generated from a doctor's working hours and consultation duration.
 *
 * Status lifecycle:
 *   Available → Reserved-Tentative → Reserved-Confirmed → In Progress → Completed
 *                                                                      → Cancelled
 *                                                                      → No-show
 *   (Any non-terminal status can revert to Available via slot.freed)
 */

const mongoose = require('mongoose');

const SLOT_STATUSES = [
  'Available',
  'Reserved-Tentative',
  'Reserved-Confirmed',
  'In Progress',
  'Completed',
  'Cancelled',
  'No-show',
];

const slotSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Doctor reference is required'],
    },
    date: {
      type: Date,
      required: [true, 'Slot date is required'],
    },
    startTime: {
      type: String, // "09:00"
      required: [true, 'Start time is required'],
      trim: true,
    },
    endTime: {
      type: String, // "09:15"
      required: [true, 'End time is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: SLOT_STATUSES,
      default: 'Available',
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ──────────────────────────────────────────────
// Unique constraint: one slot per doctor per date per start time
slotSchema.index({ doctor: 1, date: 1, startTime: 1 }, { unique: true });
// Fast lookups for available slots
slotSchema.index({ status: 1, date: 1 });
slotSchema.index({ doctor: 1, date: 1, status: 1 });

// ── Export status enum for reuse ─────────────────────────
module.exports = mongoose.model('Slot', slotSchema);
module.exports.SLOT_STATUSES = SLOT_STATUSES;
