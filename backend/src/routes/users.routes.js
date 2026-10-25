import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authenticate, allowRoles } from '../middleware/auth.middleware.js';
import { asyncHandler, HttpError } from '../utils/httpError.js';
import User, { ROLES } from '../models/User.js';
import { logAction } from '../utils/audit.js';

const router = Router();
router.use(authenticate);
router.use(allowRoles('admin'));

// GET /api/users — list all users in the company
router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, role } = req.query;
  const filter = { company: req.user.company };
  if (role && ROLES.includes(role)) filter.role = role;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    User.countDocuments(filter),
  ]);

  res.json({ users, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
}));

// PUT /api/users/:id — update user (role, isActive, name)
router.put('/:id', asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, company: req.user.company });
  if (!user) throw new HttpError(404, 'User not found');

  if (req.body.role && ROLES.includes(req.body.role)) {
    user.role = req.body.role;
  }
  if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
  if (req.body.name) user.name = req.body.name.trim();

  await user.save();

  await logAction({
    company: req.user.company,
    actor: req.user,
    action: 'UPDATE_USER',
    targetModel: 'User',
    targetId: user._id,
    targetName: user.email,
    details: { role: user.role, isActive: user.isActive },
    ip: req.ip,
  });

  res.json(user);
}));

// POST /api/users/:id/reset-password — admin resets user password
router.post('/:id/reset-password', asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    throw new HttpError(422, 'New password must be at least 8 characters');
  }

  const user = await User.findOne({ _id: req.params.id, company: req.user.company });
  if (!user) throw new HttpError(404, 'User not found');

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = true;
  await user.save();

  await logAction({
    company: req.user.company,
    actor: req.user,
    action: 'RESET_PASSWORD',
    targetModel: 'User',
    targetId: user._id,
    targetName: user.email,
    ip: req.ip,
  });

  res.json({ message: 'Password reset. User must change on next login.' });
}));

export default router;
