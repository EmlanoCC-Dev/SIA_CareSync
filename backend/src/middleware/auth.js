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
    const decoded = jwt.verify(token, env.JWT_SECRET);

    // Attach user to request
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User belonging to this token no longer exists',
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

module.exports = { protect, authorize };
