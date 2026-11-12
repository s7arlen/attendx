import { Notification } from '../models/Notification.model';

export const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info',
  link?: string
): Promise<void> => {
  try {
    await Notification.create({ userId, title, message, type, link });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};
