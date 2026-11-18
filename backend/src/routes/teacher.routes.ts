import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { getMySubjects, getMyTimetable, getActiveSessions, getSessionReport, getSubjectAttendance } from '../controllers/teacher.controller';
import { getAutoSessionsToday } from '../controllers/autoSessionHelper';

const router = Router();
router.use(authenticate, authorize('teacher', 'admin'));

router.get('/subjects', getMySubjects);
router.get('/timetable', getMyTimetable);
router.get('/sessions/active', getActiveSessions);
router.get('/sessions/:sessionId/report', getSessionReport);
router.get('/subjects/:subjectId/attendance', getSubjectAttendance);
router.get('/auto-sessions/today', getAutoSessionsToday);

export default router;
