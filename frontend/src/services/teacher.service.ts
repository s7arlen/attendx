import api from '@/lib/axios';
import { Subject, Timetable, AttendanceSession } from '@/types';

export const teacherService = {
  getMySubjects: async (): Promise<Subject[]> => {
    const res = await api.get('/teacher/subjects');
    return res.data.data.subjects;
  },

  getMyTimetable: async (): Promise<Timetable[]> => {
    const res = await api.get('/teacher/timetable');
    return res.data.data.timetable;
  },

  getActiveSessions: async (): Promise<AttendanceSession[]> => {
    const res = await api.get('/teacher/sessions/active');
    return res.data.data.sessions;
  },

  getSessionReport: async (sessionId: string) => {
    const res = await api.get(`/teacher/sessions/${sessionId}/report`);
    return res.data.data;
  },

  getSubjectAttendance: async (subjectId: string) => {
    const res = await api.get(`/teacher/subjects/${subjectId}/attendance`);
    return res.data.data;
  },
};
