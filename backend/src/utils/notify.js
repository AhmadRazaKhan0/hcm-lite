import Notification from '../models/Notification.js';
export async function notify({ company, user, title, message = '', link = '' }) {
  try { await Notification.create({ company, user, title, message, link }); }
  catch (e) { console.error('[notify]', e.message); }
}
