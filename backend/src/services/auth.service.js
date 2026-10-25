import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Company from '../models/Company.js';
import User from '../models/User.js';
import { HttpError } from '../utils/httpError.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

const str = (v) => (typeof v === 'string' ? v.trim() : '');

export async function needsSetup() {
  const [companies, admins] = await Promise.all([
    Company.countDocuments(),
    User.countDocuments({ role: 'admin' }),
  ]);
  return companies === 0 && admins === 0;
}

// First-run setup: creates the company and its first Admin. Allowed only once.
export async function runFirstSetup(body = {}) {
  const companyName = str(body.companyName);
  const name = str(body.adminName);
  const email = str(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  const errors = [];
  if (!companyName) errors.push({ field: 'companyName', reason: 'Company name is required' });
  if (!name) errors.push({ field: 'adminName', reason: 'Admin name is required' });
  if (!EMAIL_RE.test(email)) errors.push({ field: 'email', reason: 'A valid email is required' });
  if (password.length < MIN_PASSWORD)
    errors.push({ field: 'password', reason: `Password must be at least ${MIN_PASSWORD} characters` });
  if (errors.length) throw new HttpError(422, 'Validation failed', errors);

  if (!(await needsSetup())) {
    throw new HttpError(409, 'Setup has already been completed');
  }

  const company = await Company.create({ name: companyName });
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await User.create({
      company: company._id,
      name,
      email,
      passwordHash,
      role: 'admin',
    });
    return { company, admin };
  } catch (err) {
    // Do not leave a company without an admin behind.
    await Company.deleteOne({ _id: company._id });
    throw err;
  }
}

export async function login(body = {}) {
  const email = str(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  const errors = [];
  if (!email) errors.push({ field: 'email', reason: 'Email is required' });
  if (!password) errors.push({ field: 'password', reason: 'Password is required' });
  if (errors.length) throw new HttpError(422, 'Validation failed', errors);

  const user = await User.findOne({ email }).select('+passwordHash');
  // Same message for unknown email and wrong password, so emails cannot be probed.
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw new HttpError(401, 'Invalid email or password');
  if (!user.isActive) throw new HttpError(403, 'This account has been deactivated');

  if (!process.env.JWT_SECRET) throw new HttpError(500, 'Server is missing JWT_SECRET');
  const token = jwt.sign(
    { sub: user._id.toString(), role: user.role, company: user.company.toString() },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  return { token, user };
}