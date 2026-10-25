import mongoose from 'mongoose';

// One company per installation. Office hours, grace time, location etc.
// will be added later as settings (M2), applied to new records only.
const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model('Company', companySchema);