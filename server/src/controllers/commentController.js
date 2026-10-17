import Comment from '../models/Comment.js';
import Task from '../models/Task.js';
import { HttpError } from '../utils/httpError.js';
import { emitToProject } from '../utils/realtime.js';
import { notify } from '../utils/notify.js';

export const listComments = async (req, res) => {
  const comments = await Comment.find({ task: req.task._id })
    .sort('createdAt')
    .populate('author', 'name avatarColor');
  res.json({ comments });
};

export const addComment = async (req, res) => {
  const { task, project } = req;
  const text = String(req.body.text ?? '').trim();
  if (!text) throw new HttpError(400, 'Comment cannot be empty');

  const comment = await Comment.create({ task: task._id, project: project._id, author: req.user._id, text });
  await comment.populate('author', 'name avatarColor');

  task.commentCount += 1;
  await task.save();

  emitToProject(req, project._id, 'comment:created', {
    comment,
    taskId: task._id,
    commentCount: task.commentCount,
  });

  await notify(req, {
    recipients: [...task.assignees, task.createdBy],
    actor: req.user._id,
    type: 'task_commented',
    project: project._id,
    task: task._id,
    message: `${req.user.name} commented on "${task.title}": ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`,
  });

  res.status(201).json({ comment, commentCount: task.commentCount });
};

export const deleteComment = async (req, res) => {
  const { comment, project } = req;
  const canDelete = String(comment.author) === String(req.user._id) || ['owner', 'admin'].includes(req.role);
  if (!canDelete) throw new HttpError(403, 'You can only delete your own comments');

  await comment.deleteOne();
  const task = await Task.findByIdAndUpdate(comment.task, { $inc: { commentCount: -1 } }, { returnDocument: 'after' });

  const payload = { commentId: comment._id, taskId: comment.task, commentCount: Math.max(0, task?.commentCount ?? 0) };
  emitToProject(req, project._id, 'comment:deleted', payload);
  res.json(payload);
};
