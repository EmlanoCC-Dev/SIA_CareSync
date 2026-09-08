/**
 * Appointment Routes
 * ──────────────────
 * Module 2: Appointment Module
 * Layer:    Presentation (Route Definitions)
 */

const { Router } = require('express');
const appointmentController = require('../controllers/appointment.controller');
const { protect, authorize } = require('../middleware/auth');

const router = Router();

// All appointment routes require login
router.use(protect);

// Patient books an appointment
router.post('/', authorize('Patient'), appointmentController.create);

// List appointments (role-aware: patients see own, doctors see assigned, staff/admin see all)
router.get('/', appointmentController.list);

// Get single appointment
router.get('/:id', appointmentController.getById);

// Staff/Admin approves pending appointment
router.patch('/:id/approve', authorize('Staff', 'Admin'), appointmentController.approve);

// Staff, Admin, or Doctor declines pending appointment (reason required)
router.patch('/:id/decline', authorize('Staff', 'Admin', 'Doctor'), appointmentController.decline);

// Patient or Doctor cancels confirmed appointment
router.patch('/:id/cancel', appointmentController.cancel);

// Staff/Admin marks patient as No-show
router.patch('/:id/no-show', authorize('Staff', 'Admin'), appointmentController.noShow);

// Staff/Admin checks in patient on appointment day
router.patch('/:id/check-in', authorize('Staff', 'Admin'), appointmentController.checkIn);

// Doctor uploads consultation notes, lab results, X-rays
router.patch('/:id/documents', authorize('Doctor'), appointmentController.uploadDocuments);

// Doctor or Staff completes appointment
router.patch('/:id/complete', authorize('Doctor', 'Staff', 'Admin'), appointmentController.complete);

module.exports = router;
