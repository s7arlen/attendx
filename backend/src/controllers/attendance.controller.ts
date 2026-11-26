import { Request, Response } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { Server } from 'socket.io';
import { AuthRequest } from '../middleware/auth.middleware';
import { AttendanceSession, IAttendanceSession } from '../models/AttendanceSession.model';
import { AttendanceRecord } from '../models/AttendanceRecord.model';
import { Subject } from '../models/Subject.model';
import { User } from '../models/User.model';
import {
  getSystemSettings,
  MIN_QR_REFRESH_SECONDS,
  MAX_QR_REFRESH_SECONDS,
} from '../models/SystemSettings.model';
import { generateSessionAssets, generateFreshQR } from '../utils/qrGenerator';
import { createAuditLog, getClientIp } from '../utils/auditLogger';
import { emitToSession } from '../config/socket';
import {
  clampPagination,
  isValidObjectId,
  sanitizeCsvCell,
  checkGeoFence,
  hashSha256,
  safeEqualHex,
  getJwtSecret,
} from '../utils/security';
import {
  evaluateSessionWindow,
  getSecondsUntilNextRefresh,
  isValidDynamicClassroomCode,
  isValidSessionQrToken,
  resolveQrRefreshSeconds,
} from '../utils/qrSession';
import { evaluateFaceMatch, verifyLivenessProof } from '../utils/faceSecurity';
import {
  checkStudentSessionEligibility,
  consumeChallengeAtomically,
  detectSameDeviceCollusion,
  getNormalizedDeviceId,
  incrementChallengeFailure,
  issueAttendanceChallenge,
  validateActiveChallenge,
  VERIFIED_ATTENDANCE_FILTER,
} from '../utils/attendanceHelper';

const geoFenceSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.coerce.number().int().min(10).max(5000).default(150),
}).nullable().optional();

const startSessionSchema = z.object({
  subjectId: z.string().refine(isValidObjectId, 'Invalid subject ID'),
  duration: z.coerce.number().int().min(1).max(300).default(15),
  sessionType: z.enum(['class', 'seminar', 'workshop', 'event', 'lab']).default('class'),
  capacity: z.coerce.number().int().min(1).max(5000).nullable().optional().default(null),
  verificationMode: z.enum(['strict', 'open', 'invite']).default('strict'),
  gracePeriodMinutes: z.coerce.number().int().min(0).max(60).default(0),
  qrRefreshSeconds: z.coerce.number().int().min(MIN_QR_REFRESH_SECONDS).max(MAX_QR_REFRESH_SECONDS).optional(),
  title: z.string().max(150).nullable().optional().default(null),
  venue: z.string().max(150).nullable().optional().default(null),
  inviteList: z.array(z.string().max(40)).max(500).optional().default([]),
  coHosts: z.array(z.string().refine(isValidObjectId, 'Invalid co-host ID')).max(20).optional().default([]),
  geoFence: geoFenceSchema,
});

function buildSessionAccessFilter(sessionId: string, req: AuthRequest) {
  if (req.user!.role === 'admin') {
    return { _id: sessionId };
  }
  return {
    _id: sessionId,
    $or: [
      { teacherId: req.user!.userId },
      { coHosts: req.user!.userId },
    ],
  };
}

/**
 * Atomically rotates the active session QR token + dynamic classroom code when the
 * configured refresh interval has elapsed, and emits `qr:refreshed` via Socket.IO.
 */
async function rotateSessionQrIfDue<T extends IAttendanceSession>(
  req: Request,
  session: T,
  earlyLeewayMs = 500
): Promise<T> {
  const refreshSeconds = resolveQrRefreshSeconds(session.qrRefreshSeconds);
  const effectiveExpiry = new Date(
    session.expiryTime.getTime() + (session.gracePeriodMinutes || 0) * 60 * 1000
  );
  const now = new Date();
  const lastRefreshedMs = session.qrLastRefreshedAt
    ? new Date(session.qrLastRefreshedAt).getTime()
    : new Date(session.createdAt).getTime();

  if (
    session.status !== 'active' ||
    now > effectiveExpiry ||
    now.getTime() - lastRefreshedMs < refreshSeconds * 1000 - earlyLeewayMs
  ) {
    return session;
  }

  const cutoff = new Date(now.getTime() - refreshSeconds * 1000 + earlyLeewayMs);
  const subjectIdStr = (session.subjectId as any)?._id?.toString() ?? session.subjectId.toString();
  const { secureToken, dynamicCode, qrCodeData } = await generateFreshQR(session._id.toString(), subjectIdStr);

  const updated = await AttendanceSession.findOneAndUpdate(
    {
      _id: session._id,
      status: 'active',
      $or: [
        { qrLastRefreshedAt: { $lte: cutoff } },
        { qrLastRefreshedAt: null },
      ],
    },
    {
      $set: {
        previousQrToken: session.qrToken,
        previousDynamicCode: session.dynamicCode,
        qrTokenRotatedAt: now,
        qrLastRefreshedAt: now,
        qrToken: secureToken,
        dynamicCode,
        qrCodeData,
      },
      $push: {
        issuedTokenHashes: {
          $each: [{ hash: hashSha256(secureToken), issuedAt: now }],
          $slice: -120,
        },
      },
    },
    { new: true }
  )
    .select('-issuedTokenHashes')
    .populate('subjectId', 'subjectName subjectCode department year section');

  if (updated) {
    const io: Server = req.app.get('io');
    if (io) {
      emitToSession(io, session._id.toString(), 'qr:refreshed', {
        sessionId: session._id.toString(),
        qrCodeData,
        dynamicCode,
        qrRefreshSeconds: refreshSeconds,
        refreshedAt: now.toISOString(),
      });
    }
    return updated as unknown as T;
  }

  const latest = await AttendanceSession.findById(session._id)
    .select('-issuedTokenHashes')
    .populate('subjectId', 'subjectName subjectCode department year section');
  return (latest as unknown as T) || session;
}

