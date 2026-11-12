import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { attendanceLimiter } from '../middleware/rateLimiter';
import {
  startSession, endSession, getLiveSession, getTeacherSessions, refreshQR,
  verifyAttendance, getAttendanceHistory, getAttendanceSummary,
  validateQR, findSessionByCode, raiseDispute, getActiveSessionsForStudent,
} from '../controllers/attendance.controller';

const router = Router();
router.use(authenticate);

// Teacher routes
router.post('/start-session', authorize('teacher', 'admin'), startSession);
router.post('/end-session/:sessionId', authorize('teacher', 'admin'), endSession);
router.post('/refresh-qr/:sessionId', authorize('teacher', 'admin'), refreshQR);
router.get('/live/:sessionId', authorize('teacher', 'admin'), getLiveSession);
router.get('/teacher/sessions', authorize('teacher', 'admin'), getTeacherSessions);

// Student routes
router.get('/active', authorize('student'), getActiveSessionsForStudent);
router.get('/session/:sessionCode', authorize('student', 'admin'), findSessionByCode);
router.post('/validate-qr', authorize('student', 'admin'), validateQR);
router.post('/verify', authorize('student', 'admin'), attendanceLimiter, verifyAttendance);
router.post('/dispute/:recordId', authorize('student'), raiseDispute);
router.get('/history', authorize('student', 'admin'), getAttendanceHistory);
router.get('/summary', authorize('student', 'admin'), getAttendanceSummary);

export default router;
