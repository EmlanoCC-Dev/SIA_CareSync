/**
 * Walk-In Model
 * ─────────────
 * Walk-in Queue Module
 * Layer:    Data Access
 *
 * Standalone model for walk-in patients who do NOT have a
 * user account. Staff manually enters name + contact number;
 * the system assigns a sequential queue number.
 *
 * Status lifecycle:
 *   Waiting → Slot Assigned → Checked In → In Progress → Completed
 *                                                       → Left (walked away)
 */

const mongoose = require('mongoose');

const WALKIN_STATUSES = [
  'Waiting',
  'Slot Assigned',
  'Checked In',
  'In Progress',
  'Completed',
  'Left',
];

const walkInSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Walk-in patient name is required'],
      trim: true,
    },
    contactNumber: {
      type: String,
      required: [true, 'Contact number is required'],
      trim: true,
    },
    queueNumber: {
      type: Number,
      required: [true, 'Queue number is required'],
    },
    status: {
      type: String,
      enum: WALKIN_STATUSES,
      default: 'Waiting',
    },
    assignedSlot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Slot',
      default: null,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
  },
  {
    timestamps: true, // createdAt = when they joined the queue
  }
);

// ── Indexes ──────────────────────────────────────────────
// Queue ordering — most recent day's walk-ins sorted by number
walkInSchema.index({ status: 1, createdAt: 1 });
walkInSchema.index({ queueNumber: 1, createdAt: -1 });

// ── Export status enum for reuse ─────────────────────────
module.exports = mongoose.model('WalkIn', walkInSchema);
module.exports.WALKIN_STATUSES = WALKIN_STATUSES;
