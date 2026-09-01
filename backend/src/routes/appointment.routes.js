/**
 * Appointment Routes
 * ──────────────────
 * Module 2: Appointment Module
 * Layer:    Presentation (Route Definitions)
 *
 * All routes require authentication.
 * Role-based authorization is handled per route.
 */

const { Router } = require('express');
const appointmentController = require('../controllers/appointment.controller');
const { protect, authorize } = require('../middleware/auth');

const router = Router();

// All appointment routes require login
router.use(protect);

// Patient books an appointment
router.post('/', authorize('Patient'), appointmentController.create);

// List appointments (role-aware: patients see own, staff/admin see all)
router.get('/', appointmentController.list);

// Get single appointment
router.get('/:id', appointmentController.getById);

// Staff/Admin approves
router.patch('/:id/approve', authorize('Staff', 'Admin'), appointmentController.approve);

// Any authorized user cancels
router.patch('/:id/cancel', appointmentController.cancel);

// Doctor/Staff completes
router.patch('/:id/complete', authorize('Doctor', 'Staff', 'Admin'), appointmentController.complete);

module.exports = router;