async function isAuthorizedForProjector(req: Request, projectorSecret?: string | null): Promise<boolean> {
  const key = typeof req.query?.key === 'string' ? req.query.key.trim() : '';
  if (key && projectorSecret && safeEqualHex(hashSha256(key), hashSha256(projectorSecret))) {
    return true;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.substring(7), getJwtSecret(), { algorithms: ['HS256'] }) as {
        userId: string;
      };
      const user = await User.findById(decoded.userId).select('role isActive');
      if (user && user.isActive && (user.role === 'teacher' || user.role === 'admin')) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
}

// ── TEACHER: START SESSION ────────────────────────────────────────────────────
export const startSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = startSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid session parameters', errors: parsed.error.issues });
      return;
    }

    const {
      subjectId,
      duration,
      sessionType,
      capacity,
      verificationMode,
      gracePeriodMinutes,
      qrRefreshSeconds,
      title,
      venue,
      inviteList,
      coHosts,
      geoFence,
    } = parsed.data;

    const subject = await Subject.findById(subjectId);
    if (!subject) {
      res.status(404).json({ success: false, message: 'Subject not found' });
      return;
    }

    if (req.user!.role !== 'admin' && subject.assignedTeacher.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Not authorized for this subject' });
      return;
    }

    const existingSession = await AttendanceSession.findOne({
      subjectId,
      teacherId: req.user!.userId,
      status: 'active',
    });
    if (existingSession) {
      res.status(409).json({ success: false, message: 'An active session already exists for this subject' });
      return;
    }

    const newId = new mongoose.Types.ObjectId();
    const sessionIdStr = newId.toString();

    const { secureToken, sessionCode, dynamicCode, projectorSecret, qrCodeData } =
      await generateSessionAssets(sessionIdStr, subjectId, subject.subjectCode);

    const settings = await getSystemSettings();
    const resolvedQrRefresh = qrRefreshSeconds ?? settings.qrRefreshSeconds;

    const startTime = new Date();
    const expiryTime = new Date(startTime.getTime() + duration * 60 * 1000);

    const session = await AttendanceSession.create({
      _id: newId,
      subjectId,
      teacherId: req.user!.userId,
      sessionCode,
      dynamicCode,
      projectorSecret,
      qrToken: secureToken,
      qrCodeData,
      issuedTokenHashes: [{ hash: hashSha256(secureToken), issuedAt: startTime }],
      startTime,
      expiryTime,
      status: 'active',
      duration,
      sessionType,
      capacity: capacity ?? null,
      verificationMode,
      gracePeriodMinutes,
      qrRefreshSeconds: resolvedQrRefresh,
      qrLastRefreshedAt: startTime,
      title: title || null,
      venue: venue || null,
      inviteList: inviteList.map((r) => r.trim().toUpperCase()),
      coHosts,
      geoFence: geoFence ?? null,
    });

    const populated = await AttendanceSession.findById(session._id)
      .select('-issuedTokenHashes')
      .populate('subjectId', 'subjectName subjectCode department year section');

    await createAuditLog(
      req.user!.userId, 'START_SESSION', 'AttendanceSession', sessionIdStr,
      { subjectId, duration, sessionType, verificationMode }, getClientIp(req)
    );

    try {
      const { createNotification } = await import('../utils/notificationHelper');
      const students = await User.find({
        role: 'student',
        department: subject.department,
        year: subject.year,
        section: subject.section,
        isActive: true,
      }).select('_id');

      await Promise.all(students.map(s =>
        createNotification(
          s._id.toString(),
          'Attendance Session Live',
          `${subject.subjectName} attendance is now open. Scan the live QR or enter the rotating code on your teacher's screen.`,
          'info',
          '/student/scan'
        )
      ));
    } catch { /* non-blocking */ }

    res.status(201).json({
      success: true,
      message: 'Session started',
      data: { session: populated, serverNow: startTime.toISOString() },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to start session' });
  }
};

