import { Router } from 'express';
import { authenticate, allowRoles } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/httpError.js';
import {
  applyLeave, listLeaveRequests, reviewLeave, cancelLeave, getLeaveBalance
} from '../services/leave.service.js';
import { logAction } from '../utils/audit.js';
import { notify } from '../utils/notify.js';
import Employee from '../models/Employee.js';

const router = Router();
router.use(authenticate);

// GET /api/leave/balance — own balance (employee) or any (admin/hr with ?employeeId=)
router.get('/balance', asyncHandler(async (req, res) => {
  const balance = await getLeaveBalance({
    userId: req.user._id,
    companyId: req.user.company,
    employeeId: req.query.employeeId,
    role: req.user.role,
  });
  res.json(balance);
}));

// GET /api/leave — list requests
router.get('/', asyncHandler(async (req, res) => {
  const result = await listLeaveRequests({
    userId: req.user._id,
    companyId: req.user.company,
    role: req.user.role,
    query: req.query,
  });
  res.json(result);
}));

// POST /api/leave — apply for leave (employee)
router.post('/', allowRoles('employee'), asyncHandler(async (req, res) => {
  const request = await applyLeave({
    userId: req.user._id,
    companyId: req.user.company,
    body: req.body,
  });
  res.status(201).json(request);
}));

// PUT /api/leave/:id/review — approve/reject (hr/admin)
router.put('/:id/review', allowRoles('admin', 'hr'), asyncHandler(async (req, res) => {
  const request = await reviewLeave({
    requestId: req.params.id,
    companyId: req.user.company,
    reviewerId: req.user._id,
    body: req.body,
  });
  await logAction({
    company: req.user.company,
    actor: req.user,
    action: `LEAVE_${req.body.decision?.toUpperCase()}`,
    targetModel: 'LeaveRequest',
    targetId: request._id,
    targetName: `${request.leaveType} leave (${request.days} days)`,
    ip: req.ip,
  });
  const emp = await Employee.findById(request.employee);
  if (emp) await notify({ company: req.user.company, user: emp.user, title: `Leave ${request.status}`, message: `Your ${request.leaveType} leave (${request.days} day(s)) was ${request.status}.${request.reviewNote ? ' Note: ' + request.reviewNote : ''}`, link: '/leave' });
  res.json(request);
}));

// DELETE /api/leave/:id — employee cancels own pending request
router.delete('/:id', allowRoles('employee'), asyncHandler(async (req, res) => {
  const request = await cancelLeave({
    requestId: req.params.id,
    userId: req.user._id,
    companyId: req.user.company,
  });
  res.json(request);
}));

export default router;
