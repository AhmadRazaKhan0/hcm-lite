import { Router } from 'express';
import { authenticate, allowRoles } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/httpError.js';
import AuditLog from '../models/AuditLog.js';

const router = Router();
router.use(authenticate);
router.use(allowRoles('admin'));

// GET /api/audit — paginated audit log (admin only)
router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, action, actorId } = req.query;
  const filter = { company: req.user.company };
  if (action) filter.action = { $regex: action, $options: 'i' };
  if (actorId) filter.actor = actorId;

  const skip = (Number(page) - 1) * Number(limit);

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    AuditLog.countDocuments(filter),
  ]);

  res.json({ logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
}));

export default router;
