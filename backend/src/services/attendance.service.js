import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import { HttpError } from '../utils/httpError.js';
import { dayOnly, haversineDistance, workingDaysInMonth } from '../utils/dateGeo.js';

// Office config (from env or defaults)
const OFFICE_LAT = parseFloat(process.env.OFFICE_LAT || '24.8607');
const OFFICE_LNG = parseFloat(process.env.OFFICE_LNG || '67.0011');
const GEOFENCE_RADIUS = parseInt(process.env.GEOFENCE_RADIUS_M || '150', 10);

// Attendance policy defaults
const OFFICE_START_HOUR = 9;   // 9:00 AM
const OFFICE_START_MIN = 0;
const GRACE_MINUTES = 15;       // 15-min grace period
const HALF_DAY_HOURS = 5;       // < 5 hours = half day

/**
 * Determine attendance status based on clock-in time and total worked hours.
 * @param {Date} clockIn - server timestamp of clock-in
 * @param {number} workedHours - total hours worked
 * @returns {'present' | 'late' | 'half-day'}
 */
export function computeStatus(clockIn, workedHours) {
  if (workedHours < HALF_DAY_HOURS) return 'half-day';
  // Check lateness: compare clock-in time against office start + grace
  const startOfDay = new Date(clockIn);
  startOfDay.setUTCHours(OFFICE_START_HOUR - 5, OFFICE_START_MIN + GRACE_MINUTES, 0, 0);
  // PKT is UTC+5; office opens at 09:00 PKT = 04:00 UTC + grace = 04:15 UTC
  const officeOpenUTC = new Date(clockIn);
  officeOpenUTC.setUTCHours(OFFICE_START_HOUR - 5, OFFICE_START_MIN + GRACE_MINUTES, 0, 0);
  if (clockIn > officeOpenUTC) return 'late';
  return 'present';
}

/**
 * Clock in an employee. Creates today's attendance record.
 */
