import mongoose from 'mongoose';

export const PAYROLL_STATUS = ['draft', 'approved', 'finalized'];

const payrollSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    month: { type: Number, required: true, min: 1, max: 12 }, // 1-12
    year: { type: Number, required: true },
    // Salary components
    basicSalary: { type: Number, required: true, default: 0 },
    hra: { type: Number, default: 0 },           // Housing allowance (40% of basic)
    medical: { type: Number, default: 0 },        // Medical allowance (10% of basic)
    otherAllowances: { type: Number, default: 0 },
    grossSalary: { type: Number, default: 0 },    // basic + hra + medical + other
    // Deductions
    absentDays: { type: Number, default: 0 },
    lateDeductions: { type: Number, default: 0 }, // PKR deducted for late arrivals
    unpaidLeaveDays: { type: Number, default: 0 },
    halfDays: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    // Tax (annual calculated monthly)
    annualTax: { type: Number, default: 0 },
    monthlyTax: { type: Number, default: 0 },
    // Net
    netSalary: { type: Number, default: 0 },
    // Working days in the month
    workingDaysInMonth: { type: Number, default: 26 },
    perDaySalary: { type: Number, default: 0 },
    // Status
    status: { type: String, enum: PAYROLL_STATUS, default: 'draft' },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    finalizedAt: { type: Date, default: null },
    // Notes
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// One payslip per employee per month
payrollSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });
payrollSchema.index({ company: 1, month: 1, year: 1 });
payrollSchema.index({ company: 1, status: 1 });

payrollSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

export default mongoose.model('Payroll', payrollSchema);
