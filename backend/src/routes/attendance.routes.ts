import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { attendanceLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validation.middleware';
import {
  startSession, endSession, getLiveSession, getTeacherSessions, refreshQR,
  getAttendanceHistory, getAttendanceSummary,
  validateQR, findSessionByCode, raiseDispute, getActiveSessionsForStudent,
  beginOfflineSyncChallenge, syncOfflineAttendance, getProjectorSession, exportSessionCSV,
  getSessionReport, getAttendanceReceipt,
} from '../controllers/attendance.controller';
import {
  registerFace,
  retryFaceChallenge,
  verifyAttendanceWithFace,
} from '../controllers/facialRecognition.controller';
import {
  registerFaceSchema,
  retryFaceChallengeSchema,
  verifyAttendanceWithFaceSchema,
} from '../validators/facialRecognition.validators';

const router = Router();

// ── CLASSROOM PROJECTOR VIEW — requires ?key=projectorSecret or teacher/admin JWT ──
router.get('/projector/:sessionCode', attendanceLimiter, getProjectorSession);

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
router.get('/session/:sessionCode', authorize('student', 'admin'), attendanceLimiter, findSessionByCode);
router.post('/validate-qr', authorize('student', 'admin'), attendanceLimiter, validateQR);
router.post('/sync-offline/begin', authorize('student', 'admin'), attendanceLimiter, beginOfflineSyncChallenge);
router.post('/sync-offline', authorize('student', 'admin'), attendanceLimiter, syncOfflineAttendance);
router.post('/dispute/:recordId', authorize('student'), raiseDispute);
router.get('/history', authorize('student', 'admin'), getAttendanceHistory);
router.get('/summary', authorize('student', 'admin'), getAttendanceSummary);
router.get('/receipt/:sessionId', authorize('student', 'admin'), getAttendanceReceipt);

// Facial Recognition routes
router.post('/face/register', authorize('student', 'admin'), validateRequest(registerFaceSchema), registerFace);
router.post('/face/retry-challenge', authorize('student', 'admin'), attendanceLimiter, validateRequest(retryFaceChallengeSchema), retryFaceChallenge);
router.post('/face/verify', authorize('student', 'admin'), attendanceLimiter, validateRequest(verifyAttendanceWithFaceSchema), verifyAttendanceWithFace);

export default router;
