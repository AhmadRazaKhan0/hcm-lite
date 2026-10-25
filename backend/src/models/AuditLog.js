import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    // Who performed the action
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: { type: String, default: '' }, // denormalized for display
    actorRole: { type: String, default: '' },
    // What they did
    action: { type: String, required: true }, // e.g. 'CREATE_EMPLOYEE', 'APPROVE_LEAVE'
    // What was acted on
    targetModel: { type: String, default: '' }, // e.g. 'Employee', 'LeaveRequest'
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    targetName: { type: String, default: '' }, // denormalized description
    // Safe summary (no passwords/tokens)
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Request IP address
    ip: { type: String, default: '' },
  },
  {
    timestamps: true,
    // Capped to prevent unbounded growth in demo env
  }
);

auditLogSchema.index({ company: 1, createdAt: -1 });
auditLogSchema.index({ company: 1, actor: 1 });
auditLogSchema.index({ company: 1, action: 1 });

auditLogSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

export default mongoose.model('AuditLog', auditLogSchema);
