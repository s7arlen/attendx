import { AuditLog } from '../models/AuditLog.model';
import { Request } from 'express';
import { getTrustedClientIp } from './security';

export const createAuditLog = async (
  userId: string,
  action: string,
  resource: string,
  resourceId?: string,
  metadata?: Record<string, any>,
  ipAddress?: string
): Promise<void> => {
  try {
    await AuditLog.create({
      userId,
      action,
      resource,
      resourceId,
      metadata,
      ipAddress,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
};

export const getClientIp = (req: Request): string => {
  return getTrustedClientIp(req);
};
