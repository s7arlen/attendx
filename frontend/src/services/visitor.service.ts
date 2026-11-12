import api from '@/lib/axios';
import {
  VisitorDashboardStats, VisitorVisit, VisitorPass,
  VisitorLog, VisitorEvent, Visitor, VisitorAnalytics,
} from '@/types';

export const visitorService = {
  // Dashboard
  getDashboard: async (): Promise<VisitorDashboardStats> => {
    const res = await api.get('/visitor/dashboard');
    return res.data.data;
  },

  // Visits
  getAllVisits: async (params?: { status?: string; date?: string; search?: string; today?: string; page?: number; limit?: number }) => {
    const res = await api.get('/visitor/visits', { params });
    return res.data.data as { visits: VisitorVisit[]; total: number; page: number; limit: number };
  },

  getMyRequests: async (params?: { status?: string }) => {
    const res = await api.get('/visitor/my-requests', { params });
    return res.data.data.visits as VisitorVisit[];
  },

  getVisitById: async (visitId: string) => {
    const res = await api.get(`/visitor/visits/${visitId}`);
    return res.data.data as { visit: VisitorVisit; pass?: VisitorPass };
  },

  registerVisitor: async (data: Record<string, unknown>) => {
    const res = await api.post('/visitor/register', data);
    return res.data.data.visit as VisitorVisit;
  },

  approveVisit: async (visitId: string) => {
    const res = await api.patch(`/visitor/visits/${visitId}/approve`);
    return res.data;
  },

  rejectVisit: async (visitId: string, reason?: string) => {
    const res = await api.patch(`/visitor/visits/${visitId}/reject`, { reason });
    return res.data;
  },

  // Passes
  getAllPasses: async (params?: { status?: string; page?: number; limit?: number }) => {
    const res = await api.get('/visitor/passes', { params });
    return res.data.data as { passes: VisitorPass[]; total: number };
  },

  getVisitPass: async (visitId: string) => {
    const res = await api.get(`/visitor/visits/${visitId}/pass`);
    return res.data.data.pass as VisitorPass;
  },

  lookupByPassCode: async (passCode: string) => {
    const res = await api.get(`/visitor/passes/lookup/${passCode.toUpperCase()}`);
    return res.data.data.pass as VisitorPass;
  },

  revokePass: async (passId: string, reason?: string) => {
    const res = await api.patch(`/visitor/passes/${passId}/revoke`, { reason });
    return res.data;
  },

  // Gate scanning
  scanQR: async (data: { passCode: string; action: 'entry' | 'exit' }) => {
    const res = await api.post('/visitor/scan', data);
    return res.data;
  },

  // Currently inside
  getCurrentlyInside: async () => {
    const res = await api.get('/visitor/currently-inside');
    return res.data.data as { visits: VisitorVisit[]; total: number };
  },

  // History
  getHistory: async (params?: { date?: string; action?: string; page?: number; limit?: number }) => {
    const res = await api.get('/visitor/history', { params });
    return res.data.data as { logs: VisitorLog[]; total: number };
  },

  // Analytics
  getAnalytics: async (): Promise<VisitorAnalytics> => {
    const res = await api.get('/visitor/analytics');
    return res.data.data;
  },

  // Visitors directory
  getVisitors: async (params?: { search?: string; page?: number; limit?: number }) => {
    const res = await api.get('/visitor/visitors', { params });
    return res.data.data as { visitors: Visitor[]; total: number };
  },

  toggleBlacklist: async (visitorId: string, blacklist: boolean, reason?: string) => {
    const res = await api.patch(`/visitor/visitors/${visitorId}/blacklist`, { blacklist, reason });
    return res.data;
  },

  // Events
  getEvents: async () => {
    const res = await api.get('/visitor/events');
    return res.data.data.events as VisitorEvent[];
  },

  createEvent: async (data: Record<string, unknown>) => {
    const res = await api.post('/visitor/events', data);
    return res.data.data.event as VisitorEvent;
  },

  updateEvent: async (id: string, data: Record<string, unknown>) => {
    const res = await api.put(`/visitor/events/${id}`, data);
    return res.data.data.event as VisitorEvent;
  },

  deleteEvent: async (id: string) => {
    const res = await api.delete(`/visitor/events/${id}`);
    return res.data;
  },

  // Hosts for form dropdown
  getHosts: async () => {
    const res = await api.get('/visitor/hosts');
    return res.data.data.hosts as { _id: string; name: string; email: string; department: string; role: string }[];
  },
};
