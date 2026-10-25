import { Router } from 'express';
import { authenticate, allowRoles } from '../middleware/auth.middleware.js';
import { asyncHandler, HttpError } from '../utils/httpError.js';
import Announcement from '../models/Announcement.js';
import { logAction } from '../utils/audit.js';

const router = Router();
router.use(authenticate);

// GET /api/announcements — get relevant announcements for user's role
router.get('/', asyncHandler(async (req, res) => {
  const { role, company, _id } = req.user;

  // Employee sees 'all' and 'employee' announcements
  // HR sees 'all', 'hr', 'employee'
  // Admin sees everything
  const audienceFilter = role === 'admin'
    ? {}
    : role === 'hr'
    ? { audience: { $in: ['all', 'hr', 'employee'] } }
    : { audience: { $in: ['all', 'employee'] } };

  const announcements = await Announcement.find({
    company,
    isActive: true,
    ...audienceFilter,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  })
    .populate('createdBy', 'name role')
    .sort({ isPinned: -1, createdAt: -1 })
    .limit(50);

  // Mark which are read by this user
  const result = announcements.map(a => ({
    ...a.toJSON(),
    isRead: a.readBy.some(id => id.toString() === _id.toString()),
  }));

  res.json(result);
}));

// POST /api/announcements — create (admin/hr)
router.post('/', allowRoles('admin', 'hr'), asyncHandler(async (req, res) => {
  const { title, content, audience, isPinned, expiresAt } = req.body;
  if (!title?.trim()) throw new HttpError(422, 'Title is required');
  if (!content?.trim()) throw new HttpError(422, 'Content is required');

  const ann = await Announcement.create({
    company: req.user.company,
    title: title.trim(),
    content: content.trim(),
    audience: audience || 'all',
    isPinned: !!isPinned,
    createdBy: req.user._id,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  });

  await logAction({
    company: req.user.company,
    actor: req.user,
    action: 'CREATE_ANNOUNCEMENT',
    targetModel: 'Announcement',
    targetId: ann._id,
    targetName: ann.title,
    ip: req.ip,
  });

  res.status(201).json(ann);
}));

// PUT /api/announcements/:id — update (admin/hr)
router.put('/:id', allowRoles('admin', 'hr'), asyncHandler(async (req, res) => {
  const ann = await Announcement.findOne({ _id: req.params.id, company: req.user.company });
  if (!ann) throw new HttpError(404, 'Announcement not found');

  if (req.body.title !== undefined) ann.title = req.body.title.trim();
  if (req.body.content !== undefined) ann.content = req.body.content.trim();
  if (req.body.audience !== undefined) ann.audience = req.body.audience;
  if (req.body.isPinned !== undefined) ann.isPinned = req.body.isPinned;
  if (req.body.isActive !== undefined) ann.isActive = req.body.isActive;
  if (req.body.expiresAt !== undefined) ann.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;

  await ann.save();
  res.json(ann);
}));

// DELETE /api/announcements/:id
router.delete('/:id', allowRoles('admin', 'hr'), asyncHandler(async (req, res) => {
  const ann = await Announcement.findOne({ _id: req.params.id, company: req.user.company });
  if (!ann) throw new HttpError(404, 'Announcement not found');
  ann.isActive = false;
  await ann.save();
  res.json({ message: 'Announcement removed' });
}));

// POST /api/announcements/:id/read — mark as read
router.post('/:id/read', asyncHandler(async (req, res) => {
  await Announcement.updateOne(
    { _id: req.params.id, company: req.user.company },
    { $addToSet: { readBy: req.user._id } }
  );
  res.json({ message: 'Marked as read' });
}));

export default router;
