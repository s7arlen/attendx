import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.model';
import { getJwtSecret } from '../utils/security';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
    email: string;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Access token required' });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
    }) as {
      userId: string;
      role: string;
      email: string;
    };

    const user = await User.findById(decoded.userId).select('-passwordHash -refreshToken -passwordResetToken -passwordResetExpires');
    if (!user || !user.isActive) {
      res.status(401).json({ success: false, message: 'User not found or inactive' });
      return;
    }

    req.user = { userId: decoded.userId, role: user.role, email: user.email };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
      return;
    }
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }
    next();
  };
};
