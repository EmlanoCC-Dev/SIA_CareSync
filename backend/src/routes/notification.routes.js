const { Router } = require('express');
const Notification = require('../models/Notification');
const router = Router();

// Authentication is enforced by the API router. Even Admin sees only their own inbox.
router.get('/', async (req, res, next) => {
  try {
    const { page = '1', unread = 'false' } = req.query;
    if (Object.keys(req.query).some(key => !['page', 'unread'].includes(key)) ||
        !/^[1-9]\d{0,3}$/.test(page) || !['true', 'false'].includes(unread)) {
      return res.status(400).json({ success: false, message: 'Use page 1–9999 and unread true or false' });
    }
    const owner = { user: req.user._id };
    const filter = { ...owner, ...(unread === 'true' ? { readAt: null } : {}) };
    const pageSize = 20;
    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip((Number(page) - 1) * pageSize).limit(pageSize).lean(),
      Notification.countDocuments(filter), Notification.countDocuments({ ...owner, readAt: null }),
    ]);
    res.json({ success: true, data: { items, total, unreadCount, page: Number(page), pageSize } });
  } catch (err) { next(err); }
});

router.patch('/read-all', async (req, res, next) => {
  try {
    const result = await Notification.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
    res.json({ success: true, data: { modifiedCount: result.modifiedCount } });
  } catch (err) { next(err); }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID' });
    }
    // Pipeline preserves the first read timestamp on repeated requests.
    const item = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id },
      [{ $set: { readAt: { $ifNull: ['$readAt', new Date()] } } }], { new: true });
    if (!item) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

module.exports = router;
