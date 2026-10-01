const { Router } = require('express');
const { protect, authorize } = require('../middleware/auth');
const { getReport } = require('../services/report.service');

const router = Router();
router.get('/', protect, authorize('Staff', 'Admin', 'Doctor'), async (req, res, next) => {
  try {
    res.json({ success: true, data: await getReport(req.query, req.user) });
  } catch (err) { next(err); }
});
module.exports = router;
