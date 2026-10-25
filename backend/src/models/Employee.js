import mongoose from 'mongoose';

// Employment status values
export const EMP_STATUS = ['active', 'inactive', 'terminated', 'on_leave'];

const employeeSchema = new mongoose.Schema(
  {
    // Linked User account (for login). May be null if account not yet created.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    employeeId: { type: String, required: true, trim: true, unique: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    jobTitle: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    joiningDate: { type: Date, required: true },
    reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    employmentStatus: { type: String, enum: EMP_STATUS, default: 'active' },
    // Salary is sensitive — only returned when explicitly selected
    basicSalary: { type: Number, default: 0, select: false },
    // Profile picture URL
    avatarUrl: { type: String, default: '' },
    // Address
    address: { type: String, trim: true, default: '' },
    // Emergency contact
    emergencyContact: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      relation: { type: String, default: '' },
    },
    // Termination info
    terminationDate: { type: Date, default: null },
    terminationReason: { type: String, default: '' },
  },
  { timestamps: true }
);

employeeSchema.index({ company: 1, employeeId: 1 }, { unique: true });
employeeSchema.index({ company: 1, department: 1 });
employeeSchema.index({ company: 1, employmentStatus: 1 });

employeeSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

export default mongoose.model('Employee', employeeSchema);
