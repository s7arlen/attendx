import api from '@/lib/axios';
import { AttendanceSession, LivenessProof } from '@/types';

export const attendanceService = {
  // Teacher
  startSession: async (data: {
    subjectId: string;
    duration?: number;
    sessionType?: string;
    verificationMode?: string;
    capacity?: number | null;
    gracePeriodMinutes?: number;
    venue?: string | null;
    inviteList?: string[];
    geoFence?: { latitude: number; longitude: number; radiusMeters: number } | null;
  }) => {
    const res = await api.post('/attendance/start-session', data);
    return res.data.data.session as AttendanceSession;
  },

  endSession: async (sessionId: string) => {
    const res = await api.post(`/attendance/end-session/${sessionId}`);
    return res.data;
  },

  refreshQR: async (sessionId: string): Promise<{ qrCodeData: string; dynamicCode: string; qrRefreshSeconds?: number; refreshedAt: string }> => {
    const res = await api.post(`/attendance/refresh-qr/${sessionId}`);
    return res.data.data;
  },

  getLiveSession: async (sessionId: string) => {
    const res = await api.get(`/attendance/live/${sessionId}`);
    return res.data.data;
  },

  getTeacherSessions: async () => {
    const res = await api.get('/attendance/teacher/sessions');
    return res.data.data.sessions as AttendanceSession[];
  },

  // Student
  findSessionByCode: async (dynamicCode: string) => {
    const res = await api.get(`/attendance/session/${encodeURIComponent(dynamicCode)}`);
    return res.data.data;
  },

  validateQR: async (data: { sessionId: string; secureToken: string }) => {
    const res = await api.post('/attendance/validate-qr', data);
    return res.data.data;
  },

  beginOfflineSync: async (data: { sessionId: string; qrToken: string }) => {
    const res = await api.post('/attendance/sync-offline/begin', data);
    return res.data.data;
  },

  syncOfflineAttendance: async (records: Array<{
    sessionId: string;
    qrToken: string;
    timestamp: string;
    challengeToken: string;
    livenessProof: LivenessProof;
    latitude?: number;
    longitude?: number;
  }>) => {
    const res = await api.post('/attendance/sync-offline', { records });
    return res.data.data;
  },

  getAttendanceHistory: async (params?: { subjectId?: string; page?: number; limit?: number }) => {
    const res = await api.get('/attendance/history', { params });
    return res.data.data;
  },

  getActiveSessions: async () => {
    const res = await api.get('/attendance/active');
    return res.data.data.sessions as AttendanceSession[];
  },

  raiseDispute: async (recordId: string, reason?: string) => {
    const res = await api.post(`/attendance/dispute/${recordId}`, { reason });
    return res.data;
  },

  getAttendanceSummary: async () => {
    const res = await api.get('/attendance/summary');
    return res.data.data;
  },

  getAttendanceReceipt: async (sessionId: string) => {
    const res = await api.get(`/attendance/receipt/${sessionId}`);
    return res.data.data;
  },

  // Facial Recognition
  registerFace: async (livenessProof: LivenessProof) => {
    const res = await api.post('/attendance/face/register', { livenessProof });
    return res.data;
  },

  retryFaceChallenge: async (data: { sessionId: string; challengeToken: string }) => {
    const res = await api.post('/attendance/face/retry-challenge', data);
    return res.data.data;
  },

  verifyAttendanceWithFace: async (data: {
    sessionId: string;
    subjectId: string;
    challengeToken: string;
    livenessProof: LivenessProof;
    latitude?: number;
    longitude?: number;
  }) => {
    const res = await api.post('/attendance/face/verify', data);
    return res.data;
  },
};
