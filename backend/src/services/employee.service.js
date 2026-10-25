import bcrypt from 'bcryptjs';
import User, { ROLES } from '../models/User.js';
import Employee from '../models/Employee.js';
import LeaveBalance from '../models/LeaveBalance.js';
import { HttpError } from '../utils/httpError.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(v) { return typeof v === 'string' ? v.trim() : ''; }

/**
 * List employees for a company with optional search, filters, pagination.
 * Salary only returned for admin/hr.
 */
export async function listEmployees({ companyId, query = {}, role }) {
  const {
    search = '',
    department,
    status,
    page = 1,
    limit = 20,
  } = query;

  const filter = { company: companyId };
  if (status) filter.employmentStatus = status;
  if (department) filter.department = department;

  // Build lookup pipeline for name/email search
  const pipeline = [
    { $match: filter },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userInfo',
      },
    },
    { $unwind: '$userInfo' },
    {
      $lookup: {
        from: 'departments',
        localField: 'department',
        foreignField: '_id',
        as: 'departmentInfo',
      },
    },
    { $unwind: { path: '$departmentInfo', preserveNullAndEmptyArrays: true } },
  ];

  if (search) {
    pipeline.push({
      $match: {
        $or: [
          { 'userInfo.name': { $regex: search, $options: 'i' } },
          { 'userInfo.email': { $regex: search, $options: 'i' } },
          { employeeId: { $regex: search, $options: 'i' } },
          { jobTitle: { $regex: search, $options: 'i' } },
        ],
      },
    });
  }

  // Count before pagination
  const countPipeline = [...pipeline, { $count: 'total' }];

  // Add projection — salary only for admin/hr
  const projectFields = {
    employeeId: 1,
    jobTitle: 1,
    phone: 1,
    joiningDate: 1,
    employmentStatus: 1,
    avatarUrl: 1,
    address: 1,
    terminationDate: 1,
    createdAt: 1,
    updatedAt: 1,
    'userInfo._id': 1,
    'userInfo.name': 1,
    'userInfo.email': 1,
    'userInfo.role': 1,
    'userInfo.isActive': 1,
    'departmentInfo._id': 1,
    'departmentInfo.name': 1,
  };
  if (role === 'admin' || role === 'hr') {
    projectFields.basicSalary = 1;
  }

  pipeline.push(
    { $sort: { createdAt: -1 } },
    { $skip: (Number(page) - 1) * Number(limit) },
    { $limit: Number(limit) },
    { $project: projectFields }
  );

  const [employees, countResult] = await Promise.all([
    Employee.aggregate(pipeline),
    Employee.aggregate(countPipeline),
  ]);

  return {
    employees,
    total: countResult[0]?.total || 0,
    page: Number(page),
    pages: Math.ceil((countResult[0]?.total || 0) / Number(limit)),
  };
}

/**
 * Get a single employee by Mongo _id. Enforces company scoping.
 * Employees can only get their own record.
 */
export async function getEmployee({ id, companyId, requestingUser }) {
  const employee = await Employee.findOne({ _id: id, company: companyId })
    .populate('user', 'name email role isActive')
    .populate('department', 'name')
    .populate('reportingManager', 'employeeId jobTitle')
    .select(
      requestingUser.role === 'admin' || requestingUser.role === 'hr'
        ? '+basicSalary'
        : ''
    );

  if (!employee) throw new HttpError(404, 'Employee not found');

  // Employees may only see their own record
  if (requestingUser.role === 'employee') {
    const own = await Employee.findOne({ user: requestingUser._id, company: companyId });
    if (!own || own._id.toString() !== employee._id.toString()) {
      throw new HttpError(403, 'Access denied');
    }
  }

  return employee;
}

/**
 * Create a new employee + their User account.
 */
