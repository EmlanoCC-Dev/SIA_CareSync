/**
 * User Service
 * ────────────
 * Module 1: User Management
 * Layer:    Business Logic
 *
 * Handles registration, authentication, and user lookups.
 * No HTTP concerns — those live in the controller.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');
const { validateTimeWindow } = require('../utils/timeHelper');
const emitter = require('../events/emitter');
const EVENTS = require('../events/events');
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const bcrypt = require('bcryptjs');
const otpService = require('./otp.service');
const { linkVerifiedPatient } = require('./walkInAccount.service');

/**
 * Register a new user.
 * @param {Object} userData - { firstName, lastName, email, password, role, contactNumber }
 * @returns {Object} { user, token }
 */
async function register(userData, actorId = null) {
  if (!userData || typeof userData.email !== 'string' || !userData.email.trim() ||
      typeof userData.password !== 'string' || userData.password.length < 6 || Buffer.byteLength(userData.password) > 72) {
    throw Object.assign(new Error('Provide an email and a password of at least six characters and at most 72 bytes'), { statusCode: 400 });
  }
  for (const field of ['firstName', 'lastName']) {
    if (typeof userData[field] !== 'string' || !userData[field].trim() || userData[field].length > 100) {
      throw Object.assign(new Error('Provide a first and last name of at most 100 characters'), { statusCode: 400 });
    }
  }
  const email = otpService.normalizeEmail(userData.email);
  // Check for duplicate email
  const existing = await User.findOne({ email });
  if (existing) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    throw err;
  }

  if (!actorId) await otpService.consumeOtp('register', email, userData.otp);
  const { otp, ...account } = userData;
  let user;
  try {
    user = await User.create({ ...account, email, emailVerifiedAt: actorId ? null : new Date() });
  } catch (err) {
    if (err.code === 11000) throw Object.assign(new Error('Email already registered'), { statusCode: 409 });
    throw err;
  }

  // Account creation succeeds even if linking needs to retry on a portal read.
  try { await linkVerifiedPatient(user); }
  catch { console.error('[WalkIn] Account linking deferred until the patient opens their appointments'); }

  // Strip password from response
  const userObj = user.toObject();
  delete userObj.password;

  const token = _signToken(user._id, user.tokenVersion || 0);
  emitter.emit(EVENTS.USER_CREATED, {
    performedBy: actorId || user._id, targetModel: 'User', targetId: user._id,
    creationMethod: actorId ? 'Admin creation' : 'Self-registration',
    user: { _id: user._id, firstName: userObj.firstName, lastName: userObj.lastName, role: userObj.role },
  });
  return { user: userObj, token };
}

/**
 * Authenticate a user by email + password.
 * @param {string} email
 * @param {string} password
 * @returns {Object} { user, token }
 */
async function login(email, password) {
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    throw Object.assign(new Error('Email and password must be non-empty text'), { statusCode: 400 });
  }
  const user = await User.findOne({ email: otpService.normalizeEmail(email) }).select('+password');
  if (!user) {
    const err = new Error('Invalid credentials');
    err.statusCode = 401;
    throw err;
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    const err = new Error('Invalid credentials');
    err.statusCode = 401;
    throw err;
  }
  if (user.status === 'Deactivated') {
    throw Object.assign(new Error('This account is deactivated. Contact the clinic administrator.'), { statusCode: 403 });
  }

  const userObj = user.toObject();
  delete userObj.password;

  const token = _signToken(user._id, user.tokenVersion || 0);
  return { user: userObj, token };
}

/**
 * Get user by ID (excludes password).
 */
async function getById(userId) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  await linkVerifiedPatient(user);
  return user;
}

/**
 * Get all doctors.
 */
async function getDoctors(actor) {
  return User.find({ role: 'Doctor', status: { $ne: 'Deactivated' } }).select(actor?.role === 'Patient'
    ? 'firstName lastName' : 'firstName lastName email contactNumber');
}

/**
 * List users with optional role filtering (Admin only).
 */
async function listUsers(filter = {}) {
  const query = {};
  if (filter.role) query.role = filter.role;
  return User.find(query).select('firstName lastName email role status contactNumber consultationDuration createdAt');
}

