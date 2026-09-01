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

/**
 * Register a new user.
 * @param {Object} userData - { firstName, lastName, email, password, role, contactNumber }
 * @returns {Object} { user, token }
 */
async function register(userData) {
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
async function getDoctors() {
  return User.find({ role: 'Doctor' }).select('firstName lastName email contactNumber');
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

module.exports = { register, login, getById, getDoctors, listUsers };

