/**
 * Auth Middleware
 * ──────────────
 * Module 1: User Management (cross-cutting)
 *
 * protect  — Verifies JWT and attaches user to req.user.
 * authorize — Restricts access to specific roles.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');

const ROLES = ['Patient', 'Doctor', 'Staff', 'Admin'];
const recordId = value => String(value?._id || value || '');

function assertAppointmentAccess(appointment, user) {
  const allowed = user && (['Staff', 'Admin'].includes(user.role) ||
    (user.role === 'Patient' && recordId(appointment.patient) === recordId(user._id || user.id)) ||
    (user.role === 'Doctor' && recordId(appointment.doctor) === recordId(user._id || user.id)));
  if (!allowed) throw Object.assign(new Error('You do not have permission to access this appointment'), { statusCode: 403 });
}

// Runs before every individual appointment operation, including file upload/download.
async function appointmentAccess(req, res, next) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      throw Object.assign(new Error('Invalid appointment ID'), { statusCode: 400 });
    }
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });
    assertAppointmentAccess(appointment, req.user);
    req.appointment = appointment;
    next();
  } catch (err) { next(err); }
}

/**
 * Verify JWT from Authorization header.
 * Attaches the full user document (minus password) to req.user.
 */
async function protect(req, res, next) {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated — no token provided',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!mongoose.isObjectIdOrHexString(decoded.id)) throw new Error('Invalid token subject');

    // Attach user to request
    let user;
    try { user = await User.findById(decoded.id); }
    catch (err) { return next(err); } // A database outage does not invalidate a login token.
    if (!user || user.status === 'Deactivated' || !ROLES.includes(user.role) ||
        (decoded.version ?? 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({
        success: false,
        message: 'Account is unavailable or deactivated',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated — invalid token',
    });
  }
}

/**
 * Restrict to specific roles.
 * Usage: authorize('Staff', 'Admin')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role "${req.user.role}" is not authorized to access this resource`,
      });
    }
    next();
  };
}

module.exports = { protect, authorize, appointmentAccess, assertAppointmentAccess, recordId };
