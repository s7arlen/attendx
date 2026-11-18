import api from '@/lib/axios';
import { Assessment, AssessmentResult, RiskAssessment, RiskDashboard, StudentAcademicProfile, Intervention } from '@/types';

export const academicService = {

  // ── Assessments ───────────────────────────────────────────
  getAssessments: async (params?: { subjectId?: string; type?: string }) => {
    const res = await api.get('/academic/assessments', { params });
    return res.data.data.assessments as Assessment[];
  },

  createAssessment: async (data: Partial<Assessment>) => {
    const res = await api.post('/academic/assessments', data);
    return res.data.data.assessment as Assessment;
  },

  updateAssessment: async (id: string, data: Partial<Assessment>) => {
    const res = await api.put(`/academic/assessments/${id}`, data);
    return res.data.data.assessment as Assessment;
  },

  publishAssessment: async (id: string) => {
    const res = await api.patch(`/academic/assessments/${id}/publish`);
    return res.data.data.assessment as Assessment;
  },

  // ── Marks ─────────────────────────────────────────────────
  enterMarks: async (assessmentId: string, results: { studentId: string; marksObtained: number; isAbsent?: boolean; submittedLate?: boolean; feedback?: string }[]) => {
    const res = await api.post('/academic/marks', { assessmentId, results });
    return res.data;
  },

  getAssessmentResults: async (assessmentId: string) => {
    const res = await api.get(`/academic/marks/${assessmentId}`);
    return res.data.data as { assessment: Assessment; results: AssessmentResult[]; stats: { total: number; appeared: number; average: number; highest: number; lowest: number; passCount: number } };
  },

  // ── Academic Profile ───────────────────────────────────────
  getMyAcademicProfile: async () => {
    const res = await api.get('/academic/profile/me');
    return res.data.data as StudentAcademicProfile;
  },

  getStudentAcademicProfile: async (studentId: string) => {
    const res = await api.get(`/academic/profile/${studentId}`);
    return res.data.data as StudentAcademicProfile;
  },

  // ── Risk ───────────────────────────────────────────────────
  getRiskDashboard: async () => {
    const res = await api.get('/academic/risk/dashboard');
    return res.data.data as RiskDashboard;
  },

  getMyRisk: async () => {
    const res = await api.get('/academic/risk/me');
    return res.data.data as { latest: RiskAssessment | null; history: RiskAssessment[] };
  },

  getStudentRisk: async (studentId: string) => {
    const res = await api.get(`/academic/risk/${studentId}`);
    return res.data.data as { latest: RiskAssessment | null; history: RiskAssessment[] };
  },

  triggerRisk: async (studentId: string) => {
    const res = await api.post(`/academic/risk/${studentId}/trigger`);
    return res.data.data.assessment as RiskAssessment;
  },

  // ── ML Info ────────────────────────────────────────────────
  getMLInfo: async () => {
    const res = await api.get('/academic/ml/info');
    return res.data.data as { mlAvailable: boolean; modelInfo: any };
  },

  // ── What-If ────────────────────────────────────────────────
  whatIfSimulate: async (data: { studentId: string; attendancePercentage?: number; internalMarksAverage?: number; quizAverage?: number; assignmentCompletion?: number }) => {
    const res = await api.post('/academic/whatif', data);
    return res.data.data;
  },

  createIntervention: async (data: Partial<Intervention>) => {
    const res = await api.post('/academic/interventions', data);
    return res.data.data.intervention as Intervention;
  },

  getInterventions: async (params?: { studentId?: string; status?: string }) => {
    const res = await api.get('/academic/interventions', { params });
    return res.data.data.interventions as Intervention[];
  },

  updateIntervention: async (id: string, data: Partial<Intervention>) => {
    const res = await api.put(`/academic/interventions/${id}`, data);
    return res.data.data.intervention as Intervention;
  },
};
