import Payroll from '../models/Payroll.js';
import Employee from '../models/Employee.js';
import { HttpError } from '../utils/httpError.js';
import { getMonthlyStats } from './attendance.service.js';
import { workingDaysInMonth } from '../utils/dateGeo.js';
import LeaveRequest from '../models/LeaveRequest.js';

// ──────────────────────────────────────────────────────────────────────────────
// Salary formula constants (PKR, illustrative demo values)
// HRA = 40% of basic salary
// Medical = 10% of basic salary
// Gross = basic + hra + medical
// Per-day = gross / working days in month
// ──────────────────────────────────────────────────────────────────────────────
const HRA_RATE = 0.40;
const MEDICAL_RATE = 0.10;

/**
 * Calculate annual income tax on gross annual salary using PKR illustrative brackets.
 * Label: DEMO / ILLUSTRATIVE — not official Pakistani tax advice.
 * 
 * Brackets (annual):
 *  Up to 600,000: 0%
 *  600,001 – 1,200,000: 5% of amount above 600,000
 *  1,200,001 – 2,400,000: 30,000 + 15% above 1,200,000
 *  2,400,001 – 3,600,000: 210,000 + 25% above 2,400,000
 *  Above 3,600,000: 510,000 + 35% above 3,600,000
 */
export function calculateAnnualTax(annualGross) {
  if (annualGross <= 600000) return 0;
  if (annualGross <= 1200000) return (annualGross - 600000) * 0.05;
  if (annualGross <= 2400000) return 30000 + (annualGross - 1200000) * 0.15;
  if (annualGross <= 3600000) return 210000 + (annualGross - 2400000) * 0.25;
  return 510000 + (annualGross - 3600000) * 0.35;
}

/**
 * Calculate monthly payroll for a single employee.
 */
export async function calculatePayroll({ employee, month, year, generatedBy, companyId }) {
  const basicSalary = employee.basicSalary || 0;
  const hra = Math.round(basicSalary * HRA_RATE);
  const medical = Math.round(basicSalary * MEDICAL_RATE);
  const grossSalary = basicSalary + hra + medical;

  const workingDays = workingDaysInMonth(year, month);
  const perDaySalary = workingDays > 0 ? grossSalary / workingDays : 0;

  // Get attendance stats for the month
  const stats = await getMonthlyStats({ employeeId: employee._id, month, year });

  // Count unpaid leave days taken in this month
  const leaveStart = new Date(Date.UTC(year, month - 1, 1));
  const leaveEnd = new Date(Date.UTC(year, month, 0));
  const unpaidLeaves = await LeaveRequest.find({
    employee: employee._id,
    status: 'approved',
    leaveType: 'unpaid',
    startDate: { $gte: leaveStart },
    endDate: { $lte: leaveEnd },
  });
  const unpaidLeaveDays = unpaidLeaves.reduce((sum, r) => sum + r.days, 0);

  // Deductions
  // Absent days include unpaid leave days
  const absentDeduction = Math.round(stats.absent * perDaySalary);
  const halfDayDeduction = Math.round(stats.halfDay * perDaySalary * 0.5);
  const unpaidLeaveDeduction = Math.round(unpaidLeaveDays * perDaySalary);
  // Late: deduct 30 min of salary per late arrival (illustrative)
  const lateDeductions = Math.round(stats.late * (perDaySalary / 8 * 0.5));

  const totalDeductions = absentDeduction + halfDayDeduction + unpaidLeaveDeduction + lateDeductions;

  const annualGross = grossSalary * 12;
  const annualTax = calculateAnnualTax(annualGross);
  const monthlyTax = Math.round(annualTax / 12);

  const netSalary = Math.max(0, grossSalary - totalDeductions - monthlyTax);

  return {
    employee: employee._id,
    company: companyId,
    month,
    year,
    basicSalary,
    hra,
    medical,
    otherAllowances: 0,
    grossSalary,
    absentDays: stats.absent,
    lateDeductions,
    unpaidLeaveDays,
    halfDays: stats.halfDay,
    totalDeductions,
    annualTax: Math.round(annualTax),
    monthlyTax,
    netSalary,
    workingDaysInMonth: workingDays,
    perDaySalary: Math.round(perDaySalary),
    status: 'draft',
    generatedBy,
  };
}

