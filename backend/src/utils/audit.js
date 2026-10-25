import AuditLog from '../models/AuditLog.js';

/**
 * Record an audit event. Non-blocking — errors are logged but not thrown.
 * @param {object} opts
 * @param {string} opts.company     - Company ObjectId
 * @param {object} opts.actor       - req.user (has _id, name, role)
 * @param {string} opts.action      - e.g. 'CREATE_EMPLOYEE'
 * @param {string} [opts.targetModel]
 * @param {string} [opts.targetId]
 * @param {string} [opts.targetName]
 * @param {object} [opts.details]   - safe summary, no passwords/tokens
 * @param {string} [opts.ip]
 */
export async function logAction({ company, actor, action, targetModel = '', targetId = null, targetName = '', details = {}, ip = '' }) {
  try {
    await AuditLog.create({
      company,
      actor: actor._id,
      actorName: actor.name || '',
      actorRole: actor.role || '',
      action,
      targetModel,
      targetId,
      targetName,
      details,
      ip,
    });
  } catch (err) {
    // Audit logging must never crash the main request
    console.error('[audit] Failed to log action:', err.message);
  }
}
