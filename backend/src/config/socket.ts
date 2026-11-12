import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

export const setupSocketIO = (io: Server): void => {
  // Auth middleware for socket
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`[socket] Connected: ${socket.id} (User: ${socket.userId})`);

    // Join role-based rooms
    if (socket.userRole) {
      socket.join(`role:${socket.userRole}`);
    }
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // Teacher joins session room
    socket.on('join:session', (sessionId: string) => {
      socket.join(`session:${sessionId}`);
      console.log(`[socket] User ${socket.userId} joined session ${sessionId}`);
    });

    // Student joins session for live updates
    socket.on('watch:session', (sessionId: string) => {
      socket.join(`session:${sessionId}:watchers`);
    });

    // Security/admin joins the visitor gate room for live updates
    socket.on('join:visitor-gate', () => {
      socket.join('visitor:gate');
      console.log(`[socket] User ${socket.userId} (${socket.userRole}) joined visitor gate room`);
    });

    socket.on('disconnect', () => {
      console.log(`[socket] Disconnected: ${socket.id}`);
    });
  });
};

export const emitToSession = (io: Server, sessionId: string, event: string, data: any): void => {
  io.to(`session:${sessionId}`).emit(event, data);
};

export const emitToUser = (io: Server, userId: string, event: string, data: any): void => {
  io.to(`user:${userId}`).emit(event, data);
};
