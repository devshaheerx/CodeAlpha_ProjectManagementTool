import { isValidObjectId } from 'mongoose';
import Task, { PRIORITIES } from '../models/Task.js';
import Project from '../models/Project.js';
import Comment from '../models/Comment.js';
import Notification from '../models/Notification.js';
import { HttpError } from '../utils/httpError.js';
import { emitToProject } from '../utils/realtime.js';
import { notify } from '../utils/notify.js';

const USER_FIELDS = 'name email avatarColor';
const populate = (doc) =>
  doc.populate([
    { path: 'assignees', select: USER_FIELDS },
    { path: 'createdBy', select: 'name avatarColor' },
  ]);

/** Keep only ids of users who are members of the project. */
function cleanAssignees(project, ids) {
  if (!Array.isArray(ids)) return [];
  const members = project.memberIds();
  return [...new Set(ids.map(String))].filter((id) => members.has(id));
}

function parseDueDate(value) {
  if (value === null || value === '' || value === undefined) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, 'Invalid due date');
  return d;
}

const columnName = (project, columnId) =>
  project.columns.find((c) => String(c._id) === String(columnId))?.name ?? 'a column';

export const listTasks = async (req, res) => {
  const tasks = await populate(Task.find({ project: req.project._id }).sort('order'));
  res.json({ tasks });
};

export const createTask = async (req, res) => {
  const { project } = req;
  const title = String(req.body.title ?? '').trim();
  if (!title) throw new HttpError(400, 'Task title is required');

  const column = req.body.column ?? project.columns[0]?._id;
  if (!column || !project.hasColumn(column)) throw new HttpError(400, 'Invalid column');

  const priority = PRIORITIES.includes(req.body.priority) ? req.body.priority : 'medium';
  const assignees = cleanAssignees(project, req.body.assignees);
  const order = await Task.countDocuments({ project: project._id, column });

  const task = await Task.create({
    project: project._id,
    column,
    order,
    title,
    description: String(req.body.description ?? '').trim(),
    priority,
    dueDate: parseDueDate(req.body.dueDate),
    assignees,
    createdBy: req.user._id,
  });
  await populate(task);

  emitToProject(req, project._id, 'task:created', { task });
  await notify(req, {
    recipients: assignees,
    actor: req.user._id,
    type: 'task_assigned',
    project: project._id,
    task: task._id,
    message: `${req.user.name} assigned you "${task.title}" in ${project.name}`,
  });

  res.status(201).json({ task });
};

export const updateTask = async (req, res) => {
  const { task, project } = req;
  const before = new Set(task.assignees.map(String));

  if (req.body.title !== undefined) {
    const title = String(req.body.title).trim();
    if (!title) throw new HttpError(400, 'Task title is required');
    task.title = title;
  }
  if (req.body.description !== undefined) task.description = String(req.body.description).trim();
  if (req.body.priority !== undefined) {
    if (!PRIORITIES.includes(req.body.priority)) throw new HttpError(400, 'Invalid priority');
    task.priority = req.body.priority;
  }
  if (req.body.dueDate !== undefined) task.dueDate = parseDueDate(req.body.dueDate);
  if (req.body.assignees !== undefined) task.assignees = cleanAssignees(project, req.body.assignees);

  await task.save();
  await populate(task);

  emitToProject(req, project._id, 'task:updated', { task });

  const newlyAssigned = task.assignees.map((u) => String(u._id)).filter((id) => !before.has(id));
  await notify(req, {
    recipients: newlyAssigned,
    actor: req.user._id,
    type: 'task_assigned',
    project: project._id,
    task: task._id,
    message: `${req.user.name} assigned you "${task.title}" in ${project.name}`,
  });

  res.json({ task });
};

export const deleteTask = async (req, res) => {
  const { task, project } = req;
  const canDelete = ['owner', 'admin'].includes(req.role) || String(task.createdBy) === String(req.user._id);
  if (!canDelete) throw new HttpError(403, 'Only the task creator or a project admin can delete this task');

  await Promise.all([Comment.deleteMany({ task: task._id }), Notification.deleteMany({ task: task._id })]);
  await task.deleteOne();

  // Close the gap left in the column.
  const rest = await Task.find({ project: project._id, column: task.column }).sort('order').select('_id');
  if (rest.length) {
    await Task.bulkWrite(rest.map((t, i) => ({ updateOne: { filter: { _id: t._id }, update: { $set: { order: i } } } })));
  }

  emitToProject(req, project._id, 'task:deleted', { taskId: task._id });
  res.json({ message: 'Task deleted', taskId: task._id });
};

/**
 * Drag-and-drop: put a task into `column` at position `index`, then renumber
 * both the destination column and (if different) the source column.
 */
export const moveTask = async (req, res) => {
  const { task, project } = req;
  const { column } = req.body;
  if (!column || !isValidObjectId(column) || !project.hasColumn(column)) throw new HttpError(400, 'Invalid column');

  const fromColumn = String(task.column);
  const toColumn = String(column);

  const destination = await Task.find({ project: project._id, column: toColumn, _id: { $ne: task._id } })
    .sort('order')
    .select('_id');
  const ids = destination.map((t) => String(t._id));
  let index = Number.isInteger(req.body.index) ? req.body.index : ids.length;
  index = Math.max(0, Math.min(index, ids.length));
  ids.splice(index, 0, String(task._id));

  const updates = ids.map((id, i) => ({ _id: id, column: toColumn, order: i }));

  if (fromColumn !== toColumn) {
    const source = await Task.find({ project: project._id, column: fromColumn, _id: { $ne: task._id } })
      .sort('order')
      .select('_id');
    source.forEach((t, i) => updates.push({ _id: String(t._id), column: fromColumn, order: i }));
  }

  await Task.bulkWrite(
    updates.map((u) => ({
      updateOne: { filter: { _id: u._id }, update: { $set: { column: u.column, order: u.order } } },
    }))
  );

  emitToProject(req, project._id, 'tasks:moved', { updates });

  if (fromColumn !== toColumn) {
    await notify(req, {
      recipients: [...task.assignees, task.createdBy],
      actor: req.user._id,
      type: 'task_moved',
      project: project._id,
      task: task._id,
      message: `${req.user.name} moved "${task.title}" to ${columnName(project, toColumn)}`,
    });
  }

  res.json({ updates });
};

/** Tasks assigned to me across all my projects (for the dashboard). */
export const myTasks = async (req, res) => {
  const projects = await Project.find({ 'members.user': req.user._id }).select('name color columns');
  const byId = new Map(projects.map((p) => [String(p._id), p]));

  const tasks = await Task.find({ assignees: req.user._id, project: { $in: projects.map((p) => p._id) } })
    .sort({ dueDate: 1, updatedAt: -1 })
    .populate('assignees', USER_FIELDS)
    .lean();

  const result = tasks.map((t) => {
    const p = byId.get(String(t.project));
    return {
      ...t,
      project: { _id: p._id, name: p.name, color: p.color },
      columnName: columnName(p, t.column),
      isDone: String(t.column) === p.doneColumnId(),
    };
  });

  res.json({ tasks: result });
};
