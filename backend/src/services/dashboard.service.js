import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Payroll from '../models/Payroll.js';
import Department from '../models/Department.js';
import AuditLog from '../models/AuditLog.js';
import { dayOnly } from '../utils/dateGeo.js';

/**
 * Admin dashboard data: org-wide stats.
 */
export async function getAdminDashboard(companyId) {
  const today = dayOnly(new Date());
  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const thisYear = now.getFullYear();

  const [
    totalEmployees,
    activeEmployees,
    departments,
    pendingLeaves,
    todayAttendance,
    monthPayroll,
    recentAudit,
    deptBreakdown,
  ] = await Promise.all([
    Employee.countDocuments({ company: companyId }),
    Employee.countDocuments({ company: companyId, employmentStatus: 'active' }),
    Department.countDocuments({ company: companyId, isActive: true }),
    LeaveRequest.countDocuments({ company: companyId, status: 'pending' }),
    Attendance.countDocuments({ company: companyId, date: today, status: { $in: ['present', 'late'] } }),
    Payroll.aggregate([
      { $match: { company: companyId, month: thisMonth, year: thisYear } },
      { $group: { _id: null, total: { $sum: '$netSalary' }, count: { $sum: 1 } } },
    ]),
    AuditLog.find({ company: companyId }).sort({ createdAt: -1 }).limit(10).select('actorName actorRole action targetName createdAt'),
    Employee.aggregate([
      { $match: { company: companyId, employmentStatus: 'active' } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
      { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
      { $project: { name: { $ifNull: ['$dept.name', 'Unassigned'] }, count: 1 } },
    ]),
  ]);

  // Late and absent today
  const lateToday = await Attendance.countDocuments({ company: companyId, date: today, status: 'late' });

  return {
    totalEmployees,
    activeEmployees,
    departments,
    pendingLeaves,
    presentToday: todayAttendance,
    lateToday,
    payrollSummary: monthPayroll[0] || { total: 0, count: 0 },
    recentActivity: recentAudit,
    departmentBreakdown: deptBreakdown,
  };
}

/**
 * HR dashboard: attendance-focused stats.
 */
export async function getHRDashboard(companyId) {
  const today = dayOnly(new Date());
  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const thisYear = now.getFullYear();

  const [
    presentToday,
    lateToday,
    pendingLeaves,
    pendingCorrections,
    activeEmployees,
    thisMonthLeaves,
  ] = await Promise.all([
    Attendance.countDocuments({ company: companyId, date: today, status: { $in: ['present', 'late'] } }),
    Attendance.countDocuments({ company: companyId, date: today, status: 'late' }),
    LeaveRequest.countDocuments({ company: companyId, status: 'pending' }),
    Attendance.countDocuments({ company: companyId, 'correctionRequest.status': 'pending' }),
    Employee.countDocuments({ company: companyId, employmentStatus: 'active' }),
    LeaveRequest.countDocuments({
      company: companyId,
      status: 'approved',
      startDate: { $lte: new Date() },
      endDate: { $gte: today },
    }),
  ]);

  // Last 7 days attendance trend
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const present = await Attendance.countDocuments({
      company: companyId,
      date: d,
      status: { $in: ['present', 'late'] },
    });
    last7.push({ date: d.toISOString().slice(0, 10), present });
  }

  // Late arrivals today (with name)
  const lateEmployees = await Attendance.find({ company: companyId, date: today, status: 'late' })
    .populate({ path: 'employee', select: 'employeeId', populate: { path: 'user', select: 'name' } })
    .limit(10)
    .select('clockIn employee');

  return {
    presentToday,
    lateToday,
    pendingLeaves,
    pendingCorrections,
    activeEmployees,
    onLeaveToday: thisMonthLeaves,
    attendanceTrend: last7,
    lateEmployees,
  };
}

/**
 * Employee dashboard: personal stats.
 */
export async function getEmployeeDashboard(userId, companyId) {
  const Employee_ = Employee;
  const employee = await Employee_.findOne({ user: userId, company: companyId });
  if (!employee) return { error: 'Employee profile not found' };

  const today = dayOnly(new Date());
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [
    todayAttendance,
    recentAttendance,
    leaveBalance,
    recentLeaves,
    myPayslips,
  ] = await Promise.all([
    Attendance.findOne({ employee: employee._id, date: today }),
    Attendance.find({ employee: employee._id }).sort({ date: -1 }).limit(7),
    import('../models/LeaveBalance.js').then(m => m.default.findOne({ employee: employee._id, year })),
    LeaveRequest.find({ employee: employee._id }).sort({ createdAt: -1 }).limit(5),
    Payroll.find({ employee: employee._id, status: 'finalized' }).sort({ year: -1, month: -1 }).limit(3),
  ]);

  return {
    todayAttendance,
    recentAttendance,
    leaveBalance,
    recentLeaves,
    myPayslips,
  };
}
