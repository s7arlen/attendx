import api from '@/lib/axios';

export interface AppNotification {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  link?: string;
  createdAt: string;
}

export const notificationService = {
  getNotifications: async (): Promise<{ notifications: AppNotification[]; unread: number }> => {
    const res = await api.get('/notifications');
    return res.data.data;
  },
  markRead: async (): Promise<void> => {
    await api.post('/notifications/mark-read');
  },
};
