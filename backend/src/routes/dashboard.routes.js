import { Router } from 'express';
import { authenticate, allowRoles } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/httpError.js';
import { getAdminDashboard, getHRDashboard, getEmployeeDashboard } from '../services/dashboard.service.js';

const router = Router();
router.use(authenticate);

// GET /api/dashboard — returns appropriate dashboard data based on role
router.get('/', asyncHandler(async (req, res) => {
  const { role, company, _id } = req.user;

  if (role === 'admin') {
    const data = await getAdminDashboard(company);
    return res.json({ role: 'admin', ...data });
  }

  if (role === 'hr') {
    const data = await getHRDashboard(company);
    return res.json({ role: 'hr', ...data });
  }

  // Employee
  const data = await getEmployeeDashboard(_id, company);
  return res.json({ role: 'employee', ...data });
}));

// GET /api/dashboard/admin (explicit)
router.get('/admin', allowRoles('admin'), asyncHandler(async (req, res) => {
  const data = await getAdminDashboard(req.user.company);
  res.json(data);
}));

// GET /api/dashboard/hr (explicit)
router.get('/hr', allowRoles('admin', 'hr'), asyncHandler(async (req, res) => {
  const data = await getHRDashboard(req.user.company);
  res.json(data);
}));

export default router;
