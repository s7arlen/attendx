import api from '@/lib/axios';
import { Subject } from '@/types';

export const studentService = {
  getMySubjects: async (): Promise<Subject[]> => {
    const res = await api.get('/student/subjects');
    return res.data.data.subjects;
  },

  getMyAttendance: async () => {
    const res = await api.get('/student/attendance');
    return res.data.data;
  },

  getDashboard: async () => {
    const res = await api.get('/student/dashboard');
    return res.data.data;
  },
};
