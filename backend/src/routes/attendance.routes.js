import { Router } from 'express';
import { authenticate, allowRoles } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/httpError.js';
import {
  clockIn, clockOut, getTodayAttendance, getMyAttendance,
  listAttendance, getDailySummary, requestCorrection, reviewCorrection
} from '../services/attendance.service.js';
import { logAction } from '../utils/audit.js';

const router = Router();
router.use(authenticate);

// POST /api/attendance/clock-in
router.post('/clock-in', allowRoles('employee'), asyncHandler(async (req, res) => {
  const { lat, lng, photoUrl } = req.body;
  const record = await clockIn({
    userId: req.user._id,
    companyId: req.user.company,
    lat: lat != null ? Number(lat) : null,
    lng: lng != null ? Number(lng) : null,
    photoUrl: photoUrl || '',
  });
  res.status(201).json(record);
}));

// POST /api/attendance/clock-out
router.post('/clock-out', allowRoles('employee'), asyncHandler(async (req, res) => {
  const record = await clockOut({ userId: req.user._id, companyId: req.user.company });
  res.json(record);
}));

// GET /api/attendance/today — own today's record
router.get('/today', asyncHandler(async (req, res) => {
  if (req.user.role === 'employee') {
    const record = await getTodayAttendance({ userId: req.user._id, companyId: req.user.company });
    return res.json(record);
  }
  // Admin/HR: daily summary
  const summary = await getDailySummary({ companyId: req.user.company, dateInput: req.query.date });
  res.json(summary);
}));

// GET /api/attendance/mine — employee's own history
router.get('/mine', allowRoles('employee'), asyncHandler(async (req, res) => {
  const result = await getMyAttendance({
    userId: req.user._id,
    companyId: req.user.company,
    query: req.query,
  });
  res.json(result);
}));

// GET /api/attendance/summary — daily summary (admin/hr)
router.get('/summary', allowRoles('admin', 'hr'), asyncHandler(async (req, res) => {
  const summary = await getDailySummary({ companyId: req.user.company, dateInput: req.query.date });
  res.json(summary);
}));

// GET /api/attendance — list all (admin/hr)
router.get('/', allowRoles('admin', 'hr'), asyncHandler(async (req, res) => {
  const result = await listAttendance({ companyId: req.user.company, query: req.query });
  res.json(result);
}));

// POST /api/attendance/:id/correction — employee requests correction
router.post('/:id/correction', allowRoles('employee'), asyncHandler(async (req, res) => {
  const record = await requestCorrection({
    userId: req.user._id,
    companyId: req.user.company,
    attendanceId: req.params.id,
    body: req.body,
  });
  res.json(record);
}));

// PUT /api/attendance/:id/correction — HR/admin reviews correction
router.put('/:id/correction', allowRoles('admin', 'hr'), asyncHandler(async (req, res) => {
  const record = await reviewCorrection({
    attendanceId: req.params.id,
    companyId: req.user.company,
    reviewerId: req.user._id,
    body: req.body,
  });
  await logAction({
    company: req.user.company,
    actor: req.user,
    action: `ATTENDANCE_CORRECTION_${req.body.decision?.toUpperCase()}`,
    targetModel: 'Attendance',
    targetId: record._id,
    ip: req.ip,
  });
  res.json(record);
}));

export default router;
