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

/**
 * Register a new user.
 * @param {Object} userData - { firstName, lastName, email, password, role, contactNumber }
 * @returns {Object} { user, token }
 */
async function register(userData) {
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
  return User.find({ role: 'Doctor' }).select(actor?.role === 'Patient'
    ? 'firstName lastName' : 'firstName lastName email contactNumber');
}

/**
 * List users with optional role filtering (Admin only).
 */
async function listUsers(filter = {}) {
  const query = {};
  if (filter.role) query.role = filter.role;
  return User.find(query).select('firstName lastName email role contactNumber createdAt');
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

module.exports = { register, login, getById, getDoctors, listUsers, getSchedule, updateSchedule };

