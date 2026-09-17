/**
 * Walk-In Controller
 * ──────────────────
 * Presentation layer for Walk-in Queue
 */

const walkInService = require('../services/walkIn.service');

/**
 * POST /api/walk-ins
 * Staff adds walk-in to holding list.
 */
async function create(req, res, next) {
  try {
    const { name, contactNumber } = req.body;
    if (!name || !contactNumber) {
      return res.status(400).json({
        success: false,
        message: 'Name and contact number are required for walk-in entry',
      });
    }

    const walkIn = await walkInService.addToHoldingList({ name, contactNumber });
    res.status(201).json({ success: true, data: walkIn });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/walk-ins
 * Staff lists today's walk-ins or current holding list.
 */
async function list(req, res, next) {
  try {
    const { view } = req.query;
    let walkIns;
    if (view === 'holding') {
      walkIns = await walkInService.getHoldingList();
    } else {
      walkIns = await walkInService.getTodayWalkIns();
    }
    res.json({ success: true, data: walkIns });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/walk-ins/now-serving
 * Public, unauthenticated endpoint for real-time waiting room display!
 */
async function getNowServing(req, res, next) {
  try {
    const data = await walkInService.getNowServing();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function assignSlot(req, res, next) {
  try {
    const { slotId } = req.body;
    if (!slotId) return res.status(400).json({ success: false, message: 'Slot ID is required' });
    const walkIn = await walkInService.assignSlotToWalkIn(req.params.id, slotId, req.user._id);
    res.json({ success: true, data: walkIn });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getNowServing, assignSlot };
