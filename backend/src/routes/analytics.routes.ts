import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { getAdminAnalytics, getTeacherAnalytics, getStudentAnalytics } from '../controllers/analytics.controller';

const router = Router();
router.use(authenticate);

router.get('/admin', authorize('admin'), getAdminAnalytics);
router.get('/teacher', authorize('teacher', 'admin'), getTeacherAnalytics);
router.get('/student', authorize('student', 'admin'), getStudentAnalytics);

export default router;
