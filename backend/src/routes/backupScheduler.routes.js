const { Router } = require('express');
const { timingSafeEqual } = require('node:crypto');
const env = require('../config/env');
const Backup = require('../models/DatabaseBackup');
const { startBackup, getScheduledBackupStatus } = require('../services/databaseBackup.service');
const router = Router();

router.use((req, res, next) => {
  if (env.BACKUP_SCHEDULER_TOKEN.length < 32) return res.status(503).json({ success: false, message: 'The backup scheduler is not configured.' });
  const provided = Buffer.from(req.get('X-Backup-Token') || '');
  const expected = Buffer.from(env.BACKUP_SCHEDULER_TOKEN);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return res.status(401).json({ success: false, message: 'Backup scheduler authentication failed.' });
  res.set('Cache-Control', 'no-store');
  next();
});
router.get('/', async (_req, res, next) => {
  try { res.json({ success: true, data: await getScheduledBackupStatus() }); }
  catch (error) { next(error); }
});
router.post('/', async (_req, res, next) => {
  try { res.status(202).json({ success: true, data: await startBackup('scheduled') }); }
  catch (error) { next(error); }
});
router.get('/:id', async (req, res, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid backup identifier.' });
    const run = await Backup.findOne({ _id: req.params.id, trigger: 'scheduled' }).select('status message').lean();
    if (!run) return res.status(404).json({ success: false, message: 'Scheduled backup not found.' });
    res.json({ success: true, data: run });
  } catch (error) { next(error); }
});
module.exports = router;