async function updateUser(userId, actor, data) {
  if (actor.role !== 'Admin') throw Object.assign(new Error('Only Admin can edit accounts'), { statusCode: 403 });
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw Object.assign(new Error('Provide account fields'), { statusCode: 400 });
  if (!mongoose.isObjectIdOrHexString(userId)) throw Object.assign(new Error('Invalid user ID'), { statusCode: 400 });
  const changes = {};
  for (const field of ['firstName', 'lastName', 'email', 'contactNumber', 'role', 'status']) {
    if (data[field] === undefined) continue;
    if (typeof data[field] !== 'string' || (field !== 'contactNumber' && !data[field].trim())) {
      throw Object.assign(new Error(`${field} must be non-empty text`), { statusCode: 400 });
    }
    changes[field] = data[field].trim();
  }
  if (changes.email !== undefined) {
    changes.email = otpService.normalizeEmail(changes.email);
  }
  if (changes.role && !['Patient', 'Doctor', 'Staff', 'Admin'].includes(changes.role)) throw Object.assign(new Error('Invalid role'), { statusCode: 400 });
  if (changes.status && !['Active', 'Deactivated'].includes(changes.status)) throw Object.assign(new Error('Invalid account status'), { statusCode: 400 });
  if (!Object.keys(changes).length) throw Object.assign(new Error('No account changes provided'), { statusCode: 400 });
  if (String(userId) === String(actor._id || actor.id) && (changes.status === 'Deactivated' || (changes.role && changes.role !== 'Admin'))) {
    throw Object.assign(new Error('You cannot deactivate your own account or remove your own Admin role'), { statusCode: 400 });
  }
  const user = await getById(userId);
  if (changes.email && changes.email !== user.email) changes.emailVerifiedAt = null;
  if (user.role === 'Doctor' && changes.role && changes.role !== 'Doctor' &&
      await Appointment.exists({ doctor: userId, status: { $in: ['Pending', 'Needs correction', 'Confirmed', 'Checked In', 'In Progress'] } })) {
    throw Object.assign(new Error('Resolve this doctor’s open appointments before changing their role'), { statusCode: 409 });
  }
  let updated;
  try {
    updated = await User.findByIdAndUpdate(userId, { $set: changes }, { new: true, runValidators: true });
  } catch (err) {
    if (err.code === 11000) throw Object.assign(new Error('Email already registered'), { statusCode: 409 });
    throw err;
  }
  if (!updated) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  emitter.emit(EVENTS.USER_UPDATED, { performedBy: actor._id || actor.id, targetModel: 'User', targetId: updated._id, changes });
  return updated;
}

// ── Private helpers ──────────────────────────────────────

function _signToken(userId, version = 0) {
  return jwt.sign({ id: userId, version }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

async function resetPassword({ email: value, otp, password }) {
  const email = otpService.normalizeEmail(value);
  if (typeof password !== 'string' || password.length < 6 || Buffer.byteLength(password) > 72) {
    throw Object.assign(new Error('Password must have at least six characters and at most 72 bytes'), { statusCode: 400 });
  }
  const challenge = await otpService.consumeOtp('password', email, otp);
  if (!challenge.user) throw Object.assign(new Error('Invalid or expired password change request'), { statusCode: 400 });
  const version = challenge.tokenVersion || 0;
  const filter = { _id: challenge.user, email, status: { $ne: 'Deactivated' },
    ...(version === 0 ? { $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }] } : { tokenVersion: version }),
  };
  const updated = await User.findOneAndUpdate(filter,
    { $set: { password: await bcrypt.hash(password, 10) }, $inc: { tokenVersion: 1 } }, { new: true, runValidators: true });
  if (!updated) throw Object.assign(new Error('Account details changed. Request a new verification code.'), { statusCode: 409 });
  emitter.emit(EVENTS.USER_UPDATED, { performedBy: updated._id, targetModel: 'User', targetId: updated._id, changes: { passwordChanged: true } });
  return { message: 'Password changed. Sign in again with your new password.' };
}

async function getSchedule(doctorId, actor) {
  if (actor.role === 'Doctor' && String(actor._id || actor.id) !== String(doctorId)) {
    throw Object.assign(new Error('You can only manage your own schedule'), { statusCode: 403 });
  }
  const doctor = await getById(doctorId);
  if (doctor.role !== 'Doctor') throw Object.assign(new Error('Doctor not found'), { statusCode: 404 });
  return doctor;
}

async function updateSchedule(doctorId, actor, { workingHours, consultationDuration }) {
  const duration = consultationDuration;
  if (!Number.isInteger(duration) || duration < 5 || duration > 120 || !Array.isArray(workingHours) || workingHours.length > 7) {
    throw Object.assign(new Error('Provide up to seven working days and a whole duration of 5–120 minutes'), { statusCode: 400 });
  }
  const days = new Set();
  const hours = workingHours.map(entry => {
    if (!entry || !Number.isInteger(entry.day) || entry.day < 0 || entry.day > 6 || days.has(entry.day)) {
      throw Object.assign(new Error('Each working day must be unique and between 0 (Sunday) and 6 (Saturday)'), { statusCode: 400 });
    }
    days.add(entry.day);
    validateTimeWindow(entry.start, entry.end, duration);
    return { day: entry.day, start: entry.start, end: entry.end };
  });
  const doctor = await getSchedule(doctorId, actor);
  doctor.workingHours = hours;
  doctor.consultationDuration = duration;
  doctor.scheduleConfigured = true;
  await doctor.save();
  emitter.emit(EVENTS.SCHEDULE_UPDATED, {
    performedBy: actor._id || actor.id, targetModel: 'User', targetId: doctor._id,
    workingHours: hours, consultationDuration: duration,
  });
  return doctor;
}

module.exports = { register, login, getById, getDoctors, listUsers, updateUser, getSchedule, updateSchedule, resetPassword };

