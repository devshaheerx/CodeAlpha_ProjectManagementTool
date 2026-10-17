import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { loadComment } from '../middleware/access.js';
import { deleteComment } from '../controllers/commentController.js';

const router = Router();

router.delete('/:commentId', protect, loadComment, deleteComment);

export default router;
