import Notification from '../models/Notification.js';
import { emitToUser } from './realtime.js';

/**
 * Creates one notification per recipient (skipping the actor) and pushes each
 * one live to the recipient's personal socket room.
 */
export async function notify(req, { recipients, actor, type, project, task, message }) {
  const unique = [...new Set(recipients.map((r) => String(r?._id ?? r)))].filter(
    (id) => id !== String(actor)
  );
  if (!unique.length) return;

  try {
    const created = await Notification.insertMany(
      unique.map((recipient) => ({ recipient, actor, type, project, task, message }))
    );
    const populated = await Notification.find({ _id: { $in: created.map((n) => n._id) } })
      .populate('actor', 'name avatarColor')
      .populate('project', 'name color');
    populated.forEach((n) => emitToUser(req, n.recipient, 'notification:new', n));
  } catch (err) {
    // Notifications should never break the main action.
    console.error('notify failed:', err.message);
  }
}
