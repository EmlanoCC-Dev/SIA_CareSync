/**
 * Walk-In Routes
 * ──────────────
 */

const { Router } = require('express');
const walkInController = require('../controllers/walkIn.controller');
const { authorize } = require('../middleware/auth');

const router = Router();

// ★ Public UNAUTHENTICATED endpoint for physical clinic display screen!
router.get('/now-serving', walkInController.getNowServing);

// All other walk-in operations require Staff or Admin
router.post('/', authorize('Staff', 'Admin'), walkInController.create);
router.get('/', authorize('Staff', 'Admin', 'Doctor'), walkInController.list);
router.post('/:id/assign', authorize('Staff', 'Admin'), walkInController.assignSlot);

module.exports = router;
