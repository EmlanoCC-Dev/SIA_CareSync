/**
 * User Routes
 * ───────────
 * Module 1: User Management
 * Layer:    Presentation (Route Definitions)
 */

const { Router } = require('express');
const userController = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth');

const router = Router();

// Public routes
router.post('/register', userController.register);
router.post('/login', userController.login);

// Protected routes
router.get('/me', protect, userController.getMe);
router.get('/doctors', protect, userController.getDoctors);
router.get('/', protect, authorize('Admin'), userController.listUsers);
router.post('/', protect, authorize('Admin'), userController.createUser);

module.exports = router;

