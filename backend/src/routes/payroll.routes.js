import { Router } from 'express';
import { authenticate, allowRoles } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/httpError.js';
import {
  generateMonthlyPayroll, listPayroll, getMyPayroll, finalizePayroll, getPayslip
} from '../services/payroll.service.js';
import { logAction } from '../utils/audit.js';
import { notify } from '../utils/notify.js';
import Employee from '../models/Employee.js';

const router = Router();
router.use(authenticate);

// GET /api/payroll/mine — employee sees own finalized payslips
router.get('/mine', allowRoles('employee'), asyncHandler(async (req, res) => {
  const records = await getMyPayroll({
    userId: req.user._id,
    companyId: req.user.company,
    query: req.query,
  });
  res.json(records);
}));

// POST /api/payroll/generate — HR/Admin generates payroll
router.post('/generate', allowRoles('admin', 'hr'), asyncHandler(async (req, res) => {
  const { month, year } = req.body;
  const result = await generateMonthlyPayroll({
    companyId: req.user.company,
    month: Number(month),
    year: Number(year),
    generatedBy: req.user._id,
  });
  await logAction({
    company: req.user.company,
    actor: req.user,
    action: 'GENERATE_PAYROLL',
    details: { month, year, processed: result.processed },
    ip: req.ip,
  });
  res.status(201).json(result);
}));

// GET /api/payroll — list all (admin/hr)
router.get('/', allowRoles('admin', 'hr'), asyncHandler(async (req, res) => {
  const result = await listPayroll({
    companyId: req.user.company,
    query: req.query,
    role: req.user.role,
  });
  res.json(result);
}));

// PUT /api/payroll/:id/finalize — Admin finalizes (prevents modification)
router.put('/:id/finalize', allowRoles('admin'), asyncHandler(async (req, res) => {
  const payroll = await finalizePayroll({
    payrollId: req.params.id,
    companyId: req.user.company,
    finalizedBy: req.user._id,
  });
  await logAction({
    company: req.user.company,
    actor: req.user,
    action: 'FINALIZE_PAYROLL',
    targetModel: 'Payroll',
    targetId: payroll._id,
    ip: req.ip,
  });
  const emp = await Employee.findById(payroll.employee);
  if (emp) await notify({ company: req.user.company, user: emp.user, title: 'Payslip available', message: `Your payslip for ${payroll.month}/${payroll.year} is ready.`, link: '/payroll' });
  res.json(payroll);
}));

// GET /api/payroll/:id — get single payslip
router.get('/:id', asyncHandler(async (req, res) => {
  const payroll = await getPayslip({
    payrollId: req.params.id,
    companyId: req.user.company,
    requestingUser: req.user,
  });
  res.json(payroll);
}));

export default router;
