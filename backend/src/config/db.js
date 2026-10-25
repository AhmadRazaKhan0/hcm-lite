import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI || (process.env.NODE_ENV === 'production' ? '' : 'mongodb://127.0.0.1:27017/hcm_lite');
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and fill it in.');
  }
  if (!process.env.MONGODB_URI) console.warn('MONGODB_URI not set - using local mongodb://127.0.0.1:27017/hcm_lite');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
}