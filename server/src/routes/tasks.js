import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { loadTask } from '../middleware/access.js';
import { updateTask, deleteTask, moveTask, myTasks } from '../controllers/taskController.js';
import { listComments, addComment } from '../controllers/commentController.js';

const router = Router();

router.use(protect);

router.get('/mine', myTasks);

router.route('/:taskId').patch(loadTask, updateTask).delete(loadTask, deleteTask);
router.patch('/:taskId/move', loadTask, moveTask);
router.route('/:taskId/comments').get(loadTask, listComments).post(loadTask, addComment);

export default router;
