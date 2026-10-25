import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { asyncHandler, HttpError } from '../utils/httpError.js';
import { chat } from '../services/ai.service.js';
import { allowRoles } from '../middleware/auth.middleware.js';
import { parseSmartLeave, summarizeDashboard } from '../services/aiExtras.service.js';
import { getAdminDashboard, getHRDashboard } from '../services/dashboard.service.js';

const router = Router();
router.use(authenticate);

// POST /api/ai/chat
// Body: { messages: [{ role: 'user'|'assistant', content: string }] }
router.post('/chat', asyncHandler(async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new HttpError(400, 'messages array is required');
  }

  // Limit context to last 20 messages to prevent abuse
  const truncatedMessages = messages.slice(-20);

  const result = await chat({
    messages: truncatedMessages,
    companyId: req.user.company,
    userId: req.user._id,
    role: req.user.role,
  });

  res.json(result);
}));

// POST /api/ai/smart-leave { text } -> pre-filled suggestion (never saves)
router.post('/smart-leave', allowRoles('employee'), asyncHandler(async (req, res) => {
  res.json(parseSmartLeave(String(req.body?.text || '').slice(0, 500)));
}));

// GET /api/ai/summary — insight bullets computed from live server data (admin/hr)
router.get('/summary', allowRoles('admin', 'hr'), asyncHandler(async (req, res) => {
  const d = req.user.role === 'admin' ? await getAdminDashboard(req.user.company) : await getHRDashboard(req.user.company);
  res.json({ bullets: summarizeDashboard(req.user.role, JSON.parse(JSON.stringify(d))), generatedAt: new Date() });
}));

export default router;
