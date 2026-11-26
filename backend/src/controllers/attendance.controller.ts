import { Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import { AttendanceSession } from '../models/AttendanceSession.model';
import { AttendanceRecord } from '../models/AttendanceRecord.model';
import { Subject } from '../models/Subject.model';
import { User } from '../models/User.model';
import { generateSessionAssets, generateFreshQR } from '../utils/qrGenerator';
import { createAuditLog, getClientIp } from '../utils/auditLogger';
import { emitToSession } from '../config/socket';
import { Server } from 'socket.io';
import { clampPagination, isValidObjectId, sanitizeCsvCell } from '../utils/security';

const startSessionSchema = z.object({
  subjectId: z.string().refine(isValidObjectId, 'Invalid subject ID'),
  duration: z.coerce.number().int().min(1).max(300).default(15),
  sessionType: z.enum(['class', 'seminar', 'workshop', 'event', 'lab']).default('class'),
  capacity: z.coerce.number().int().min(1).max(5000).nullable().optional().default(null),
  verificationMode: z.enum(['strict', 'open', 'invite']).default('strict'),
  gracePeriodMinutes: z.coerce.number().int().min(0).max(60).default(0),
  qrRefreshSeconds: z.coerce.number().int().min(10).max(300).optional(),
  title: z.string().max(150).nullable().optional().default(null),
  venue: z.string().max(150).nullable().optional().default(null),
  inviteList: z.array(z.string().max(40)).max(500).optional().default([]),
  coHosts: z.array(z.string().refine(isValidObjectId, 'Invalid co-host ID')).max(20).optional().default([]),
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

// ── TEACHER: START SESSION ────────────────────────────────────────────────────
export const startSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = startSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid session parameters', errors: parsed.error.errors });
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

    const { secureToken, sessionCode, qrCodeData } = await generateSessionAssets(
      sessionIdStr,
      subjectId,
      subject.subjectCode
    );

    const defaultRefresh = ['seminar', 'event', 'workshop'].includes(sessionType) ? 60 : 20;
    const resolvedQrRefresh = qrRefreshSeconds ?? defaultRefresh;

    const startTime = new Date();
    const expiryTime = new Date(startTime.getTime() + duration * 60 * 1000);

    const session = await AttendanceSession.create({
      _id: newId,
      subjectId,
      teacherId: req.user!.userId,
      sessionCode,
      qrToken: secureToken,
      qrCodeData,
      startTime,
      expiryTime,
      status: 'active',
      duration,
      sessionType,
      capacity: capacity ?? null,
      verificationMode,
      gracePeriodMinutes,
      qrRefreshSeconds: resolvedQrRefresh,
      title: title || null,
      venue: venue || null,
      inviteList: inviteList.map((r) => r.trim().toUpperCase()),
      coHosts,
    });

    const populated = await AttendanceSession.findById(session._id)
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
          `${subject.subjectName} attendance is now open. Session code: ${sessionCode}`,
          'info',
          '/student/scan'
        )
      ));
    } catch { /* non-blocking */ }

    res.status(201).json({ success: true, message: 'Session started', data: { session: populated } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to start session' });
  }
};

