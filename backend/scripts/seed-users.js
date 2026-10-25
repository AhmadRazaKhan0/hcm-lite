// Creates or RESETS the Admin / HR / Employee logins. Usage: npm run seed-users
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { ensureLogins, DEFAULT_LOGINS } from '../src/utils/bootstrap.js';

await connectDB();
await ensureLogins({ reset: true });
console.log('\nLogins ready:');
for (const a of DEFAULT_LOGINS) console.log(`  ${a.role.padEnd(8)} ${a.email}  /  ${a.password}`);
await mongoose.disconnect();
