import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/httpError.js';
import Notification from '../models/Notification.js';
const router = Router();
router.use(authenticate);
router.get('/', asyncHandler(async (req, res) => {
  const items = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30);
  const unread = await Notification.countDocuments({ user: req.user._id, isRead: false });
  res.json({ items, unread });
}));
router.post('/read-all', asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
  res.json({ message: 'ok' });
}));
export default router;
