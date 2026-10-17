import { isValidObjectId } from 'mongoose';
import Notification from '../models/Notification.js';
import { HttpError } from '../utils/httpError.js';

export const listNotifications = async (req, res) => {
  const [notifications, unread] = await Promise.all([
    Notification.find({ recipient: req.user._id })
      .sort('-createdAt')
      .limit(30)
      .populate('actor', 'name avatarColor')
      .populate('project', 'name color'),
    Notification.countDocuments({ recipient: req.user._id, read: false }),
  ]);
  res.json({ notifications, unread });
};

export const markRead = async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(404, 'Notification not found');
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { read: true },
    { returnDocument: 'after' }
  );
  if (!n) throw new HttpError(404, 'Notification not found');
  res.json({ notification: n });
};

export const markAllRead = async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
  res.json({ message: 'All caught up' });
};

export const clearAll = async (req, res) => {
  await Notification.deleteMany({ recipient: req.user._id });
  res.json({ message: 'Cleared' });
};
