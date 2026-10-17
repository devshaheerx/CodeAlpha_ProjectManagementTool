import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Comment from '../models/Comment.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { HttpError } from '../utils/httpError.js';
import { emitToProject, emitToUser } from '../utils/realtime.js';
import { notify } from '../utils/notify.js';

const USER_FIELDS = 'name email avatarColor';
const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6'];

const populate = (doc) =>
  doc.populate([
    { path: 'members.user', select: USER_FIELDS },
    { path: 'owner', select: USER_FIELDS },
  ]);

/** Populate, push the new state to everyone on the board, and respond. */
async function respondWithProject(req, res, project, status = 200) {
  await populate(project);
  emitToProject(req, project._id, 'project:updated', { project });
  res.status(status).json({ project, role: project.roleOf(req.user._id) });
}

export const listProjects = async (req, res) => {
  const projects = await Project.find({ 'members.user': req.user._id })
    .sort('-updatedAt')
    .populate('members.user', USER_FIELDS);

  const counts = await Task.aggregate([
    { $match: { project: { $in: projects.map((p) => p._id) } } },
    { $group: { _id: { project: '$project', column: '$column' }, count: { $sum: 1 } } },
  ]);

  const result = projects.map((p) => {
    const doneCol = p.doneColumnId();
    let total = 0;
    let done = 0;
    for (const c of counts) {
      if (String(c._id.project) !== String(p._id)) continue;
      total += c.count;
      if (String(c._id.column) === doneCol) done += c.count;
    }
    return { ...p.toObject(), stats: { total, done }, role: p.roleOf(req.user._id) };
  });

  res.json({ projects: result });
};

export const createProject = async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  if (!name) throw new HttpError(400, 'Project name is required');

  // Optional: invite teammates while creating the group project.
  const emails = Array.isArray(req.body.memberEmails)
    ? [...new Set(req.body.memberEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean))].slice(0, 20)
    : [];
  const found = emails.length ? await User.find({ email: { $in: emails } }).select('_id email') : [];
  const invited = found.filter((u) => String(u._id) !== String(req.user._id));
  const notFound = emails.filter((e) => !found.some((u) => u.email === e));

  const project = new Project({
    name,
    description: String(req.body.description ?? '').trim(),
    color: COLORS.includes(req.body.color) ? req.body.color : COLORS[0],
    owner: req.user._id,
    members: [{ user: req.user._id, role: 'owner' }, ...invited.map((u) => ({ user: u._id, role: 'member' }))],
  });
  await project.save();

  invited.forEach((u) => emitToUser(req, u._id, 'project:added', { projectId: project._id }));
  await notify(req, {
    recipients: invited.map((u) => u._id),
    actor: req.user._id,
    type: 'project_invited',
    project: project._id,
    message: `${req.user.name} added you to "${project.name}"`,
  });

  await populate(project);
  res.status(201).json({ project, role: 'owner', notFound });
};

export const getProject = async (req, res) => {
  await populate(req.project);
  res.json({ project: req.project, role: req.role });
};

export const updateProject = async (req, res) => {
  const { project } = req;
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) throw new HttpError(400, 'Project name is required');
    project.name = name;
  }
  if (req.body.description !== undefined) project.description = String(req.body.description).trim();
  if (req.body.color !== undefined && COLORS.includes(req.body.color)) project.color = req.body.color;
  await project.save();
  await respondWithProject(req, res, project);
};

export const deleteProject = async (req, res) => {
  const { project } = req;
  await Promise.all([
    Task.deleteMany({ project: project._id }),
    Comment.deleteMany({ project: project._id }),
    Notification.deleteMany({ project: project._id }),
  ]);
  await project.deleteOne();
  emitToProject(req, project._id, 'project:deleted', { projectId: project._id, name: project.name });
  res.json({ message: 'Project deleted' });
};

/* ---------------------------- Members ---------------------------- */

export const addMember = async (req, res) => {
  const { project } = req;
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const role = req.body.role === 'admin' ? 'admin' : 'member';

  if (!email) throw new HttpError(400, 'Email is required');
  if (role === 'admin' && req.role !== 'owner') throw new HttpError(403, 'Only the owner can add admins');

  const user = await User.findOne({ email });
  if (!user) throw new HttpError(404, 'No user with that email. Ask them to sign up first.');
  if (project.roleOf(user._id)) throw new HttpError(409, `${user.name} is already a member`);

  project.members.push({ user: user._id, role });
  await project.save();

  emitToUser(req, user._id, 'project:added', { projectId: project._id });
  await notify(req, {
    recipients: [user._id],
    actor: req.user._id,
    type: 'project_invited',
    project: project._id,
    message: `${req.user.name} added you to "${project.name}"`,
  });

  await respondWithProject(req, res, project, 201);
};

export const updateMemberRole = async (req, res) => {
  const { project } = req;
  const { userId } = req.params;
  const role = req.body.role;
  if (!['admin', 'member'].includes(role)) throw new HttpError(400, 'Role must be admin or member');

  const member = project.members.find((m) => String(m.user) === String(userId));
  if (!member) throw new HttpError(404, 'Member not found');
  if (member.role === 'owner') throw new HttpError(400, "The owner's role can't be changed");

  member.role = role;
  await project.save();
  await respondWithProject(req, res, project);
};

export const removeMember = async (req, res) => {
  const { project } = req;
  const { userId } = req.params;
  const isSelf = String(userId) === String(req.user._id);

  const target = project.members.find((m) => String(m.user) === String(userId));
  if (!target) throw new HttpError(404, 'Member not found');
  if (target.role === 'owner') {
    throw new HttpError(400, isSelf ? 'The owner cannot leave. Delete the project instead.' : "The owner can't be removed");
  }
  if (!isSelf) {
    if (req.role === 'member') throw new HttpError(403, 'Only owners and admins can remove members');
    if (req.role === 'admin' && target.role === 'admin') throw new HttpError(403, 'Only the owner can remove admins');
  }

  project.members = project.members.filter((m) => String(m.user) !== String(userId));
  await project.save();
  await Task.updateMany({ project: project._id }, { $pull: { assignees: userId } });

  emitToUser(req, userId, 'project:removed', { projectId: project._id, name: project.name, left: isSelf });
  emitToProject(req, project._id, 'tasks:refresh', {});
  await respondWithProject(req, res, project);
};

/* ---------------------------- Columns ---------------------------- */

export const addColumn = async (req, res) => {
  const { project } = req;
  const name = String(req.body.name ?? '').trim();
  if (!name) throw new HttpError(400, 'Column name is required');
  if (project.columns.length >= 10) throw new HttpError(400, 'A board can have at most 10 columns');
  project.columns.push({ name });
  await project.save();
  await respondWithProject(req, res, project, 201);
};

export const renameColumn = async (req, res) => {
  const { project } = req;
  const column = project.columns.id(req.params.columnId);
  if (!column) throw new HttpError(404, 'Column not found');
  const name = String(req.body.name ?? '').trim();
  if (!name) throw new HttpError(400, 'Column name is required');
  column.name = name;
  await project.save();
  await respondWithProject(req, res, project);
};

export const deleteColumn = async (req, res) => {
  const { project } = req;
  const column = project.columns.id(req.params.columnId);
  if (!column) throw new HttpError(404, 'Column not found');
  if (project.columns.length <= 1) throw new HttpError(400, 'A board needs at least one column');
  const taskCount = await Task.countDocuments({ project: project._id, column: column._id });
  if (taskCount > 0) throw new HttpError(400, 'Move or delete the tasks in this column first');
  column.deleteOne();
  await project.save();
  await respondWithProject(req, res, project);
};
