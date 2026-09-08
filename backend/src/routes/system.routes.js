/**
 * System Time & Settings Routes
 * ─────────────────────────────
 */

const { Router } = require('express');
const { getNow, setCustomTime, isClinicOpen, getOperatingStatus } = require('../config/systemTime');
const { autoMarkNoShows } = require('../services/appointment.service');

const router = Router();

/**
 * GET /api/system/time
 * Returns current system time and clinic open/closed status.
 */
router.get('/time', async (_req, res) => {
  await autoMarkNoShows();
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
router.post('/time', async (req, res) => {
  const { time, reset } = req.body;
  if (reset) {
    setCustomTime(null);
  } else if (time) {
    setCustomTime(time);
  }

  await autoMarkNoShows();

  res.json({
    success: true,
    message: reset ? 'Reset to actual real-time clock' : 'Custom system time updated',
    data: getOperatingStatus(),
  });
});

module.exports = router;
