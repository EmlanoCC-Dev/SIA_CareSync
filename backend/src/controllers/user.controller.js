/**
 * User Controller
 * ───────────────
 * Module 1: User Management
 * Layer:    Presentation
 *
 * Thin HTTP layer — parses request, delegates to service,
 * formats response. No business logic here.
 */

const userService = require('../services/user.service');

/**
 * POST /api/users/register
 */
async function register(req, res, next) {
  try {
    const { firstName, lastName, email, password, role, contactNumber } = req.body;
    const result = await userService.register({
      firstName,
      lastName,
      email,
      password,
      role,
      contactNumber,
    });
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/users/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await userService.login(email, password);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/users/me
 * Requires auth middleware to populate req.user.
 */
async function getMe(req, res, next) {
  try {
    const user = await userService.getById(req.user.id);
    res.json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/users/doctors
 * List all available doctors (for patient booking and staff scheduling).
 */
async function getDoctors(req, res, next) {
  try {
    const doctors = await userService.getDoctors();
    res.json({
      success: true,
      data: doctors,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/users
 * List users (Admin only).
 */
async function listUsers(req, res, next) {
  try {
    const { role } = req.query;
    const users = await userService.listUsers({ role });
    res.json({
      success: true,
      data: users,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getMe, getDoctors, listUsers };

