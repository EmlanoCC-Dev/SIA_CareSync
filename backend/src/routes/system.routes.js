/**
 * System Time & Settings Routes
 * ─────────────────────────────
 */

const { Router } = require('express');
const { setCustomTime, getOperatingStatus } = require('../config/systemTime');
const { autoMarkNoShows } = require('../services/appointment.service');
const { authorize } = require('../middleware/auth');
const { parseDateOnly } = require('../utils/timeHelper');
const { clearDemoData } = require('../services/demoReset.service');

const router = Router();

/**
 * GET /api/system/time
 * Returns current system time and clinic open/closed status.
 */
router.get('/time', async (_req, res) => {
  res.json({
    success: true,
    data: getOperatingStatus(),
  });
});

/**
 * POST /api/system/time
 * Set custom time or reset to actual clock.
 * Body: { time: "2026-09-08T08:30:00" } or { reset: true }
 */
router.post('/time', authorize('Admin'), async (req, res, next) => {
  try {
    const { time, reset } = req.body || {};
    const validReset = reset === true && time === undefined;
    const validTime = reset === undefined && typeof time === 'string' &&
      /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,3})?)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)?$/.test(time) &&
      Number.isFinite(new Date(time).getTime());
    if (!validReset && !validTime) {
      throw Object.assign(new Error('Provide a valid ISO date/time or { reset: true }'), { statusCode: 400 });
    }
    if (validTime) parseDateOnly(time.slice(0, 10));
    setCustomTime(validReset ? null : time);
    await autoMarkNoShows();
    res.json({ success: true,
      message: validReset ? 'Reset to actual real-time clock' : 'Custom system time updated',
      data: getOperatingStatus() });
  } catch (err) { next(err); }
});

router.post('/demo-reset', authorize('Admin'), async (req, res, next) => {
  try {
    if (req.body?.confirmation !== 'CLEAR DEMO DATA') {
      throw Object.assign(new Error('Type CLEAR DEMO DATA to confirm the reset'), { statusCode: 400 });
    }
    const data = await clearDemoData(req.user._id);
    res.json({ success: true, message: 'Demo data cleared. Doctor, staff, and your admin account were kept.', data });
  } catch (err) { next(err); }
});

module.exports = router;