// ── TEACHER: REFRESH QR TOKEN + ROTATING CODE ─────────────────────────────────
export const refreshQR = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    if (!isValidObjectId(sessionId)) {
      res.status(400).json({ success: false, message: 'Invalid session ID' });
      return;
    }

    const session = await AttendanceSession.findOne({
      ...buildSessionAccessFilter(sessionId, req),
      status: 'active',
    }).populate('subjectId', 'subjectName subjectCode department year section');

    if (!session) {
      res.status(404).json({ success: false, message: 'Active session not found' });
      return;
    }

    const windowCheck = evaluateSessionWindow(session);
    if (!windowCheck.valid) {
      session.status = 'expired';
      await session.save();
      res.status(400).json({ success: false, message: windowCheck.reason || 'Session has expired' });
      return;
    }

    const { secureToken, dynamicCode, qrCodeData } = await generateFreshQR(
      sessionId,
      (session.subjectId as any)._id?.toString() ?? session.subjectId.toString()
    );

    const now = new Date();
    const tokenHash = hashSha256(secureToken);
    const updated = await AttendanceSession.findOneAndUpdate(
      { _id: session._id, status: 'active' },
      {
        $set: {
          previousQrToken: session.qrToken,
          previousDynamicCode: session.dynamicCode,
          qrTokenRotatedAt: now,
          qrLastRefreshedAt: now,
          qrToken: secureToken,
          dynamicCode,
          qrCodeData,
        },
        $push: {
          issuedTokenHashes: {
            $each: [{ hash: tokenHash, issuedAt: now }],
            $slice: -120,
          },
        },
      },
      { new: true }
    );

    const refreshSeconds = resolveQrRefreshSeconds(updated?.qrRefreshSeconds ?? session.qrRefreshSeconds);
    const io: Server = req.app.get('io');
    if (io) {
      emitToSession(io, sessionId, 'qr:refreshed', {
        sessionId,
        qrCodeData,
        dynamicCode,
        qrRefreshSeconds: refreshSeconds,
        refreshedAt: now.toISOString(),
      });
    }

    res.json({
      success: true,
      data: {
        qrCodeData,
        dynamicCode,
        qrRefreshSeconds: refreshSeconds,
        refreshedAt: now.toISOString(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to refresh QR' });
  }
};

// ── TEACHER: END SESSION ──────────────────────────────────────────────────────
export const endSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    if (!isValidObjectId(sessionId)) {
      res.status(400).json({ success: false, message: 'Invalid session ID' });
      return;
    }

    const session = await AttendanceSession.findOne({
      ...buildSessionAccessFilter(sessionId, req),
      status: 'active',
    });

    if (!session) {
      res.status(404).json({ success: false, message: 'Active session not found' });
      return;
    }

    session.status = 'ended';
    await session.save();

    const io: Server = req.app.get('io');
    if (io) {
      emitToSession(io, sessionId, 'session:ended', { sessionId, message: 'Session ended by teacher' });
    }

    await createAuditLog(req.user!.userId, 'END_SESSION', 'AttendanceSession', sessionId, {}, getClientIp(req));

    const { Notification } = await import('../models/Notification.model');
    const subjectDoc = await Subject.findById(session.subjectId);
    await Notification.create({
      userId: req.user!.userId,
      title: 'Session Ended',
      message: `Attendance session for ${subjectDoc?.subjectName ?? 'your subject'} ended. ${session.totalPresent} student(s) marked present.`,
      type: 'info',
      link: `/teacher/sessions/${sessionId}`,
    });

    res.json({ success: true, message: 'Session ended', data: { session } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to end session' });
  }
};

// ── TEACHER: GET LIVE SESSION ─────────────────────────────────────────────────
export const getLiveSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    if (!isValidObjectId(sessionId)) {
      res.status(400).json({ success: false, message: 'Invalid session ID' });
      return;
    }

    let session = await AttendanceSession.findOne(buildSessionAccessFilter(sessionId, req))
      .select('-issuedTokenHashes')
      .populate('subjectId', 'subjectName subjectCode department year section');

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    session = await rotateSessionQrIfDue(req, session, 500);

    const attendanceRecords = await AttendanceRecord.find({
      sessionId,
      ...VERIFIED_ATTENDANCE_FILTER,
    })
      .populate('studentId', 'name email rollNumber year section')
      .sort({ timestamp: -1 });

    let absentStudents: any[] = [];
    if (session.verificationMode === 'strict') {
      const subject = session.subjectId as any;
      const enrolled = await User.find({
        role: 'student',
        department: subject.department,
        year: subject.year,
        section: subject.section,
        isActive: true,
      }).select('name rollNumber email year section');

      const presentIds = new Set(attendanceRecords.map(r => (r.studentId as any)?._id?.toString() ?? r.studentId.toString()));
      absentStudents = enrolled.filter(s => !presentIds.has(s._id.toString()));
    }

    const nowMs = Date.now();
    res.json({
      success: true,
      data: {
        session,
        attendanceRecords,
        totalPresent: attendanceRecords.length,
        absentStudents,
        absentCount: absentStudents.length,
        serverNow: new Date(nowMs).toISOString(),
        nextRefreshInSeconds: getSecondsUntilNextRefresh(session, nowMs),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load live session' });
  }
};

// ── CLASSROOM PROJECTOR VIEW (requires ?key=projectorSecret or teacher/admin JWT) ──
export const getProjectorSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionCode } = req.params;
    if (!sessionCode || typeof sessionCode !== 'string' || sessionCode.length > 40) {
      res.status(400).json({ success: false, message: 'Invalid session code' });
      return;
    }

    let session = await AttendanceSession.findOne({
      sessionCode: sessionCode.toUpperCase(),
    }).populate('subjectId', 'subjectName subjectCode department year section');

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    const authorized = await isAuthorizedForProjector(req, session.projectorSecret);
    if (!authorized) {
      res.status(401).json({
        success: false,
        message: 'Projector display requires an authorized projector key from the teacher.',
      });
      return;
    }

    session = await rotateSessionQrIfDue(req, session, 500);

    const nowMs = Date.now();
    const resolvedRefreshSeconds = resolveQrRefreshSeconds(session.qrRefreshSeconds);
    const nextRefreshInSeconds = getSecondsUntilNextRefresh(session, nowMs);

    res.json({
      success: true,
      data: {
        sessionCode: session.sessionCode,
        dynamicCode: session.dynamicCode,
        qrCodeData: session.qrCodeData,
        subjectName: (session.subjectId as any)?.subjectName ?? 'Session',
        subjectCode: (session.subjectId as any)?.subjectCode ?? '',
        title: session.title,
        venue: session.venue,
        sessionType: session.sessionType,
        status: session.status,
        startTime: session.startTime,
        expiryTime: session.expiryTime,
        gracePeriodMinutes: session.gracePeriodMinutes,
        qrRefreshSeconds: resolvedRefreshSeconds,
        qrLastRefreshedAt: session.qrLastRefreshedAt,
        nextRefreshInSeconds,
        serverNow: new Date(nowMs).toISOString(),
        totalPresent: session.totalPresent,
        capacity: session.capacity,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load projector view' });
  }
};

// ── TEACHER: GET MY SESSIONS ──────────────────────────────────────────────────
export const getTeacherSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const query = req.user!.role === 'admin' ? {} : { teacherId: req.user!.userId };
    const sessions = await AttendanceSession.find(query)
      .select('-issuedTokenHashes')
      .populate('subjectId', 'subjectName subjectCode')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, data: { sessions } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load sessions' });
  }
};

// ── SESSION REPORT WITH ABSENT LIST ──────────────────────────────────────────
export const getSessionReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    if (!isValidObjectId(sessionId)) {
      res.status(400).json({ success: false, message: 'Invalid session ID' });
      return;
    }

    const session = await AttendanceSession.findOne(buildSessionAccessFilter(sessionId, req))
      .select('-issuedTokenHashes')
      .populate('subjectId', 'subjectName subjectCode department year section');

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    const records = await AttendanceRecord.find({
      sessionId,
      ...VERIFIED_ATTENDANCE_FILTER,
    })
      .populate('studentId', 'name email rollNumber year section department')
      .sort({ timestamp: 1 });

    let absentStudents: any[] = [];
    if (session.verificationMode === 'strict') {
      const subject = session.subjectId as any;
      const enrolled = await User.find({
        role: 'student',
        department: subject.department,
        year: subject.year,
        section: subject.section,
        isActive: true,
      }).select('name rollNumber email year section department');

      const presentIds = new Set(records.map(r => (r.studentId as any)?._id?.toString() ?? r.studentId.toString()));
      absentStudents = enrolled.filter(s => !presentIds.has(s._id.toString()));
    }

    res.json({
      success: true,
      data: {
        session,
        records,
        totalPresent: records.length,
        absentStudents,
        absentCount: absentStudents.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load session report' });
  }
};

// ── SESSION CSV EXPORT ────────────────────────────────────────────────────────
export const exportSessionCSV = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    if (!isValidObjectId(sessionId)) {
      res.status(400).json({ success: false, message: 'Invalid session ID' });
      return;
    }
    const type = ['present', 'absent', 'all'].includes(String(req.query.type)) ? String(req.query.type) : 'present';

    const session = await AttendanceSession.findOne(buildSessionAccessFilter(sessionId, req))
      .select('-issuedTokenHashes')
      .populate('subjectId', 'subjectName subjectCode department year section');

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    const records = await AttendanceRecord.find({
      sessionId,
      ...VERIFIED_ATTENDANCE_FILTER,
    })
      .populate('studentId', 'name email rollNumber year section department')
      .sort({ timestamp: 1 });

    const subjectInfo = session.subjectId as any;
    const rows: string[] = [];
    rows.push('Name,Roll Number,Year,Section,Department,Status,Time,Method,Late');

    if (type !== 'absent') {
      records.forEach(r => {
        const s = r.studentId as any;
        rows.push([
          s?.name || '', s?.rollNumber || '', s?.year || '', s?.section || '', s?.department || '',
          'Present',
          new Date(r.timestamp).toLocaleTimeString(),
          r.verificationMethod || 'biometric',
          r.isLate ? 'Yes' : 'No',
        ].map(sanitizeCsvCell).join(','));
      });
    }

    if (type !== 'present' && session.verificationMode === 'strict') {
      const enrolled = await User.find({
        role: 'student',
        department: subjectInfo.department,
        year: subjectInfo.year,
        section: subjectInfo.section,
        isActive: true,
      }).select('name rollNumber email year section department');

      const presentIds = new Set(records.map(r => (r.studentId as any)?._id?.toString() ?? r.studentId.toString()));
      enrolled
        .filter(s => !presentIds.has(s._id.toString()))
        .forEach(s => {
          rows.push([
            s.name || '', s.rollNumber || '', s.year || '', s.section || '', s.department || '',
            'Absent', '', '', '',
          ].map(sanitizeCsvCell).join(','));
        });
    }

    const csv = rows.join('\n');
    const safeCode = String(subjectInfo.subjectCode || 'session').replace(/[^a-zA-Z0-9_-]/g, '');
    const safeSessCode = String(session.sessionCode || 'export').replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `${safeCode}-${safeSessCode}-${type}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to export CSV' });
  }
};

// ── STUDENT: ATTENDANCE HISTORY ───────────────────────────────────────────────
export const getAttendanceHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subjectId } = req.query;
    const { page, limit, skip } = clampPagination(req.query.page, req.query.limit, 20, 100);
    const query: any = { studentId: req.user!.userId };
    if (subjectId) {
      if (!isValidObjectId(String(subjectId))) {
        res.status(400).json({ success: false, message: 'Invalid subject ID' });
        return;
      }
      query.subjectId = String(subjectId);
    }

    const [records, total] = await Promise.all([
      AttendanceRecord.find(query)
        .populate('subjectId', 'subjectName subjectCode department')
        .populate({
          path: 'sessionId',
          select: 'startTime expiryTime status duration sessionType venue',
        })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      AttendanceRecord.countDocuments(query),
    ]);

    res.json({ success: true, data: { records, total, page, limit } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load attendance history' });
  }
};

// ── STUDENT: ATTENDANCE SUMMARY ───────────────────────────────────────────────
export const getAttendanceSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = req.user!.userId;

    const records = await AttendanceRecord.find({
      studentId,
      ...VERIFIED_ATTENDANCE_FILTER,
    }).populate('subjectId', 'subjectName subjectCode');

    const subjectMap = new Map<string, { subjectName: string; subjectCode: string; present: number }>();
    records.forEach((record) => {
      const subject = record.subjectId as any;
      if (!subject || !subject._id) return;
      const key = subject._id.toString();
      if (!subjectMap.has(key)) {
        subjectMap.set(key, { subjectName: subject.subjectName || 'Unknown Subject', subjectCode: subject.subjectCode || 'N/A', present: 0 });
      }
      subjectMap.get(key)!.present += 1;
    });

    const summaryBySubject = Array.from(subjectMap.entries()).map(([id, data]) => ({ subjectId: id, ...data }));

    res.json({
      success: true,
      data: { totalPresent: records.length, summaryBySubject },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load summary' });
  }
};

// ── STUDENT: FIND SESSION BY LIVE ROTATING DYNAMIC CODE ───────────────────────
export const findSessionByCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const incomingCode = String(req.params.sessionCode || '').trim().toUpperCase();
    if (!incomingCode || incomingCode.length > 40) {
      res.status(400).json({ success: false, message: 'Invalid classroom code' });
      return;
    }

    // Only accept the CURRENT rotating classroom code (never static sessionCode or old rotated codes)
    const session = await AttendanceSession.findOne({
      dynamicCode: incomingCode,
      status: 'active',
    }).populate('subjectId', 'subjectName subjectCode department year section');

    if (!session || !isValidDynamicClassroomCode(session, incomingCode)) {
      res.status(404).json({
        success: false,
        message: 'Classroom code is invalid or expired — check the live code on your teacher\'s screen.',
      });
      return;
    }

    const windowCheck = evaluateSessionWindow(session);
    if (!windowCheck.valid) {
      session.status = 'expired';
      await session.save();
      res.status(400).json({ success: false, message: windowCheck.reason || 'Session has expired' });
      return;
    }

    const subject = session.subjectId as any;
    if (req.user!.role === 'student') {
      const student = await User.findById(req.user!.userId).select('department year section rollNumber');
      if (!student) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }
      const eligibility = checkStudentSessionEligibility(session, student, subject);
      if (!eligibility.allowed) {
        res.status(403).json({ success: false, message: eligibility.message });
        return;
      }
    }

    if (session.capacity && session.totalPresent >= session.capacity) {
      res.status(400).json({ success: false, message: `Session is at full capacity (${session.capacity})` });
      return;
    }

    const alreadyMarked = await AttendanceRecord.findOne({
      studentId: req.user!.userId,
      sessionId: session._id,
    });
    if (alreadyMarked) {
      res.json({
        success: true,
        data: {
          session: {
            id: session._id,
            subject: session.subjectId,
            expiryTime: session.expiryTime,
            startTime: session.startTime,
            sessionType: session.sessionType,
            venue: session.venue,
            title: session.title,
            gracePeriodMinutes: session.gracePeriodMinutes,
            geoFenceEnabled: !!session.geoFence?.latitude,
            geoRadiusMeters: session.geoFence?.radiusMeters ?? null,
          },
          alreadyMarked: true,
        },
      });
      return;
    }

    const deviceId = getNormalizedDeviceId(req);
    const collusion = await detectSameDeviceCollusion(req, session._id.toString(), req.user!.userId, deviceId);
    if (collusion.colluding) {
      res.status(403).json({ success: false, message: collusion.message });
      return;
    }

    // Issue single-use, user-bound verification challenge instead of leaking qrToken
    const challenge = await issueAttendanceChallenge(req.user!.userId, session._id.toString(), deviceId);

    res.json({
      success: true,
      data: {
        session: {
          id: session._id,
          subject: session.subjectId,
          expiryTime: session.expiryTime,
          startTime: session.startTime,
          sessionType: session.sessionType,
          venue: session.venue,
          title: session.title,
          gracePeriodMinutes: session.gracePeriodMinutes,
          geoFenceEnabled: !!session.geoFence?.latitude,
          geoRadiusMeters: session.geoFence?.radiusMeters ?? null,
        },
        alreadyMarked: false,
        ...challenge,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to look up session' });
  }
};

// ── STUDENT: VALIDATE QR ──────────────────────────────────────────────────────
export const validateQR = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, secureToken } = req.body;
    if (!isValidObjectId(sessionId) || !secureToken || typeof secureToken !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid QR payload' });
      return;
    }

    const session = await AttendanceSession.findById(sessionId)
      .populate('subjectId', 'subjectName subjectCode department year section');

    const windowCheck = evaluateSessionWindow(session);
    if (!session || !windowCheck.valid) {
      res.status(400).json({ success: false, message: windowCheck.reason || 'Session is not active or has expired' });
      return;
    }

    if (!isValidSessionQrToken(session, secureToken, false)) {
      res.status(400).json({ success: false, message: 'QR code has expired — please scan the latest code' });
      return;
    }

    const subject = session.subjectId as any;
    if (req.user!.role === 'student') {
      const student = await User.findById(req.user!.userId).select('department year section rollNumber');
      if (!student) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }
      const eligibility = checkStudentSessionEligibility(session, student, subject);
      if (!eligibility.allowed) {
        res.status(403).json({ success: false, message: eligibility.message });
        return;
      }
    }

    if (session.capacity && session.totalPresent >= session.capacity) {
      res.status(400).json({ success: false, message: `Session is at full capacity (${session.capacity})` });
      return;
    }

    const alreadyMarked = await AttendanceRecord.findOne({ studentId: req.user!.userId, sessionId });
    if (alreadyMarked) {
      res.json({
        success: true,
        data: {
          session: {
            id: session._id,
            subject: session.subjectId,
            expiryTime: session.expiryTime,
            startTime: session.startTime,
            sessionType: session.sessionType,
            venue: session.venue,
            title: session.title,
            geoFenceEnabled: !!session.geoFence?.latitude,
            geoRadiusMeters: session.geoFence?.radiusMeters ?? null,
          },
          alreadyMarked: true,
        },
      });
      return;
    }

    const deviceId = getNormalizedDeviceId(req);
    const collusion = await detectSameDeviceCollusion(req, session._id.toString(), req.user!.userId, deviceId);
    if (collusion.colluding) {
      res.status(403).json({ success: false, message: collusion.message });
      return;
    }

    const challenge = await issueAttendanceChallenge(req.user!.userId, session._id.toString(), deviceId);

    res.json({
      success: true,
      data: {
        session: {
          id: session._id,
          subject: session.subjectId,
          expiryTime: session.expiryTime,
          startTime: session.startTime,
          sessionType: session.sessionType,
          venue: session.venue,
          title: session.title,
          geoFenceEnabled: !!session.geoFence?.latitude,
          geoRadiusMeters: session.geoFence?.radiusMeters ?? null,
        },
        alreadyMarked: false,
        ...challenge,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to validate QR' });
  }
};

// ── STUDENT: RAISE DISPUTE ────────────────────────────────────────────────────
export const raiseDispute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { recordId } = req.params;
    if (!isValidObjectId(recordId)) {
      res.status(400).json({ success: false, message: 'Invalid record ID' });
      return;
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';

    const record = await AttendanceRecord.findOne({ _id: recordId, studentId: req.user!.userId });
    if (!record) {
      res.status(404).json({ success: false, message: 'Record not found' });
      return;
    }
    if (record.verificationStatus === 'verified') {
      res.status(400).json({ success: false, message: 'This record is already verified' });
      return;
    }

    record.verificationStatus = 'pending';
    await record.save();

    const { Notification } = await import('../models/Notification.model');
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
    await Promise.all(admins.map(admin =>
      Notification.create({
        userId: admin._id,
        title: 'Attendance Dispute',
        message: `A student raised a dispute.${reason ? ` Reason: ${reason}` : ''}`,
        type: 'warning',
        link: '/len-admin/disputes',
      })
    ));

    await createAuditLog(req.user!.userId, 'RAISE_DISPUTE', 'AttendanceRecord', recordId, { reason }, getClientIp(req));

    res.json({ success: true, message: 'Dispute raised. Admin will review it shortly.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to raise dispute' });
  }
};

// ── STUDENT: GET ACTIVE SESSIONS (NO CODES / TOKENS EXPOSED) ─────────────────
export const getActiveSessionsForStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await User.findById(req.user!.userId);
    if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return; }

    const subjects = await Subject.find({
      department: student.department,
      year: student.year,
      section: student.section,
      isActive: true,
    });

    const subjectIds = subjects.map(s => s._id);

    // Never expose qrToken, qrCodeData, sessionCode, dynamicCode, or projectorSecret to students
    const sessions = await AttendanceSession.find({
      $or: [
        { subjectId: { $in: subjectIds }, status: 'active' },
        { verificationMode: 'open', status: 'active' },
      ],
    })
      .select('-qrToken -qrCodeData -sessionCode -dynamicCode -previousDynamicCode -previousQrToken -projectorSecret -issuedTokenHashes')
      .populate('subjectId', 'subjectName subjectCode department year section');

    res.json({ success: true, data: { sessions } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load active sessions' });
  }
};

// ── STUDENT: ATTENDANCE RECEIPT ───────────────────────────────────────────────
export const getAttendanceReceipt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    if (!isValidObjectId(sessionId)) {
      res.status(400).json({ success: false, message: 'Invalid session ID' });
      return;
    }

    const record = await AttendanceRecord.findOne({
      studentId: req.user!.userId,
      sessionId,
      ...VERIFIED_ATTENDANCE_FILTER,
    }).populate('subjectId', 'subjectName subjectCode department year section');

    if (!record) {
      res.status(404).json({ success: false, message: 'No verified attendance record found for this session' });
      return;
    }

    const session = await AttendanceSession.findById(sessionId)
      .select('sessionCode sessionType venue title startTime expiryTime status');

    const student = await User.findById(req.user!.userId)
      .select('name rollNumber department year section');

    res.json({
      success: true,
      data: {
        record: {
          timestamp: record.timestamp,
          verificationStatus: record.verificationStatus,
          verificationMethod: record.verificationMethod,
          isLate: record.isLate,
        },
        subject: record.subjectId,
        session: {
          sessionCode: session?.sessionCode,
          sessionType: session?.sessionType,
          venue: session?.venue,
          title: session?.title,
          startTime: session?.startTime,
        },
        student: {
          name: student?.name,
          rollNumber: student?.rollNumber,
          department: student?.department,
          year: student?.year,
          section: student?.section,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load receipt' });
  }
};

// ── OFFLINE ATTENDANCE SYNC: BEGIN CHALLENGE ──────────────────────────────────
export const beginOfflineSyncChallenge = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, qrToken } = req.body;
    if (!isValidObjectId(sessionId) || !qrToken || typeof qrToken !== 'string') {
      res.status(400).json({ success: false, message: 'Valid sessionId and scanned qrToken are required' });
      return;
    }

    const session = await AttendanceSession.findById(sessionId)
      .populate('subjectId', 'subjectName subjectCode department year section');
    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    const sessionAge = Date.now() - new Date(session.startTime).getTime();
    if (sessionAge > 24 * 60 * 60 * 1000) {
      res.status(400).json({ success: false, message: 'Session too old (>24h) to sync' });
      return;
    }

    const tokenHash = hashSha256(qrToken);
    const effectiveExpiryMs =
      new Date(session.expiryTime).getTime() + (session.gracePeriodMinutes || 0) * 60_000;
    const validIssued = (session.issuedTokenHashes || []).some(
      (entry) =>
        entry.hash === tokenHash &&
        new Date(entry.issuedAt).getTime() >= new Date(session.startTime).getTime() - 60_000 &&
        new Date(entry.issuedAt).getTime() <= effectiveExpiryMs
    );
    if (!validIssued) {
      res.status(400).json({ success: false, message: 'QR token is not valid for this session window' });
      return;
    }

    const student = await User.findById(req.user!.userId).select('department year section rollNumber faceDescriptor');
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }
    if (!student.faceDescriptor?.descriptor?.length) {
      res.status(400).json({ success: false, message: 'Please enroll your face profile before syncing offline attendance.' });
      return;
    }

    const eligibility = checkStudentSessionEligibility(session, student, session.subjectId as any);
    if (!eligibility.allowed) {
      res.status(403).json({ success: false, message: eligibility.message });
      return;
    }

    const existing = await AttendanceRecord.findOne({ sessionId, studentId: req.user!.userId });
    if (existing) {
      res.status(409).json({ success: false, message: 'Attendance already recorded for this session' });
      return;
    }

    const deviceId = getNormalizedDeviceId(req);
    const collusion = await detectSameDeviceCollusion(req, sessionId, req.user!.userId, deviceId);
    if (collusion.colluding) {
      res.status(403).json({ success: false, message: collusion.message });
      return;
    }

    const challenge = await issueAttendanceChallenge(req.user!.userId, sessionId, deviceId);
    res.json({ success: true, data: challenge });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to prepare offline sync verification' });
  }
};

// ── OFFLINE ATTENDANCE SYNC (REQUIRES QR TOKEN + LIVE LIVENESS + FACE MATCH) ──
export const syncOfflineAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0 || records.length > 20) {
      res.status(400).json({ success: false, message: 'records array (1-20 items) required' });
      return;
    }

    const student = await User.findById(req.user!.userId);
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }
    if (!student.faceDescriptor?.descriptor?.length) {
      res.status(400).json({ success: false, message: 'Enrolled face profile required to sync offline records' });
      return;
    }

    const deviceId = getNormalizedDeviceId(req);
    const results: { sessionId: string; status: string; message: string }[] = [];

    for (const record of records) {
      const rawSessionId = String(record?.sessionId || '');
      try {
        if (!isValidObjectId(rawSessionId) || !record?.qrToken || typeof record.qrToken !== 'string') {
          results.push({ sessionId: rawSessionId, status: 'failed', message: 'Valid scanned sessionId and qrToken required' });
          continue;
        }

        const challengeCheck = await validateActiveChallenge(
          record.challengeToken,
          req.user!.userId,
          rawSessionId,
          deviceId
        );
        if (!challengeCheck.valid || !challengeCheck.challenge) {
          results.push({ sessionId: rawSessionId, status: 'failed', message: challengeCheck.message || 'Verification challenge invalid' });
          continue;
        }

        const session = await AttendanceSession.findById(rawSessionId)
          .populate('subjectId', 'subjectName subjectCode department year section');
        if (!session) {
          results.push({ sessionId: rawSessionId, status: 'failed', message: 'Session not found' });
          continue;
        }

        const sessionAge = Date.now() - new Date(session.startTime).getTime();
        if (sessionAge > 24 * 60 * 60 * 1000) {
          results.push({ sessionId: rawSessionId, status: 'failed', message: 'Session too old (>24h) to sync' });
          continue;
        }

        const tokenHash = hashSha256(record.qrToken);
        const effectiveExpiryMs =
          new Date(session.expiryTime).getTime() + (session.gracePeriodMinutes || 0) * 60_000;
        const validIssued = (session.issuedTokenHashes || []).some(
          (entry) =>
            entry.hash === tokenHash &&
            new Date(entry.issuedAt).getTime() >= new Date(session.startTime).getTime() - 60_000 &&
            new Date(entry.issuedAt).getTime() <= effectiveExpiryMs
        );
        if (!validIssued) {
          results.push({ sessionId: rawSessionId, status: 'failed', message: 'Invalid or expired offline QR token' });
          continue;
        }

        const geoCheck = checkGeoFence(session.geoFence, record.latitude, record.longitude);
        if (!geoCheck.allowed) {
          results.push({ sessionId: rawSessionId, status: 'failed', message: geoCheck.message || 'Outside classroom geofence' });
          continue;
        }

        const subject = session.subjectId as any;
        const eligibility = checkStudentSessionEligibility(session, student, subject);
        if (!eligibility.allowed) {
          results.push({ sessionId: rawSessionId, status: 'failed', message: eligibility.message || 'Not eligible' });
          continue;
        }

        if (session.capacity && session.totalPresent >= session.capacity) {
          results.push({ sessionId: rawSessionId, status: 'failed', message: 'Session is at full capacity' });
          continue;
        }

        const existing = await AttendanceRecord.findOne({ sessionId: rawSessionId, studentId: req.user!.userId });
        if (existing) {
          results.push({ sessionId: rawSessionId, status: 'duplicate', message: 'Already marked' });
          continue;
        }

        const collusion = await detectSameDeviceCollusion(req, rawSessionId, req.user!.userId, deviceId);
        if (collusion.colluding) {
          results.push({ sessionId: rawSessionId, status: 'failed', message: collusion.message || 'Same-device collusion detected' });
          continue;
        }

        const livenessResult = verifyLivenessProof(challengeCheck.challenge.livenessActions, record.livenessProof);
        if (!livenessResult.valid || !livenessResult.primaryDescriptor) {
          await incrementChallengeFailure(challengeCheck.challenge._id.toString());
          results.push({ sessionId: rawSessionId, status: 'failed', message: livenessResult.reason || 'Liveness verification failed' });
          continue;
        }

        const match = evaluateFaceMatch(
          livenessResult.primaryDescriptor,
          student.faceDescriptor.descriptor,
          student.faceDescriptor.recentVerificationHashes || []
        );
        if (match.isReplay || !match.matched) {
          await incrementChallengeFailure(challengeCheck.challenge._id.toString());
          results.push({ sessionId: rawSessionId, status: 'failed', message: 'Face verification failed' });
          continue;
        }

        const consumed = await consumeChallengeAtomically(challengeCheck.challenge._id.toString());
        if (!consumed) {
          results.push({ sessionId: rawSessionId, status: 'failed', message: 'Challenge already consumed' });
          continue;
        }

        const prevHashes = student.faceDescriptor.recentVerificationHashes || [];
        student.faceDescriptor.recentVerificationHashes = [...prevHashes.slice(-9), match.liveHash];
        await student.save();

        await AttendanceRecord.create({
          studentId: req.user!.userId,
          sessionId: session._id,
          subjectId: subject?._id ?? session.subjectId,
          timestamp: record.timestamp ? new Date(record.timestamp) : new Date(),
          verificationStatus: 'pending', // Pending teacher/admin approval before counting toward totalPresent
          verificationMethod: 'offline_sync',
          isLate: false,
          ipAddress: getClientIp(req),
          deviceId: deviceId || undefined,
          livenessPassed: true,
          livenessActions: challengeCheck.challenge.livenessActions,
          faceConfidence: Number(match.similarity.toFixed(3)),
        });

        results.push({ sessionId: rawSessionId, status: 'synced', message: 'Synced and queued for approval' });
      } catch {
        results.push({ sessionId: rawSessionId, status: 'failed', message: 'Sync error' });
      }
    }

    const synced = results.filter(r => r.status === 'synced').length;
    const failed = results.filter(r => r.status === 'failed').length;

    res.json({
      success: true,
      message: `${synced} synced (pending approval), ${failed} failed`,
      data: { results, synced, failed },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Offline sync failed' });
  }
};
