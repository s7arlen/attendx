import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { attendanceLimiter } from '../middleware/rateLimiter';
import {
  startSession, endSession, getLiveSession, getTeacherSessions, refreshQR,
  verifyAttendance, getAttendanceHistory, getAttendanceSummary,
  validateQR, findSessionByCode, raiseDispute, getActiveSessionsForStudent,
  syncOfflineAttendance, getProjectorSession, exportSessionCSV,
  getSessionReport, getAttendanceReceipt,
} from '../controllers/attendance.controller';

const router = Router();

// ── PUBLIC: Projector view — no auth (safe fields only) ──────────────────────
router.get('/projector/:sessionCode', getProjectorSession);

// ── All routes below require authentication ───────────────────────────────────
router.use(authenticate);

// Teacher routes
router.post('/start-session', authorize('teacher', 'admin'), startSession);
router.post('/end-session/:sessionId', authorize('teacher', 'admin'), endSession);
router.post('/refresh-qr/:sessionId', authorize('teacher', 'admin'), refreshQR);
router.get('/live/:sessionId', authorize('teacher', 'admin'), getLiveSession);
router.get('/teacher/sessions', authorize('teacher', 'admin'), getTeacherSessions);
router.get('/sessions/:sessionId/report', authorize('teacher', 'admin'), getSessionReport);
router.get('/sessions/:sessionId/export', authorize('teacher', 'admin'), exportSessionCSV);

// Student routes
router.get('/active', authorize('student'), getActiveSessionsForStudent);
router.get('/session/:sessionCode', authorize('student', 'admin'), findSessionByCode);
router.post('/validate-qr', authorize('student', 'admin'), validateQR);
router.post('/verify', authorize('student', 'admin'), attendanceLimiter, verifyAttendance);
router.post('/sync-offline', authorize('student', 'admin'), syncOfflineAttendance);
router.post('/dispute/:recordId', authorize('student'), raiseDispute);
router.get('/history', authorize('student', 'admin'), getAttendanceHistory);
router.get('/summary', authorize('student', 'admin'), getAttendanceSummary);
router.get('/receipt/:sessionId', authorize('student', 'admin'), getAttendanceReceipt);

export default router;
