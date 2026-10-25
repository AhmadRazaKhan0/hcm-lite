import LeaveRequest from '../models/LeaveRequest.js';
import LeaveBalance from '../models/LeaveBalance.js';
import Employee from '../models/Employee.js';
import { HttpError } from '../utils/httpError.js';
import { workingDaysBetween } from '../utils/dateGeo.js';

/**
 * Apply for leave. Validates balance, checks for overlaps, calculates working days.
 */
export async function applyLeave({ userId, companyId, body }) {
  const employee = await Employee.findOne({ user: userId, company: companyId });
  if (!employee) throw new HttpError(404, 'Employee profile not found');

  const { leaveType, startDate, endDate, reason, emergencyContact } = body;

  const errors = [];
  if (!leaveType) errors.push({ field: 'leaveType', reason: 'Leave type is required' });
  if (!startDate) errors.push({ field: 'startDate', reason: 'Start date is required' });
  if (!endDate) errors.push({ field: 'endDate', reason: 'End date is required' });
  if (!reason) errors.push({ field: 'reason', reason: 'Reason is required' });
  if (errors.length) throw new HttpError(422, 'Validation failed', errors);

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start) || isNaN(end)) throw new HttpError(400, 'Invalid date format');
  if (end < start) throw new HttpError(400, 'End date must be on or after start date');
  if (start < new Date(new Date().setHours(0, 0, 0, 0))) {
    throw new HttpError(400, 'Cannot apply leave for past dates');
  }

  const days = workingDaysBetween(start, end);
  if (days === 0) throw new HttpError(400, 'Selected dates have no working days');

  // Check for overlapping pending/approved leave requests
  const overlap = await LeaveRequest.findOne({
    employee: employee._id,
    status: { $in: ['pending', 'approved'] },
    $or: [
      { startDate: { $lte: end }, endDate: { $gte: start } },
    ],
  });
  if (overlap) throw new HttpError(422, 'You already have an overlapping leave request for these dates');

  // Check balance (unpaid leaves don't have a hard cap)
  if (leaveType !== 'unpaid') {
    const year = start.getFullYear();
    const balance = await LeaveBalance.findOne({ employee: employee._id, year });
    if (balance) {
      const typeBalance = balance[leaveType];
      if (typeBalance) {
        const remaining = typeBalance.total - typeBalance.used;
        if (days > remaining) {
          throw new HttpError(422, `Insufficient ${leaveType} leave balance. Remaining: ${remaining} day(s), Requested: ${days}`);
        }
      }
    }
  }

  const request = await LeaveRequest.create({
    employee: employee._id,
    company: companyId,
    leaveType,
    startDate: start,
    endDate: end,
    reason,
    days,
    emergencyContact: emergencyContact || '',
    status: 'pending',
  });

  return request;
}

/**
 * List leave requests. Admin/HR see all; employee sees own.
 */
export async function listLeaveRequests({ userId, companyId, role, query = {} }) {
  const { status, employeeId, page = 1, limit = 20, month, year } = query;

  const filter = { company: companyId };
  if (status) filter.status = status;
  if (month && year) {
    const start = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
    const end = new Date(Date.UTC(Number(year), Number(month), 0));
    filter.startDate = { $gte: start };
    filter.endDate = { $lte: end };
  }

  if (role === 'employee') {
    // Employees only see their own
    const employee = await Employee.findOne({ user: userId, company: companyId });
    if (!employee) throw new HttpError(404, 'Employee profile not found');
    filter.employee = employee._id;
  } else if (employeeId) {
    filter.employee = employeeId;
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [requests, total] = await Promise.all([
    LeaveRequest.find(filter)
      .populate({ path: 'employee', select: 'employeeId jobTitle', populate: { path: 'user', select: 'name email' } })
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    LeaveRequest.countDocuments(filter),
  ]);

  return { requests, total, page: Number(page), pages: Math.ceil(total / Number(limit)) };
}

/**
 * HR/Admin: approve or reject a leave request.
 */
export async function reviewLeave({ requestId, companyId, reviewerId, body }) {
  const request = await LeaveRequest.findOne({ _id: requestId, company: companyId });
  if (!request) throw new HttpError(404, 'Leave request not found');
  if (request.status !== 'pending') {
    throw new HttpError(400, `Request is already ${request.status}`);
  }

  const { decision, reviewNote } = body;
  if (!['approved', 'rejected'].includes(decision)) {
    throw new HttpError(400, 'Decision must be approved or rejected');
  }

  request.status = decision;
  request.reviewedBy = reviewerId;
  request.reviewNote = reviewNote || '';
  request.reviewedAt = new Date();
  await request.save();

  // Update leave balance if approved
  if (decision === 'approved') {
    await updateLeaveBalance(request.employee, request.leaveType, request.days, 'add');
  }

  return request;
}

/**
 * Employee: cancel their own pending leave request.
 */
export async function cancelLeave({ requestId, userId, companyId }) {
  const employee = await Employee.findOne({ user: userId, company: companyId });
  if (!employee) throw new HttpError(404, 'Employee profile not found');

  const request = await LeaveRequest.findOne({
    _id: requestId,
    employee: employee._id,
    company: companyId,
  });
  if (!request) throw new HttpError(404, 'Leave request not found');
  if (request.status !== 'pending') {
    throw new HttpError(400, 'Only pending requests can be cancelled');
  }

  request.status = 'cancelled';
  await request.save();
  return request;
}

/**
 * Get leave balance for an employee.
 */
export async function getLeaveBalance({ userId, companyId, employeeId, role }) {
  let empId = employeeId;

  if (role === 'employee' || !empId) {
    const employee = await Employee.findOne({ user: userId, company: companyId });
    if (!employee) throw new HttpError(404, 'Employee profile not found');
    empId = employee._id;
  }

  const year = new Date().getFullYear();
  let balance = await LeaveBalance.findOne({ employee: empId, year });
  if (!balance) {
    // Auto-create if missing
    const emp = await Employee.findById(empId);
    balance = await LeaveBalance.create({ employee: empId, company: emp.company, year });
  }
  return balance;
}

/**
 * Internal: add or subtract from leave balance.
 */
async function updateLeaveBalance(employeeId, leaveType, days, operation) {
  const year = new Date().getFullYear();
  const balance = await LeaveBalance.findOne({ employee: employeeId, year });
  if (!balance || leaveType === 'unpaid' || leaveType === 'other') return;

  const increment = operation === 'add' ? days : -days;
  await LeaveBalance.updateOne(
    { employee: employeeId, year },
    { $inc: { [`${leaveType}.used`]: increment } }
  );
}
