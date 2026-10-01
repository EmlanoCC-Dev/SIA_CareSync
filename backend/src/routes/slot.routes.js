/**
 * Slot Routes
 * ───────────
 */

const { Router } = require('express');
const slotController = require('../controllers/slot.controller');
const { protect, authorize } = require('../middleware/auth');

const router = Router();

// Logged-in users can view slots
router.use(protect);

router.get('/', slotController.getSlots);
router.get('/:id', slotController.getById);

// Staff or Admin can explicitly trigger slot generation
router.post('/generate', authorize('Staff', 'Admin', 'Doctor'), slotController.generate);

router.patch('/:id/status', authorize('Staff', 'Admin', 'Doctor'), slotController.updateStatus);

module.exports = router;
