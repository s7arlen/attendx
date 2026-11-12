import api from '@/lib/axios';
import { AdminAnalytics, TeacherAnalytics, StudentAnalytics } from '@/types';

export const analyticsService = {
  getAdminAnalytics: async (): Promise<AdminAnalytics> => {
    const res = await api.get('/analytics/admin');
    return res.data.data;
  },

  getTeacherAnalytics: async (): Promise<TeacherAnalytics> => {
    const res = await api.get('/analytics/teacher');
    return res.data.data;
  },

  getStudentAnalytics: async (): Promise<StudentAnalytics> => {
    const res = await api.get('/analytics/student');
    return res.data.data;
  },
};
