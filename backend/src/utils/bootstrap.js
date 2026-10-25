import bcrypt from 'bcryptjs';
import Company from '../models/Company.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import { createEmployee } from '../services/employee.service.js';

export const DEFAULT_LOGINS = [
  { name: 'Admin User', email: 'admin@hcm.local', password: 'Admin@12345', role: 'admin' },
  { name: 'HR Manager', email: 'hr@hcm.local', password: 'Hr@12345', role: 'hr', employeeId: 'HR-001', jobTitle: 'HR Manager', basicSalary: 0 },
  { name: 'Ali Employee', email: 'employee@hcm.local', password: 'Employee@12345', role: 'employee', employeeId: 'EMP-001', jobTitle: 'Developer', basicSalary: 60000 },
];

// Idempotent: creates the Admin / HR / Employee logins if missing. reset=true also resets their passwords.
export async function ensureLogins({ reset = false } = {}) {
  let company = await Company.findOne();
  if (!company) company = await Company.create({ name: process.env.COMPANY_NAME || 'HCM Lite Company' });
  let dept = await Department.findOne({ company: company._id });
  if (!dept) dept = await Department.create({ company: company._id, name: 'General' });

  for (const a of DEFAULT_LOGINS) {
    let user = await User.findOne({ email: a.email });
    if (user) {
      if (reset) {
        user.passwordHash = await bcrypt.hash(a.password, 10);
        user.mustChangePassword = false; user.isActive = true;
        await user.save();
      }
      continue;
    }
    if (a.role === 'admin') {
      await User.create({ company: company._id, name: a.name, email: a.email, role: 'admin', passwordHash: await bcrypt.hash(a.password, 10) });
    } else {
      const r = await createEmployee({ companyId: company._id, actorId: null, body: {
        name: a.name, email: a.email, role: a.role, employeeId: a.employeeId, jobTitle: a.jobTitle,
        basicSalary: a.basicSalary, department: dept._id, joiningDate: new Date(), tempPassword: a.password } });
      r.user.mustChangePassword = false; await r.user.save();
    }
  }
}
