/**
 * User Model
 * ──────────
 * Module 1: User Management
 * Layer:    Data Access
 *
 * Roles: Patient, Doctor, Staff, Admin
 * Passwords are hashed before save via bcryptjs.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false, // Excluded from queries by default
    },
    role: {
      type: String,
      enum: ['Patient', 'Doctor', 'Staff', 'Admin'],
      default: 'Patient',
    },
    contactNumber: {
      type: String,
      trim: true,
    },

    // ── Doctor-specific fields (only relevant when role === 'Doctor') ──
    consultationDuration: {
      type: Number,
      default: 15, // minutes per appointment slot
      min: 5,
      max: 120,
    },
    scheduleConfigured: { type: Boolean, default: false },
    workingHours: [
      {
        day: {
          type: Number, // 0 = Sunday, 1 = Monday, ... 6 = Saturday
          required: true,
          min: 0,
          max: 6,
        },
        start: {
          type: String, // "09:00"
          required: true,
          trim: true,
        },
        end: {
          type: String, // "17:00"
          required: true,
          trim: true,
        },
      },
    ],
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// ── Pre-save hook: hash password ─────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Instance method: compare password ────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
