/**
 * User Routes
 * ───────────
 * Module 1: User Management
 * Layer:    Presentation (Route Definitions)
 */

const { Router } = require('express');
const userController = require('../controllers/user.controller');
const { authorize } = require('../middleware/auth');

const router = Router();

// Public routes
router.post('/register', userController.register);
router.post('/login', userController.login);

// Protected routes
router.get('/me', userController.getMe);
router.get('/doctors', userController.getDoctors);
router.get('/', authorize('Admin'), userController.listUsers);
router.post('/', authorize('Admin'), userController.createUser);
router.get('/:id/schedule', authorize('Staff', 'Admin', 'Doctor'), userController.schedule);
router.patch('/:id/schedule', authorize('Staff', 'Admin', 'Doctor'), userController.schedule);

module.exports = router;

