import api from '@/lib/axios';
import { User, Subject, Timetable, DashboardStats } from '@/types';

export const adminService = {
  // Dashboard
  getDashboardStats: async (): Promise<DashboardStats> => {
    const res = await api.get('/admin/dashboard');
    return res.data.data;
  },

  // Teachers
  getTeachers: async (params?: { search?: string; page?: number; limit?: number }) => {
    const res = await api.get('/admin/teachers', { params });
    return res.data.data;
  },
  createTeacher: async (data: Partial<User> & { password: string }) => {
    const res = await api.post('/admin/teachers', data);
    return res.data.data;
  },
  updateTeacher: async (id: string, data: Partial<User>) => {
    const res = await api.put(`/admin/teachers/${id}`, data);
    return res.data.data;
  },
  deleteTeacher: async (id: string) => { const res = await api.delete(`/admin/teachers/${id}`); return res.data; },
  activateTeacher: async (id: string) => { const res = await api.patch(`/admin/teachers/${id}/activate`); return res.data; },
  hardDeleteTeacher: async (id: string) => { const res = await api.delete(`/admin/teachers/${id}/permanent`); return res.data; },

  // Students
  getStudents: async (params?: { search?: string; department?: string; year?: number; section?: string; page?: number; limit?: number }) => {
    const res = await api.get('/admin/students', { params });
    return res.data.data;
  },
  createStudent: async (data: Partial<User> & { password: string }) => {
    const res = await api.post('/admin/students', data);
    return res.data.data;
  },
  updateStudent: async (id: string, data: Partial<User>) => {
    const res = await api.put(`/admin/students/${id}`, data);
    return res.data.data;
  },
  deleteStudent: async (id: string) => { const res = await api.delete(`/admin/students/${id}`); return res.data; },
  activateStudent: async (id: string) => { const res = await api.patch(`/admin/students/${id}/activate`); return res.data; },
  hardDeleteStudent: async (id: string) => { const res = await api.delete(`/admin/students/${id}/permanent`); return res.data; },

  // Subjects
  getSubjects: async () => {
    const res = await api.get('/admin/subjects');
    return res.data.data.subjects as Subject[];
  },
  searchSubjects: async (params: { q?: string; department?: string; year?: number; section?: string }) => {
    const res = await api.get('/admin/subjects/search', { params });
    return res.data.data.subjects as Subject[];
  },
  createSubject: async (data: Partial<Subject>) => {
    const res = await api.post('/admin/subjects', data);
    return res.data.data.subject as Subject;
  },
  updateSubject: async (id: string, data: Partial<Subject>) => {
    const res = await api.put(`/admin/subjects/${id}`, data);
    return res.data.data.subject as Subject;
  },
  deleteSubject: async (id: string) => { const res = await api.delete(`/admin/subjects/${id}`); return res.data; },
  hardDeleteSubject: async (id: string) => { const res = await api.delete(`/admin/subjects/${id}/permanent`); return res.data; },

  // Timetables
  getTimetables: async () => {
    const res = await api.get('/admin/timetables');
    return res.data.data.timetables as Timetable[];
  },
  createTimetable: async (data: Partial<Timetable>) => {
    const res = await api.post('/admin/timetables', data);
    return res.data.data.timetable as Timetable;
  },
  updateTimetable: async (id: string, data: Partial<Timetable>) => {
    const res = await api.put(`/admin/timetables/${id}`, data);
    return res.data.data.timetable as Timetable;
  },
  deleteTimetable: async (id: string) => { const res = await api.delete(`/admin/timetables/${id}`); return res.data; },

  // Reports (per-student breakdown)
  getReports: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await api.get('/admin/reports', { params });
    return res.data.data;
  },

  // Audit logs
  getAuditLogs: async (params?: { page?: number; limit?: number; action?: string; resource?: string }) => {
    const res = await api.get('/admin/audit-logs', { params });
    return res.data.data;
  },

  // Disputes / corrections
  getDisputes: async (params?: { status?: string; page?: number; limit?: number }) => {
    const res = await api.get('/admin/disputes', { params });
    return res.data.data;
  },
  resolveDispute: async (id: string, verificationStatus: 'verified' | 'rejected') => {
    const res = await api.patch(`/admin/disputes/${id}`, { verificationStatus });
    return res.data;
  },

  // Role/dept editing
  updateUserRoleDept: async (id: string, data: { role?: string; department?: string }) => {
    const res = await api.patch(`/admin/users/${id}/role-dept`, data);
    return res.data.data.user as User;
  },
};
