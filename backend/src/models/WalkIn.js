/**
 * Walk-In Model
 * ─────────────
 * Walk-in Queue Module
 * Layer:    Data Access
 *
 * Staff enters name + email; an account is optional. A verified
 * patient account can later link to the same email and its visits.
 * The system assigns a sequential queue number.
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
      maxlength: 200,
    },
    email: {
      type: String,
      required() { return this.isNew; }, // Keep historical phone-only entries readable.
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/,
    },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    contactNumber: { type: String, trim: true }, // Retained for historical entries only.
    queueNumber: {
      type: Number,
      required: [true, 'Queue number is required'],
    },
    queueDay: { type: String, required() { return this.isNew; } },
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
walkInSchema.index({ email: 1, patient: 1 });
walkInSchema.index({ patient: 1 });
walkInSchema.index({ queueNumber: 1, createdAt: -1 });
// Existing records without queueDay remain readable; new registrations use this constraint.
walkInSchema.index({ queueDay: 1, queueNumber: 1 }, {
  unique: true, name: 'unique_daily_ticket', partialFilterExpression: { queueDay: { $type: 'string' } },
});

// ── Export status enum for reuse ─────────────────────────
module.exports = mongoose.model('WalkIn', walkInSchema);
module.exports.WALKIN_STATUSES = WALKIN_STATUSES;
