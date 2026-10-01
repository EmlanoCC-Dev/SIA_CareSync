const { Router } = require('express');
const { authorize } = require('../middleware/auth');
const { getReport } = require('../services/report.service');

const router = Router();
router.get('/', authorize('Staff', 'Admin', 'Doctor'), async (req, res, next) => {
  try {
    res.json({ success: true, data: await getReport(req.query, req.user) });
  } catch (err) { next(err); }
});
module.exports = router;
