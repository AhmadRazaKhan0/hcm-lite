import mongoose from 'mongoose';

const leaveBalanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    year: { type: Number, required: true },
    // Entitlement and usage for each leave type
    annual: {
      total: { type: Number, default: 14 },
      used: { type: Number, default: 0 },
    },
    sick: {
      total: { type: Number, default: 8 },
      used: { type: Number, default: 0 },
    },
    casual: {
      total: { type: Number, default: 10 },
      used: { type: Number, default: 0 },
    },
    unpaid: {
      total: { type: Number, default: 365 }, // Effectively unlimited
      used: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// One record per employee per year
leaveBalanceSchema.index({ employee: 1, year: 1 }, { unique: true });
leaveBalanceSchema.index({ company: 1, year: 1 });

leaveBalanceSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

export default mongoose.model('LeaveBalance', leaveBalanceSchema);
