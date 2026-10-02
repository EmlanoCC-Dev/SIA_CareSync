/**
 * Appointment Routes
 * ──────────────────
 * Module 2: Appointment Module
 * Layer:    Presentation (Route Definitions)
 */

const { Router } = require('express');
const appointmentController = require('../controllers/appointment.controller');
const { authorize, appointmentAccess } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = Router();

// Login is enforced centrally by the API router.

// Patient books an appointment
router.post('/', authorize('Patient'), appointmentController.create);

// List appointments (role-aware: patients see own, doctors see assigned, staff/admin see all)
router.get('/', appointmentController.list);

router.use('/:id', appointmentAccess);

// Get single appointment
router.get('/:id', appointmentController.getById);
router.get('/:id/comments', appointmentController.listComments);
router.get('/:id/versions', appointmentController.getVersions);
router.post('/:id/comments', authorize('Patient', 'Doctor', 'Staff', 'Admin'), appointmentController.addComment);
router.patch('/:id/assign', authorize('Staff', 'Admin'), appointmentController.assignSlot);

// Staff/Admin approves pending appointment
router.patch('/:id/approve', authorize('Staff', 'Admin'), appointmentController.approve);

// Staff, Admin, or Doctor declines pending appointment (reason required)
router.patch('/:id/decline', authorize('Staff', 'Admin', 'Doctor'), appointmentController.decline);

// Patient or Doctor cancels confirmed appointment
router.patch('/:id/cancel', authorize('Patient', 'Doctor', 'Staff', 'Admin'), appointmentController.cancel);

// Staff/Admin marks patient as No-show
router.patch('/:id/no-show', authorize('Staff', 'Admin'), appointmentController.noShow);

// Staff/Admin checks in patient on appointment day
router.patch('/:id/check-in', authorize('Staff', 'Admin', 'Doctor'), appointmentController.checkIn);
router.patch('/:id/start', authorize('Staff', 'Admin', 'Doctor'), appointmentController.startConsultation);

// Doctor uploads consultation notes
router.patch('/:id/documents', authorize('Doctor', 'Staff', 'Admin'), appointmentController.uploadDocuments);

// Doctor or Staff uploads physical medical document file
router.post('/:id/upload', authorize('Doctor', 'Staff', 'Admin'), upload.single('file'), appointmentController.uploadFile);
router.post('/:id/documents/:docId/replace', authorize('Doctor', 'Staff', 'Admin'), upload.single('file'), appointmentController.uploadFile);

// Delete an attached document
router.delete('/:id/documents/:docId', authorize('Doctor', 'Staff', 'Admin'), appointmentController.deleteDocument);
router.get('/:id/documents/:docId/download', appointmentController.downloadDocument);
router.get('/:id/documents/:docId/versions/:version/download', appointmentController.downloadDocument);

// Doctor or Staff completes appointment
router.patch('/:id/complete', authorize('Doctor', 'Staff', 'Admin'), appointmentController.complete);

module.exports = router;
