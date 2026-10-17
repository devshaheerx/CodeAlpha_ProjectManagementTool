import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { listNotifications, markRead, markAllRead, clearAll } from '../controllers/notificationController.js';

const router = Router();

router.use(protect);

router.route('/').get(listNotifications).delete(clearAll);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);

export default router;
