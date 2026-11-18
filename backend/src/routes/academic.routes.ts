import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  createAssessment, getAssessments, updateAssessment, publishAssessment,
  enterMarks, getAssessmentResults,
  getStudentAcademicProfile,
  getStudentRisk, triggerRiskForStudent, getRiskDashboard,
  getMLInfo, whatIfSimulate,
  createIntervention, getInterventions, updateIntervention,
} from '../controllers/academic.controller';

const router = Router();
router.use(authenticate);

// ── Assessments (teacher + admin) ────────────────────────────
router.post('/assessments', authorize('teacher','admin'), createAssessment);
router.get('/assessments', authorize('teacher','admin','student'), getAssessments);
router.put('/assessments/:id', authorize('teacher','admin'), updateAssessment);
router.patch('/assessments/:id/publish', authorize('teacher','admin'), publishAssessment);

// ── Marks entry ───────────────────────────────────────────────
router.post('/marks', authorize('teacher','admin'), enterMarks);
router.get('/marks/:assessmentId', authorize('teacher','admin'), getAssessmentResults);

// ── Student academic profile ──────────────────────────────────
router.get('/profile/me', authorize('student'), getStudentAcademicProfile);
router.get('/profile/:studentId', authorize('teacher','admin'), getStudentAcademicProfile);

// ── Risk assessment ───────────────────────────────────────────
router.get('/risk/dashboard', authorize('teacher','admin'), getRiskDashboard);
router.get('/risk/me', authorize('student'), getStudentRisk);
router.get('/risk/:studentId', authorize('teacher','admin'), getStudentRisk);
router.post('/risk/:studentId/trigger', authorize('teacher','admin'), triggerRiskForStudent);

// ── ML info & What-If ─────────────────────────────────────────
router.get('/ml/info', authorize('teacher','admin'), getMLInfo);
router.post('/whatif', authorize('teacher','admin','student'), whatIfSimulate);

// ── Interventions ─────────────────────────────────────────────
router.post('/interventions', authorize('teacher','admin'), createIntervention);
router.get('/interventions', authorize('teacher','admin'), getInterventions);
router.put('/interventions/:id', authorize('teacher','admin'), updateIntervention);

export default router;
