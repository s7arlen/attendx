import api from '@/lib/axios';
import { User } from '@/types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: 'teacher' | 'student';
  department: string;
  year?: number;
  section?: string;
  rollNumber?: string;
  phone?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export const authService = {
  login: async (data: LoginPayload): Promise<AuthResponse> => {
    const res = await api.post('/auth/login', data);
    return res.data.data;
  },

  register: async (data: RegisterPayload): Promise<AuthResponse> => {
    const res = await api.post('/auth/register', data);
    return res.data.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  getMe: async (): Promise<User> => {
    const res = await api.get('/auth/me');
    return res.data.data.user;
  },

  refreshToken: async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
    const res = await api.post('/auth/refresh', { refreshToken });
    return res.data.data;
  },

  updateProfile: async (data: Partial<Pick<User, 'name' | 'phone' | 'department' | 'year' | 'section' | 'rollNumber' | 'avatar'>>): Promise<User> => {
    const res = await api.put('/auth/profile', data);
    return res.data.data.user;
  },

  uploadAvatar: async (file: File): Promise<string> => {
    const form = new FormData();
    form.append('avatar', file);
    const res = await api.post('/upload/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data.avatarUrl;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  },

  forgotPassword: async (email: string): Promise<{ devResetCode?: string }> => {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  },

  resetPassword: async (email: string, resetCode: string, newPassword: string): Promise<void> => {
    await api.post('/auth/reset-password', { email, resetCode, newPassword });
  },
};
