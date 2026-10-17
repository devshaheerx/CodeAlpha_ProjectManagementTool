import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { loadProject, requireRole } from '../middleware/access.js';
import {
  listProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  addMember,
  updateMemberRole,
  removeMember,
  addColumn,
  renameColumn,
  deleteColumn,
} from '../controllers/projectController.js';
import { listTasks, createTask } from '../controllers/taskController.js';

const router = Router();
const managers = requireRole('owner', 'admin');

router.use(protect);

router.route('/').get(listProjects).post(createProject);

router
  .route('/:projectId')
  .get(loadProject, getProject)
  .patch(loadProject, managers, updateProject)
  .delete(loadProject, requireRole('owner'), deleteProject);

// Members — removeMember checks permissions itself so members can leave.
router.post('/:projectId/members', loadProject, managers, addMember);
router.patch('/:projectId/members/:userId', loadProject, requireRole('owner'), updateMemberRole);
router.delete('/:projectId/members/:userId', loadProject, removeMember);

// Board columns
router.post('/:projectId/columns', loadProject, managers, addColumn);
router.patch('/:projectId/columns/:columnId', loadProject, managers, renameColumn);
router.delete('/:projectId/columns/:columnId', loadProject, managers, deleteColumn);

// Tasks inside a project
router.route('/:projectId/tasks').get(loadProject, listTasks).post(loadProject, createTask);

export default router;
