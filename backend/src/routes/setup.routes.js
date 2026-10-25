import { Router } from 'express';
import { needsSetup, runFirstSetup } from '../services/auth.service.js';
import { asyncHandler } from '../utils/httpError.js';

const router = Router();

// GET /api/setup/status -> { needsSetup: true|false }  (frontend uses this to show the setup screen)
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    res.json({ needsSetup: await needsSetup() });
  })
);

// POST /api/setup  { companyName, adminName, email, password }
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { company, admin } = await runFirstSetup(req.body);
    res.status(201).json({
      message: 'Setup complete. You can now log in.',
      company: { id: company._id, name: company.name },
      admin: admin.toJSON(),
    });
  })
);

export default router;