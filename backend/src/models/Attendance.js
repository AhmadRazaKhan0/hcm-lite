import mongoose from 'mongoose';

// Status values for attendance
export const ATTENDANCE_STATUS = ['present', 'absent', 'late', 'half-day', 'holiday', 'weekend'];

// Status for correction requests
export const CORRECTION_STATUS = ['pending', 'approved', 'rejected'];

const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    // Date only (no time) — stored as midnight UTC for the day
    date: { type: Date, required: true },
    // Server-generated timestamps
    clockIn: { type: Date, default: null },
    clockOut: { type: Date, default: null },
    // Computed after clock-out or end of day
    workedHours: { type: Number, default: 0 },
    status: { type: String, enum: ATTENDANCE_STATUS, default: 'absent' },
    // Location at clock-in
    clockInLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracy: { type: Number, default: null },
    },
    // Photo URL at clock-in (optional)
    clockInPhotoUrl: { type: String, default: '' },
    // Was the employee within geofence at clock-in?
    withinGeofence: { type: Boolean, default: null },
    // Correction request
    correctionRequest: {
      status: { type: String, enum: CORRECTION_STATUS, default: null },
      reason: { type: String, default: '' },
      requestedClockIn: { type: Date, default: null },
      requestedClockOut: { type: Date, default: null },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      reviewNote: { type: String, default: '' },
      reviewedAt: { type: Date, default: null },
    },
    // Notes by HR or admin
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// One record per employee per day
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
attendanceSchema.index({ company: 1, date: 1 });
attendanceSchema.index({ company: 1, employee: 1, date: -1 });

attendanceSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

export default mongoose.model('Attendance', attendanceSchema);
