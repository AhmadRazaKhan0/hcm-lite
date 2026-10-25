import mongoose from 'mongoose';

export const ANNOUNCEMENT_AUDIENCE = ['all', 'hr', 'employee', 'admin'];

const announcementSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    audience: { type: String, enum: ANNOUNCEMENT_AUDIENCE, default: 'all' },
    isPinned: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Track who has read this
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Expiry date (null = never expires)
    expiresAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

announcementSchema.index({ company: 1, audience: 1, createdAt: -1 });
announcementSchema.index({ company: 1, isPinned: -1, createdAt: -1 });

announcementSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

export default mongoose.model('Announcement', announcementSchema);
