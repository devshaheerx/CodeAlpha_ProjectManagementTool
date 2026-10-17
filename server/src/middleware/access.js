import { isValidObjectId } from 'mongoose';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Comment from '../models/Comment.js';
import { HttpError } from '../utils/httpError.js';

async function attachProject(req, projectId) {
  const project = await Project.findById(projectId);
  if (!project) throw new HttpError(404, 'Project not found');
  const role = project.roleOf(req.user._id);
  if (!role) throw new HttpError(403, 'You are not a member of this project');
  req.project = project;
  req.role = role;
}

/** For routes with :projectId — only members get through. */
export const loadProject = async (req, res, next) => {
  const { projectId } = req.params;
  if (!isValidObjectId(projectId)) throw new HttpError(404, 'Project not found');
  await attachProject(req, projectId);
  next();
};

/** For routes with :taskId — loads the task and checks membership of its project. */
export const loadTask = async (req, res, next) => {
  const { taskId } = req.params;
  if (!isValidObjectId(taskId)) throw new HttpError(404, 'Task not found');
  const task = await Task.findById(taskId);
  if (!task) throw new HttpError(404, 'Task not found');
  await attachProject(req, task.project);
  req.task = task;
  next();
};

/** For routes with :commentId. */
export const loadComment = async (req, res, next) => {
  const { commentId } = req.params;
  if (!isValidObjectId(commentId)) throw new HttpError(404, 'Comment not found');
  const comment = await Comment.findById(commentId);
  if (!comment) throw new HttpError(404, 'Comment not found');
  await attachProject(req, comment.project);
  req.comment = comment;
  next();
};

export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.role)) throw new HttpError(403, 'You do not have permission to do that');
    next();
  };
