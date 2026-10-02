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

/**
 * Register a new user.
 * @param {Object} userData - { firstName, lastName, email, password, role, contactNumber }
 * @returns {Object} { user, token }
 */
async function register(userData, actorId = null) {
  if (!userData || typeof userData.email !== 'string' || !userData.email.trim() ||
      typeof userData.password !== 'string' || userData.password.length < 6) {
    throw Object.assign(new Error('Provide an email and a password of at least six characters'), { statusCode: 400 });
  }
  // Check for duplicate email
  const existing = await User.findOne({ email: userData.email });
  if (existing) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    throw err;
  }

  const user = await User.create(userData);

  // Strip password from response
  const userObj = user.toObject();
  delete userObj.password;

  const token = _signToken(user._id);
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
  const user = await User.findOne({ email }).select('+password');
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

  const token = _signToken(user._id);
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
    changes.email = changes.email.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email)) throw Object.assign(new Error('Provide a valid email'), { statusCode: 400 });
  }
  if (changes.role && !['Patient', 'Doctor', 'Staff', 'Admin'].includes(changes.role)) throw Object.assign(new Error('Invalid role'), { statusCode: 400 });
  if (changes.status && !['Active', 'Deactivated'].includes(changes.status)) throw Object.assign(new Error('Invalid account status'), { statusCode: 400 });
  if (!Object.keys(changes).length) throw Object.assign(new Error('No account changes provided'), { statusCode: 400 });
  if (String(userId) === String(actor._id || actor.id) && (changes.status === 'Deactivated' || (changes.role && changes.role !== 'Admin'))) {
    throw Object.assign(new Error('You cannot deactivate your own account or remove your own Admin role'), { statusCode: 400 });
  }
  const user = await getById(userId);
  if (user.role === 'Doctor' && changes.role && changes.role !== 'Doctor' &&
      await Appointment.exists({ doctor: userId, status: { $in: ['Pending', 'Confirmed', 'In Progress'] } })) {
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

function _signToken(userId) {
  return jwt.sign({ id: userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
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

module.exports = { register, login, getById, getDoctors, listUsers, updateUser, getSchedule, updateSchedule };