export async function createEmployee({ body, companyId, actorId }) {
  const name = str(body.name);
  const email = str(body.email).toLowerCase();
  const jobTitle = str(body.jobTitle);
  const phone = str(body.phone);
  const address = str(body.address);
  const employeeId = str(body.employeeId);
  const role = body.role || 'employee';
  const basicSalary = Number(body.basicSalary) || 0;
  const joiningDate = body.joiningDate ? new Date(body.joiningDate) : new Date();
  const department = body.department || null;
  const reportingManager = body.reportingManager || null;
  const tempPassword = body.tempPassword || 'Welcome@123';

  // Validation
  const errors = [];
  if (!name) errors.push({ field: 'name', reason: 'Name is required' });
  if (!EMAIL_RE.test(email)) errors.push({ field: 'email', reason: 'Valid email required' });
  if (!employeeId) errors.push({ field: 'employeeId', reason: 'Employee ID is required' });
  if (!ROLES.includes(role)) errors.push({ field: 'role', reason: 'Invalid role' });
  if (basicSalary < 0 || (role === 'employee' && basicSalary <= 0)) errors.push({ field: 'basicSalary', reason: 'Salary must be greater than 0' });
  if (errors.length) throw new HttpError(422, 'Validation failed', errors);

  // Check uniqueness
  const [existingEmail, existingId] = await Promise.all([
    User.findOne({ email }),
    Employee.findOne({ company: companyId, employeeId }),
  ]);
  if (existingEmail) throw new HttpError(409, 'Email already in use');
  if (existingId) throw new HttpError(409, 'Employee ID already exists');

  // Create User account
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const user = await User.create({
    company: companyId,
    name,
    email,
    passwordHash,
    role,
    mustChangePassword: true,
  });

  // Create Employee profile
  const employee = await Employee.create({
    user: user._id,
    company: companyId,
    employeeId,
    department: department || undefined,
    jobTitle,
    phone,
    address,
    joiningDate,
    basicSalary,
    reportingManager: reportingManager || undefined,
  });

  // Initialize leave balance for current year
  const year = new Date().getFullYear();
  await LeaveBalance.create({
    employee: employee._id,
    company: companyId,
    year,
  });

  return { employee, user };
}

/**
 * Update an employee. HR/Admin can update most fields; employee can only update limited fields.
 */
export async function updateEmployee({ id, body, companyId, requestingUser }) {
  const employee = await Employee.findOne({ _id: id, company: companyId });
  if (!employee) throw new HttpError(404, 'Employee not found');

  // Employees can only update their own profile with limited fields
  if (requestingUser.role === 'employee') {
    const own = await Employee.findOne({ user: requestingUser._id, company: companyId });
    if (!own || own._id.toString() !== employee._id.toString()) {
      throw new HttpError(403, 'Access denied');
    }
    // Only these fields are self-editable
    if (body.phone !== undefined) employee.phone = str(body.phone);
    if (body.address !== undefined) employee.address = str(body.address);
    if (body.avatarUrl !== undefined) employee.avatarUrl = str(body.avatarUrl);
    if (body.emergencyContact !== undefined) employee.emergencyContact = body.emergencyContact;
    await employee.save();
    return employee;
  }

  // HR / Admin can update these fields
  if (body.jobTitle !== undefined) employee.jobTitle = str(body.jobTitle);
  if (body.phone !== undefined) employee.phone = str(body.phone);
  if (body.address !== undefined) employee.address = str(body.address);
  if (body.department !== undefined) employee.department = body.department || null;
  if (body.reportingManager !== undefined) employee.reportingManager = body.reportingManager || null;
  if (body.employmentStatus !== undefined) employee.employmentStatus = body.employmentStatus;
  if (body.basicSalary !== undefined) employee.basicSalary = Number(body.basicSalary);
  if (body.joiningDate !== undefined) employee.joiningDate = new Date(body.joiningDate);
  if (body.avatarUrl !== undefined) employee.avatarUrl = str(body.avatarUrl);
  if (body.emergencyContact !== undefined) employee.emergencyContact = body.emergencyContact;

  if (body.employmentStatus === 'terminated') {
    employee.terminationDate = body.terminationDate ? new Date(body.terminationDate) : new Date();
    employee.terminationReason = str(body.terminationReason);
    // Deactivate user account on termination
    await User.findByIdAndUpdate(employee.user, { isActive: false });
  }

  await employee.save();

  // Update name/email on User if admin provides them
  if (requestingUser.role === 'admin') {
    const userUpdates = {};
    if (body.name) userUpdates.name = str(body.name);
    if (body.role && ROLES.includes(body.role)) userUpdates.role = body.role;
    if (Object.keys(userUpdates).length) {
      await User.findByIdAndUpdate(employee.user, userUpdates);
    }
  }

  return employee;
}

/**
 * Get employee record for the currently logged-in employee user.
 */
export async function getMyEmployee({ userId, companyId }) {
  const employee = await Employee.findOne({ user: userId, company: companyId })
    .populate('user', 'name email role')
    .populate('department', 'name')
    .populate('reportingManager', 'employeeId jobTitle');
  if (!employee) throw new HttpError(404, 'Employee profile not found');
  return employee;
}
