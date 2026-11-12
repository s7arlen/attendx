import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { getMySubjects, getMyAttendance, getDashboard } from '../controllers/student.controller';

const router = Router();
router.use(authenticate, authorize('student', 'admin'));

router.get('/subjects', getMySubjects);
router.get('/attendance', getMyAttendance);
router.get('/dashboard', getDashboard);

export default router;
