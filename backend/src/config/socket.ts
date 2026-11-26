import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { getJwtSecret, isValidObjectId } from '../utils/security';
import { AttendanceSession } from '../models/AttendanceSession.model';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

export const setupSocketIO = (io: Server): void => {
  // Auth middleware for socket
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    if (!token || typeof token !== 'string') {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as any;
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    if (socket.userRole) {
      socket.join(`role:${socket.userRole}`);
    }
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // Teacher/admin joins session room (ownership verified)
    socket.on('join:session', async (sessionId: string) => {
      try {
        if (!isValidObjectId(sessionId) || !['teacher', 'admin'].includes(socket.userRole || '')) return;
        if (socket.userRole === 'teacher') {
          const session = await AttendanceSession.findOne({
            _id: sessionId,
            $or: [{ teacherId: socket.userId }, { coHosts: socket.userId }],
          }).select('_id');
          if (!session) return;
        }
        socket.join(`session:${sessionId}`);
      } catch { /* ignore invalid join */ }
    });

    // Student joins session watchers room
    socket.on('watch:session', (sessionId: string) => {
      if (!isValidObjectId(sessionId)) return;
      socket.join(`session:${sessionId}:watchers`);
    });

    // Security/admin joins the visitor gate room
    socket.on('join:visitor-gate', () => {
      if (!['security', 'admin'].includes(socket.userRole || '')) return;
      socket.join('visitor:gate');
    });

    socket.on('disconnect', () => {});
  });
};

export const emitToSession = (io: Server, sessionId: string, event: string, data: any): void => {
  io.to(`session:${sessionId}`).emit(event, data);
};

export const emitToUser = (io: Server, userId: string, event: string, data: any): void => {
  io.to(`user:${userId}`).emit(event, data);
};