// ── TEACHER: REFRESH QR TOKEN ─────────────────────────────────────────────────
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

    const effectiveExpiry = new Date(session.expiryTime.getTime() + session.gracePeriodMinutes * 60 * 1000);
    if (new Date() > effectiveExpiry) {
      session.status = 'expired';
      await session.save();
      res.status(400).json({ success: false, message: 'Session has expired' });
      return;
    }

    const { secureToken, qrCodeData } = await generateFreshQR(
      sessionId,
      (session.subjectId as any)._id?.toString() ?? session.subjectId.toString()
    );

    session.qrToken = secureToken;
    session.qrCodeData = qrCodeData;
    await session.save();

    const io: Server = req.app.get('io');
    emitToSession(io, sessionId, 'qr:refreshed', {
      sessionId,
      qrCodeData,
      secureToken,
      refreshedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      data: { qrCodeData, qrToken: secureToken, refreshedAt: new Date().toISOString() },
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
    emitToSession(io, sessionId, 'session:ended', { sessionId, message: 'Session ended by teacher' });

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

    const session = await AttendanceSession.findOne(buildSessionAccessFilter(sessionId, req))
      .populate('subjectId', 'subjectName subjectCode department year section');

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    const attendanceRecords = await AttendanceRecord.find({ sessionId })
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

    res.json({
      success: true,
      data: {
        session,
        attendanceRecords,
        totalPresent: attendanceRecords.length,
        absentStudents,
        absentCount: absentStudents.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load live session' });
  }
};

// ── PUBLIC: PROJECTOR VIEW (no auth — safe fields only) ──────────────────────
export const getProjectorSession = async (req: any, res: Response): Promise<void> => {
  try {
    const { sessionCode } = req.params;
    if (!sessionCode || typeof sessionCode !== 'string' || sessionCode.length > 40) {
      res.status(400).json({ success: false, message: 'Invalid session code' });
      return;
    }

    const session = await AttendanceSession.findOne({
      sessionCode: sessionCode.toUpperCase(),
    }).populate('subjectId', 'subjectName subjectCode department year section');

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        sessionCode: session.sessionCode,
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
        qrRefreshSeconds: session.qrRefreshSeconds,
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
      .populate('subjectId', 'subjectName subjectCode department year section');

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    const records = await AttendanceRecord.find({ sessionId })
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
      .populate('subjectId', 'subjectName subjectCode department year section');

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    const records = await AttendanceRecord.find({ sessionId })
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

    const records = await AttendanceRecord.find({ studentId }).populate('subjectId', 'subjectName subjectCode');

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

// ── STUDENT: FIND SESSION BY CODE ─────────────────────────────────────────────
export const findSessionByCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionCode } = req.params;
    if (!sessionCode || sessionCode.length > 40) {
      res.status(400).json({ success: false, message: 'Invalid session code' });
      return;
    }

    const session = await AttendanceSession.findOne({
      sessionCode: sessionCode.toUpperCase(),
      status: 'active',
    }).populate('subjectId', 'subjectName subjectCode department year section');

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found or no longer active' });
      return;
    }

    const effectiveExpiry = new Date(
      session.expiryTime.getTime() + session.gracePeriodMinutes * 60 * 1000
    );
    if (new Date() > effectiveExpiry) {
      session.status = 'expired';
      await session.save();
      res.status(400).json({ success: false, message: 'Session has expired' });
      return;
    }

    // Verify student eligibility before revealing session details/token
    if (req.user!.role === 'student') {
      const student = await User.findById(req.user!.userId).select('department year section rollNumber');
      const subject = session.subjectId as any;
      if (!student || !subject) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }
      if (session.verificationMode === 'strict') {
        if (
          student.department !== subject.department ||
          student.year !== subject.year ||
          student.section !== subject.section
        ) {
          res.status(403).json({ success: false, message: 'You are not enrolled in this class section' });
          return;
        }
      } else if (session.verificationMode === 'invite') {
        const roll = student.rollNumber?.toUpperCase() || '';
        if (!session.inviteList.includes(roll)) {
          res.status(403).json({ success: false, message: 'You are not on the invite list for this session' });
          return;
        }
      }
    }

    const alreadyMarked = await AttendanceRecord.findOne({
      studentId: req.user!.userId,
      sessionId: session._id,
    });

    res.json({
      success: true,
      data: {
        session: {
          id: session._id,
          subject: session.subjectId,
          sessionCode: session.sessionCode,
          expiryTime: session.expiryTime,
          startTime: session.startTime,
          qrToken: session.qrToken,
          sessionType: session.sessionType,
          venue: session.venue,
          title: session.title,
          gracePeriodMinutes: session.gracePeriodMinutes,
        },
        alreadyMarked: !!alreadyMarked,
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

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    const effectiveExpiry = new Date(
      session.expiryTime.getTime() + session.gracePeriodMinutes * 60 * 1000
    );
    if ((session.status !== 'active') && new Date() > effectiveExpiry) {
      res.status(400).json({ success: false, message: 'Session is not active or has expired' });
      return;
    }
    if (session.qrToken !== secureToken) {
      res.status(400).json({ success: false, message: 'QR code has expired — please scan the latest code' });
      return;
    }

    const alreadyMarked = await AttendanceRecord.findOne({ studentId: req.user!.userId, sessionId });

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
        },
        alreadyMarked: !!alreadyMarked,
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

// ── STUDENT: GET ACTIVE SESSIONS ──────────────────────────────────────────────
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

    // Never expose qrToken or qrCodeData in active session list
    const sessions = await AttendanceSession.find({
      $or: [
        { subjectId: { $in: subjectIds }, status: 'active' },
        { verificationMode: 'open', status: 'active' },
      ],
    })
      .select('-qrToken -qrCodeData')
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
    }).populate('subjectId', 'subjectName subjectCode department year section');

    if (!record) {
      res.status(404).json({ success: false, message: 'No attendance record found for this session' });
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

// ── OFFLINE ATTENDANCE SYNC ───────────────────────────────────────────────────
export const syncOfflineAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0 || records.length > 50) {
      res.status(400).json({ success: false, message: 'records array (1-50 items) required' });
      return;
    }

    const student = await User.findById(req.user!.userId).select('department year section rollNumber');
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    const results: { sessionId: string; status: string; message: string }[] = [];

    for (const record of records) {
      const rawSessionId = String(record?.sessionId || '');
      try {
        if (!isValidObjectId(rawSessionId)) {
          results.push({ sessionId: rawSessionId, status: 'failed', message: 'Invalid session ID' });
          continue;
        }

        const session = await AttendanceSession.findById(rawSessionId)
          .populate('subjectId', 'subjectName subjectCode department year section');

        if (!session) {
          results.push({ sessionId: rawSessionId, status: 'failed', message: 'Session not found' });
          continue;
        }

        const subject = session.subjectId as any;
        if (session.verificationMode === 'strict') {
          if (
            !subject ||
            student.department !== subject.department ||
            student.year !== subject.year ||
            student.section !== subject.section
          ) {
            results.push({ sessionId: rawSessionId, status: 'failed', message: 'Not enrolled in this class section' });
            continue;
          }
        } else if (session.verificationMode === 'invite') {
          const roll = student.rollNumber?.toUpperCase() || '';
          if (!session.inviteList.includes(roll)) {
            results.push({ sessionId: rawSessionId, status: 'failed', message: 'Not on the invite list' });
            continue;
          }
        }

        if (session.capacity && session.totalPresent >= session.capacity) {
          results.push({ sessionId: rawSessionId, status: 'failed', message: 'Session is at full capacity' });
          continue;
        }

        const sessionAge = Date.now() - new Date(session.startTime).getTime();
        if (sessionAge > 24 * 60 * 60 * 1000) {
          results.push({ sessionId: rawSessionId, status: 'failed', message: 'Session too old (>24h) to sync' });
          continue;
        }

        const existing = await AttendanceRecord.findOne({ sessionId: rawSessionId, studentId: req.user!.userId });
        if (existing) {
          results.push({ sessionId: rawSessionId, status: 'duplicate', message: 'Already marked' });
          continue;
        }

        await AttendanceRecord.create({
          studentId: req.user!.userId,
          sessionId: session._id,
          subjectId: subject?._id ?? session.subjectId,
          timestamp: record.timestamp ? new Date(record.timestamp) : new Date(),
          verificationStatus: 'pending', // Offline sync records require teacher/admin verification if disputed or unverified by biometric
          verificationMethod: 'offline_sync',
          isLate: false,
          ipAddress: getClientIp(req),
        });

        await AttendanceSession.findByIdAndUpdate(rawSessionId, { $inc: { totalPresent: 1 } });

        results.push({ sessionId: rawSessionId, status: 'synced', message: 'Attendance synced successfully' });
      } catch {
        results.push({ sessionId: rawSessionId, status: 'failed', message: 'Sync error' });
      }
    }

    const synced = results.filter(r => r.status === 'synced').length;
    const failed = results.filter(r => r.status === 'failed').length;

    res.json({
      success: true,
      message: `${synced} synced, ${failed} failed`,
      data: { results, synced, failed },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Offline sync failed' });
  }
};