export async function clockIn({ userId, companyId, lat, lng, photoUrl }) {
  // Find employee record
  const employee = await Employee.findOne({ user: userId, company: companyId });
  if (!employee) throw new HttpError(404, 'Employee profile not found');
  if (employee.employmentStatus !== 'active') {
    throw new HttpError(403, 'Only active employees can record attendance');
  }

  const today = dayOnly(new Date());

  // Prevent duplicate clock-in
  const existing = await Attendance.findOne({ employee: employee._id, date: today });
  if (existing && existing.clockIn) {
    throw new HttpError(409, 'Already clocked in today');
  }

  // Geofence check (optional — only enforced when location provided)
  let withinGeofence = null;
  if (lat != null && lng != null) {
    const distance = haversineDistance(lat, lng, OFFICE_LAT, OFFICE_LNG);
    withinGeofence = distance <= GEOFENCE_RADIUS;
  }

  const now = new Date();

  // Upsert — create or update today's record
  const attendance = await Attendance.findOneAndUpdate(
    { employee: employee._id, date: today },
    {
      $set: {
        company: companyId,
        clockIn: now,
        status: 'present', // Will be recalculated on clock-out
        clockInLocation: { lat: lat || null, lng: lng || null },
        clockInPhotoUrl: photoUrl || '',
        withinGeofence,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return attendance;
}

/**
 * Clock out an employee. Calculates worked hours and final status.
 */
export async function clockOut({ userId, companyId }) {
  const employee = await Employee.findOne({ user: userId, company: companyId });
  if (!employee) throw new HttpError(404, 'Employee profile not found');

  const today = dayOnly(new Date());
  const attendance = await Attendance.findOne({ employee: employee._id, date: today });

  if (!attendance || !attendance.clockIn) {
    throw new HttpError(400, 'You have not clocked in today');
  }
  if (attendance.clockOut) {
    throw new HttpError(409, 'Already clocked out today');
  }

  const now = new Date();
  const workedMs = now - attendance.clockIn;
  const workedHours = workedMs / (1000 * 60 * 60);

  const status = computeStatus(attendance.clockIn, workedHours);

  attendance.clockOut = now;
  attendance.workedHours = Math.round(workedHours * 100) / 100;
  attendance.status = status;
  await attendance.save();

  return attendance;
}

/**
 * Get today's attendance record for an employee.
 */
export async function getTodayAttendance({ userId, companyId }) {
  const employee = await Employee.findOne({ user: userId, company: companyId });
  if (!employee) throw new HttpError(404, 'Employee profile not found');

  const today = dayOnly(new Date());
  const record = await Attendance.findOne({ employee: employee._id, date: today });
  return record || null;
}

/**
 * Get an employee's own attendance history with pagination.
 */
export async function getMyAttendance({ userId, companyId, query }) {
  const { month, year, page = 1, limit = 31 } = query;

  const employee = await Employee.findOne({ user: userId, company: companyId });
  if (!employee) throw new HttpError(404, 'Employee profile not found');

  const filter = { employee: employee._id };
  if (month && year) {
    const start = dayOnly(new Date(Date.UTC(Number(year), Number(month) - 1, 1)));
    const end = dayOnly(new Date(Date.UTC(Number(year), Number(month), 0)));
    filter.date = { $gte: start, $lte: end };
  }

  const [records, total] = await Promise.all([
    Attendance.find(filter)
      .sort({ date: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit)),
    Attendance.countDocuments(filter),
  ]);

  return { records, total, page: Number(page) };
}

/**
 * Admin/HR: list all attendance with filters.
 */
export async function listAttendance({ companyId, query }) {
  const { employeeId, date, month, year, status, page = 1, limit = 50 } = query;

  const filter = { company: companyId };
  if (status) filter.status = status;

  if (date) {
    filter.date = dayOnly(new Date(date));
  } else if (month && year) {
    const start = dayOnly(new Date(Date.UTC(Number(year), Number(month) - 1, 1)));
    const end = dayOnly(new Date(Date.UTC(Number(year), Number(month), 0)));
    filter.date = { $gte: start, $lte: end };
  } else {
    // Default: today
    filter.date = dayOnly(new Date());
  }

  if (employeeId) filter.employee = employeeId;

  const skip = (Number(page) - 1) * Number(limit);

  const [records, total] = await Promise.all([
    Attendance.find(filter)
      .populate({ path: 'employee', select: 'employeeId jobTitle', populate: { path: 'user', select: 'name email' } })
      .sort({ date: -1, clockIn: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Attendance.countDocuments(filter),
  ]);

  return { records, total, page: Number(page), pages: Math.ceil(total / Number(limit)) };
}

/**
 * Get daily attendance summary for admin/HR dashboard.
 */
export async function getDailySummary({ companyId, dateInput }) {
  const date = dayOnly(dateInput ? new Date(dateInput) : new Date());

  const records = await Attendance.find({ company: companyId, date })
    .populate({ path: 'employee', select: 'employeeId', populate: { path: 'user', select: 'name' } });

  const present = records.filter(r => r.status === 'present').length;
  const late = records.filter(r => r.status === 'late').length;
  const halfDay = records.filter(r => r.status === 'half-day').length;
  const absent = records.filter(r => r.status === 'absent').length;

  return {
    date,
    present,
    late,
    halfDay,
    absent,
    total: records.length,
    records,
  };
}

/**
 * Submit a correction request for an attendance record.
 */
export async function requestCorrection({ userId, companyId, attendanceId, body }) {
  const employee = await Employee.findOne({ user: userId, company: companyId });
  if (!employee) throw new HttpError(404, 'Employee profile not found');

  const record = await Attendance.findOne({ _id: attendanceId, employee: employee._id });
  if (!record) throw new HttpError(404, 'Attendance record not found');

  if (record.correctionRequest?.status === 'pending') {
    throw new HttpError(409, 'A correction request is already pending for this record');
  }

  record.correctionRequest = {
    status: 'pending',
    reason: body.reason || '',
    requestedClockIn: body.requestedClockIn ? new Date(body.requestedClockIn) : null,
    requestedClockOut: body.requestedClockOut ? new Date(body.requestedClockOut) : null,
    reviewedBy: null,
    reviewNote: '',
    reviewedAt: null,
  };
  await record.save();
  return record;
}

/**
 * HR/Admin: review a correction request (approve or reject).
 */
export async function reviewCorrection({ attendanceId, companyId, reviewerId, body }) {
  const record = await Attendance.findOne({ _id: attendanceId, company: companyId });
  if (!record) throw new HttpError(404, 'Attendance record not found');

  if (record.correctionRequest?.status !== 'pending') {
    throw new HttpError(400, 'No pending correction request found');
  }

  const { decision, reviewNote } = body;
  if (!['approved', 'rejected'].includes(decision)) {
    throw new HttpError(400, 'Decision must be approved or rejected');
  }

  record.correctionRequest.status = decision;
  record.correctionRequest.reviewedBy = reviewerId;
  record.correctionRequest.reviewNote = reviewNote || '';
  record.correctionRequest.reviewedAt = new Date();

  // Apply the correction if approved
  if (decision === 'approved') {
    if (record.correctionRequest.requestedClockIn) {
      record.clockIn = record.correctionRequest.requestedClockIn;
    }
    if (record.correctionRequest.requestedClockOut) {
      record.clockOut = record.correctionRequest.requestedClockOut;
    }
    if (record.clockIn && record.clockOut) {
      const workedHours = (record.clockOut - record.clockIn) / (1000 * 60 * 60);
      record.workedHours = Math.round(workedHours * 100) / 100;
      record.status = computeStatus(record.clockIn, workedHours);
    }
  }

  await record.save();
  return record;
}

/**
 * Get monthly attendance stats for an employee (for payroll deduction calculation).
 */
export async function getMonthlyStats({ employeeId, month, year }) {
  const start = dayOnly(new Date(Date.UTC(year, month - 1, 1)));
  const end = dayOnly(new Date(Date.UTC(year, month, 0)));

  const records = await Attendance.find({
    employee: employeeId,
    date: { $gte: start, $lte: end },
  });

  const working = workingDaysInMonth(year, month);
  const present = records.filter(r => r.status === 'present').length;
  const late = records.filter(r => r.status === 'late').length;
  const halfDay = records.filter(r => r.status === 'half-day').length;
  const absent = working - present - late - halfDay;

  return {
    workingDays: working,
    present,
    late,
    halfDay,
    absent: Math.max(0, absent),
    records,
  };
}
