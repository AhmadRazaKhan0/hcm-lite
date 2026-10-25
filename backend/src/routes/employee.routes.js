import { Router } from 'express';
import { authenticate, allowRoles } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/httpError.js';
import {
  listEmployees, getEmployee, createEmployee, updateEmployee, getMyEmployee
} from '../services/employee.service.js';
import { logAction } from '../utils/audit.js';
import Department from '../models/Department.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/employees/me — employee gets their own profile
router.get('/me', asyncHandler(async (req, res) => {
  const employee = await getMyEmployee({ userId: req.user._id, companyId: req.user.company });
  res.json(employee);
}));

// GET /api/employees — list (admin/hr only)
router.get('/', allowRoles('admin', 'hr'), asyncHandler(async (req, res) => {
  const result = await listEmployees({
    companyId: req.user.company,
    query: req.query,
    role: req.user.role,
  });
  res.json(result);
}));

// POST /api/employees — create (admin/hr)
router.post('/', allowRoles('admin', 'hr'), asyncHandler(async (req, res) => {
  // HR can register employees only; Admin/HR logins are created by Admin
  if (req.user.role === 'hr') req.body.role = 'employee';
  const { employee, user } = await createEmployee({
    body: req.body,
    companyId: req.user.company,
    actorId: req.user._id,
  });
  await logAction({
    company: req.user.company,
    actor: req.user,
    action: 'CREATE_EMPLOYEE',
    targetModel: 'Employee',
    targetId: employee._id,
    targetName: user.name,
    details: { employeeId: employee.employeeId, role: user.role },
    ip: req.ip,
  });
  res.status(201).json({ employee, user });
}));

// GET /api/employees/departments — list departments (admin/hr)
router.get('/departments', allowRoles('admin', 'hr'), asyncHandler(async (req, res) => {
  const depts = await Department.find({ company: req.user.company, isActive: true }).sort('name');
  res.json(depts);
}));

// GET /api/employees/:id — get one (admin/hr/own employee)
router.get('/:id', asyncHandler(async (req, res) => {
  const employee = await getEmployee({
    id: req.params.id,
    companyId: req.user.company,
    requestingUser: req.user,
  });
  res.json(employee);
}));

// PUT /api/employees/:id — update
router.put('/:id', asyncHandler(async (req, res) => {
  const employee = await updateEmployee({
    id: req.params.id,
    body: req.body,
    companyId: req.user.company,
    requestingUser: req.user,
  });
  await logAction({
    company: req.user.company,
    actor: req.user,
    action: 'UPDATE_EMPLOYEE',
    targetModel: 'Employee',
    targetId: employee._id,
    targetName: employee.employeeId,
    ip: req.ip,
  });
  res.json(employee);
}));

export default router;
