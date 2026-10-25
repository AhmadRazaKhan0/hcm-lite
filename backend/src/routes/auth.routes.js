import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { login } from '../services/auth.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { asyncHandler, HttpError } from '../utils/httpError.js';
import User from '../models/User.js';
import { logAction } from '../utils/audit.js';

const router = Router();

// POST /api/auth/login  { email, password } -> { token, user }
router.post('/login', asyncHandler(async (req, res) => {
  const { token, user } = await login(req.body);
  res.json({ token, user: user.toJSON() });
}));

// GET /api/auth/me -> current user (fresh from DB)
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json(user.toJSON());
}));

// POST /api/auth/change-password { currentPassword, newPassword }
router.post('/change-password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 8)
    throw new HttpError(422, 'New password must be at least 8 characters');
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(currentPassword || '', user.passwordHash)))
    throw new HttpError(401, 'Current password is incorrect');
  if (currentPassword === newPassword)
    throw new HttpError(422, 'New password must be different');
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  await user.save();
  await logAction({ company: req.user.company, actor: req.user, action: 'CHANGE_PASSWORD',
    targetModel: 'User', targetId: user._id, targetName: user.email, ip: req.ip });
  res.json({ message: 'Password changed', user: user.toJSON() });
}));

export default router;
