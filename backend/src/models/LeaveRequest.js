import mongoose from 'mongoose';

export const LEAVE_TYPES = ['annual', 'sick', 'casual', 'unpaid', 'other'];
export const LEAVE_STATUS = ['pending', 'approved', 'rejected', 'cancelled'];

const leaveRequestSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    leaveType: { type: String, enum: LEAVE_TYPES, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true, trim: true },
    // Calculated number of working days requested
    days: { type: Number, required: true, min: 0.5 },
    status: { type: String, enum: LEAVE_STATUS, default: 'pending' },
    // HR/Admin who reviewed
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNote: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
    // Emergency contact during leave
    emergencyContact: { type: String, default: '' },
  },
  { timestamps: true }
);

leaveRequestSchema.index({ company: 1, employee: 1, status: 1 });
leaveRequestSchema.index({ company: 1, status: 1 });
leaveRequestSchema.index({ company: 1, startDate: 1, endDate: 1 });

leaveRequestSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

export default mongoose.model('LeaveRequest', leaveRequestSchema);
