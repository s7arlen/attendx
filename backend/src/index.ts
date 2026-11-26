process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '16';

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDB } from './config/database';
import { setupSocketIO } from './config/socket';
import { generalLimiter } from './middleware/rateLimiter';
import { authenticate, authorize } from './middleware/auth.middleware';
import { getAllowedOrigins, hashSha256, safeEqualHex, validateSecurityEnv } from './utils/security';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import teacherRoutes from './routes/teacher.routes';
import studentRoutes from './routes/student.routes';
import attendanceRoutes from './routes/attendance.routes';
import analyticsRoutes from './routes/analytics.routes';
import webauthnRoutes from './routes/webauthn.routes';
import notificationsRoutes from './routes/notifications.routes';
import uploadRoutes from './routes/upload.routes';
import visitorRoutes from './routes/visitor.routes';
import academicRoutes from './routes/academic.routes';
import chatbotRoutes from './routes/chatbot.routes';
import { errorHandler } from './middleware/errorHandler';
import { startAttendanceAlertJob } from './jobs/attendanceAlert';
import { startAutoSessionJob } from './jobs/autoSession';

dotenv.config();

const app = express();

// Trust Render/proxy headers so rate limiter can identify real client IPs
app.set('trust proxy', 1);

const httpServer = createServer(app);

const allowedOrigins = getAllowedOrigins();
const corsOriginCallback = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) => {
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    callback(new Error('Origin not allowed by CORS'));
  }
};

const io = new Server(httpServer, {
  cors: {
    origin: corsOriginCallback,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Setup Socket.IO
setupSocketIO(io);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: corsOriginCallback,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded avatar files safely
app.use('/uploads', (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}, express.static('uploads', { dotfiles: 'deny' }));

// Rate limiting
app.use('/api/', generalLimiter);

// Make io available to routes
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/auth/webauthn', webauthnRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/visitor', visitorRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/chatbot', chatbotRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), service: 'AttendX API' });
});

// Manual trigger for attendance alert or auto sessions (admin JWT OR dedicated CRON_TRIGGER_SECRET)
const verifyTriggerAuth = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const secretHeader = req.headers['x-trigger-secret'];
  const configuredSecret = process.env.CRON_TRIGGER_SECRET;
  if (
    configuredSecret &&
    configuredSecret.length >= 16 &&
    typeof secretHeader === 'string' &&
    safeEqualHex(hashSha256(secretHeader), hashSha256(configuredSecret))
  ) {
    next();
    return;
  }

  authenticate(req as any, res, () => {
    authorize('admin')(req as any, res, next);
  });
};

app.post('/admin-trigger/attendance-alert', verifyTriggerAuth, async (_req, res) => {
  const { checkAndAlert } = await import('./jobs/attendanceAlert');
  await checkAndAlert();
  res.json({ success: true, message: 'Attendance alert job triggered manually' });
});

app.post('/admin-trigger/auto-session', verifyTriggerAuth, async (_req, res) => {
  const { autoStartSessions, autoEndSessions } = await import('./jobs/autoSession');
  await autoStartSessions();
  await autoEndSessions();
  res.json({ success: true, message: 'Auto session check triggered manually' });
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  validateSecurityEnv();
  await connectDB();
  httpServer.listen(PORT, () => {
    console.log(`[server] AttendX running on port ${PORT}`);
    console.log(`[server] Socket.IO enabled`);
    console.log(`[server] Environment: ${process.env.NODE_ENV}`);
  });

  // Start cron jobs
  startAttendanceAlertJob();
  startAutoSessionJob();
};

startServer();

export { io };
