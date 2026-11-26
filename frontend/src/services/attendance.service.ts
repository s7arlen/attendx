import api from '@/lib/axios';
import { AttendanceSession } from '@/types';

export const attendanceService = {
  // Teacher
  startSession: async (data: {
    subjectId: string;
    duration?: number;
    geoFence?: { latitude: number; longitude: number; radiusMeters: number } | null;
  }) => {
    const res = await api.post('/attendance/start-session', data);
    return res.data.data.session as AttendanceSession;
  },

  endSession: async (sessionId: string) => {
    const res = await api.post(`/attendance/end-session/${sessionId}`);
    return res.data;
  },

  refreshQR: async (sessionId: string): Promise<{ qrCodeData: string; qrToken: string; qrRefreshSeconds?: number; refreshedAt: string }> => {
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
  findSessionByCode: async (sessionCode: string) => {
    const res = await api.get(`/attendance/session/${encodeURIComponent(sessionCode)}`);
    return res.data.data;
  },

  validateQR: async (data: { sessionId: string; secureToken: string }) => {
    const res = await api.post('/attendance/validate-qr', data);
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
  registerFace: async (faceDescriptor: number[]) => {
    const res = await api.post('/attendance/face/register', { faceDescriptor });
    return res.data;
  },

  verifyAttendanceWithFace: async (data: {
    sessionId: string;
    subjectId: string;
    secureToken: string;
    faceDescriptor: number[];
    latitude?: number;
    longitude?: number;
  }) => {
    const res = await api.post('/attendance/face/verify', data);
    return res.data;
  },
};
