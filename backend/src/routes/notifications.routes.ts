import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getNotifications, markNotificationsRead } from '../controllers/admin.controller';

const router = Router();
router.use(authenticate);

router.get('/', getNotifications);
router.post('/mark-read', markNotificationsRead);

export default router;
