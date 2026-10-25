import mongoose from 'mongoose';

export const ROLES = ['admin', 'hr', 'employee'];

const userSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select:false means queries never return the hash unless asked with .select('+passwordHash')
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    isActive: { type: Boolean, default: true },
    // Employees get a temporary password; they must change it on first sign-in.
    mustChangePassword: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Never leak the hash if a user document is serialized.
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('User', userSchema);