/**
 * Generate payroll for all active employees in a company for a given month/year.
 * Skips employees who already have a payroll for that period.
 */
export async function generateMonthlyPayroll({ companyId, month, year, generatedBy }) {
  if (!month || !year) throw new HttpError(400, 'Month and year are required');
  if (month < 1 || month > 12) throw new HttpError(400, 'Invalid month');

  // Get active employees with salary
  const employees = await Employee.find({
    company: companyId,
    employmentStatus: 'active',
  }).select('+basicSalary');

  if (!employees.length) throw new HttpError(404, 'No active employees found');

  const results = [];
  const errors = [];

  for (const emp of employees) {
    try {
      // Skip if already generated
      const existing = await Payroll.findOne({ employee: emp._id, month, year });
      if (existing) {
        results.push({ employeeId: emp.employeeId, status: 'skipped', reason: 'Already generated' });
        continue;
      }

      const payrollData = await calculatePayroll({
        employee: emp,
        month,
        year,
        generatedBy,
        companyId,
      });
      const payroll = await Payroll.create(payrollData);
      results.push({ employeeId: emp.employeeId, status: 'created', payrollId: payroll._id });
    } catch (err) {
      errors.push({ employeeId: emp.employeeId, error: err.message });
    }
  }

  return { month, year, processed: results.length, results, errors };
}

/**
 * Get payroll list for admin/HR with filters.
 */
export async function listPayroll({ companyId, query, role }) {
  const { month, year, status, employeeId, page = 1, limit = 20 } = query;

  const filter = { company: companyId };
  if (month) filter.month = Number(month);
  if (year) filter.year = Number(year);
  if (status) filter.status = status;
  if (employeeId) filter.employee = employeeId;

  const skip = (Number(page) - 1) * Number(limit);

  const [records, total] = await Promise.all([
    Payroll.find(filter)
      .populate({ path: 'employee', select: 'employeeId jobTitle', populate: { path: 'user', select: 'name email' } })
      .populate('generatedBy', 'name')
      .populate('finalizedBy', 'name')
      .sort({ year: -1, month: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Payroll.countDocuments(filter),
  ]);

  return { records, total, page: Number(page), pages: Math.ceil(total / Number(limit)) };
}

/**
 * Get employee's own payroll records.
 */
export async function getMyPayroll({ userId, companyId, query }) {
  const employee = await Employee.findOne({ user: userId, company: companyId });
  if (!employee) throw new HttpError(404, 'Employee profile not found');

  const filter = { company: companyId, employee: employee._id, status: 'finalized' };
  if (query.year) filter.year = Number(query.year);

  const records = await Payroll.find(filter)
    .sort({ year: -1, month: -1 })
    .populate('generatedBy', 'name');

  return records;
}

/**
 * Finalize a payroll record (Admin only). Prevents further modification.
 */
export async function finalizePayroll({ payrollId, companyId, finalizedBy }) {
  const payroll = await Payroll.findOne({ _id: payrollId, company: companyId });
  if (!payroll) throw new HttpError(404, 'Payroll record not found');
  if (payroll.status === 'finalized') {
    throw new HttpError(400, 'Payroll is already finalized');
  }

  payroll.status = 'finalized';
  payroll.finalizedBy = finalizedBy;
  payroll.finalizedAt = new Date();
  await payroll.save();
  return payroll;
}

/**
 * Get a single payroll/payslip by ID.
 */
export async function getPayslip({ payrollId, companyId, requestingUser }) {
  const payroll = await Payroll.findOne({ _id: payrollId, company: companyId })
    .populate({ path: 'employee', select: 'employeeId jobTitle', populate: { path: 'user', select: 'name email' } })
    .populate('generatedBy', 'name')
    .populate('finalizedBy', 'name');

  if (!payroll) throw new HttpError(404, 'Payslip not found');

  // Employee can only see their own finalized payslips
  if (requestingUser.role === 'employee') {
    const emp = await Employee.findOne({ user: requestingUser._id });
    if (!emp || payroll.employee._id.toString() !== emp._id.toString()) {
      throw new HttpError(403, 'Access denied');
    }
    if (payroll.status !== 'finalized') throw new HttpError(403, 'Payslip not yet available');
  }

  return payroll;
}
