import { Router } from 'express';
import { authenticate, allowRoles } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/httpError.js';
import Department from '../models/Department.js';
import Employee from '../models/Employee.js';
import { logAction } from '../utils/audit.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();
router.use(authenticate);

// GET /api/departments
router.get('/', allowRoles('admin', 'hr'), asyncHandler(async (req, res) => {
  const departments = await Department.find({ company: req.user.company }).sort('name');
  // Add employee count to each department
  const result = await Promise.all(
    departments.map(async (dept) => {
      const count = await Employee.countDocuments({
        company: req.user.company,
        department: dept._id,
        employmentStatus: 'active',
      });
      return { ...dept.toJSON(), employeeCount: count };
    })
  );
  res.json(result);
}));

// POST /api/departments
router.post('/', allowRoles('admin'), asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) throw new HttpError(422, 'Department name is required');

  const dept = await Department.create({
    company: req.user.company,
    name: name.trim(),
    description: description?.trim() || '',
  });

  await logAction({
    company: req.user.company,
    actor: req.user,
    action: 'CREATE_DEPARTMENT',
    targetModel: 'Department',
    targetId: dept._id,
    targetName: dept.name,
    ip: req.ip,
  });

  res.status(201).json(dept);
}));

// PUT /api/departments/:id
router.put('/:id', allowRoles('admin'), asyncHandler(async (req, res) => {
  const dept = await Department.findOne({ _id: req.params.id, company: req.user.company });
  if (!dept) throw new HttpError(404, 'Department not found');

  if (req.body.name) dept.name = req.body.name.trim();
  if (req.body.description !== undefined) dept.description = req.body.description.trim();
  if (req.body.isActive !== undefined) dept.isActive = req.body.isActive;
  await dept.save();

  res.json(dept);
}));

// DELETE /api/departments/:id (soft delete)
router.delete('/:id', allowRoles('admin'), asyncHandler(async (req, res) => {
  const dept = await Department.findOne({ _id: req.params.id, company: req.user.company });
  if (!dept) throw new HttpError(404, 'Department not found');
  dept.isActive = false;
  await dept.save();
  res.json({ message: 'Department deactivated' });
}));

export default router;
