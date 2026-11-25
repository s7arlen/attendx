import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware';
import { AttendanceSession } from '../models/AttendanceSession.model';
import { AttendanceRecord } from '../models/AttendanceRecord.model';
import { Subject } from '../models/Subject.model';
import { User } from '../models/User.model';
import { generateSessionAssets, generateFreshQR } from '../utils/qrGenerator';
import { createAuditLog, getClientIp } from '../utils/auditLogger';
import { emitToSession } from '../config/socket';
import { Server } from 'socket.io';

// ── TEACHER: START SESSION ────────────────────────────────────────────────────
export const startSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      subjectId,
      duration = 15,
      sessionType = 'class',
      capacity = null,
      verificationMode = 'strict',
      gracePeriodMinutes = 0,
      qrRefreshSeconds,
      title = null,
      venue = null,
      inviteList = [],
      coHosts = [],
    } = req.body;

    if (!subjectId) {
      res.status(400).json({ success: false, message: 'Subject ID required' });
      return;
    }

    const subject = await Subject.findById(subjectId);
    if (!subject) {
      res.status(404).json({ success: false, message: 'Subject not found' });
      return;
    }

    if (subject.assignedTeacher.toString() !== req.user!.userId) {
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

    const { secureToken, passwordCode, sessionCode, qrCodeData } = await generateSessionAssets(
      sessionIdStr,
      subjectId,
      subject.subjectCode
    );

    // Default QR refresh: 60s for large events/seminars, 20s for class/lab
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
      passwordCode,
      startTime,
      expiryTime,
      status: 'active',
      duration,
      sessionType,
      capacity: capacity ? Number(capacity) : null,
      verificationMode,
      gracePeriodMinutes: Number(gracePeriodMinutes),
      qrRefreshSeconds: resolvedQrRefresh,
      title: title || null,
      venue: venue || null,
      inviteList: Array.isArray(inviteList) ? inviteList.map((r: string) => r.trim().toUpperCase()) : [],
      coHosts: Array.isArray(coHosts) ? coHosts : [],
    });

    const populated = await AttendanceSession.findById(session._id)
      .populate('subjectId', 'subjectName subjectCode department year section');

    await createAuditLog(
      req.user!.userId, 'START_SESSION', 'AttendanceSession', sessionIdStr,
      { subjectId, duration, sessionType, verificationMode }, getClientIp(req)
    );

    // Notify students of their subjects that a session has started
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
          '📋 Attendance Session Live',
          `${subject.subjectName} attendance is now open. Code: ${passwordCode}`,
          'info',
          '/student/scan'
        )
      ));
    } catch { /* non-blocking */ }

    res.status(201).json({ success: true, message: 'Session started', data: { session: populated } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── TEACHER: REFRESH QR TOKEN ─────────────────────────────────────────────────
export const refreshQR = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await AttendanceSession.findOne({
      _id: sessionId,
      $or: [
        { teacherId: req.user!.userId },
        { coHosts: req.user!.userId },
      ],
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── TEACHER: END SESSION ──────────────────────────────────────────────────────
export const endSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await AttendanceSession.findOne({
      _id: sessionId,
      $or: [
        { teacherId: req.user!.userId },
        { coHosts: req.user!.userId },
      ],
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── TEACHER: GET LIVE SESSION ─────────────────────────────────────────────────
export const getLiveSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await AttendanceSession.findOne({
      _id: sessionId,
      $or: [
        { teacherId: req.user!.userId },
        { coHosts: req.user!.userId },
      ],
    }).populate('subjectId', 'subjectName subjectCode department year section');

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    const attendanceRecords = await AttendanceRecord.find({ sessionId })
      .populate('studentId', 'name email rollNumber year section')
      .sort({ timestamp: -1 });

    // Build absent list when verificationMode = strict (can compare against enrolled students)
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

      const presentIds = new Set(attendanceRecords.map(r => r.studentId.toString()));
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── PUBLIC: PROJECTOR VIEW (no auth — session code only) ──────────────────────
export const getProjectorSession = async (req: any, res: Response): Promise<void> => {
  try {
    const { sessionCode } = req.params;

    const session = await AttendanceSession.findOne({
      sessionCode: sessionCode.toUpperCase(),
    }).populate('subjectId', 'subjectName subjectCode department year section');

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    // Only expose safe fields — no qrToken, no teacher details
    res.json({
      success: true,
      data: {
        sessionCode: session.sessionCode,
        passwordCode: session.passwordCode,
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── TEACHER: GET MY SESSIONS ──────────────────────────────────────────────────
export const getTeacherSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessions = await AttendanceSession.find({ teacherId: req.user!.userId })
      .populate('subjectId', 'subjectName subjectCode')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, data: { sessions } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── SESSION REPORT WITH ABSENT LIST ──────────────────────────────────────────
export const getSessionReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await AttendanceSession.findOne({
      _id: sessionId,
      $or: [
        { teacherId: req.user!.userId },
        { coHosts: req.user!.userId },
      ],
    }).populate('subjectId', 'subjectName subjectCode department year section');

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    const records = await AttendanceRecord.find({ sessionId })
      .populate('studentId', 'name email rollNumber year section department')
      .sort({ timestamp: 1 });

    // Build absent list for strict sessions
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

      const presentIds = new Set(records.map(r => r.studentId.toString()));
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── SESSION CSV EXPORT ────────────────────────────────────────────────────────
export const exportSessionCSV = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { type = 'present' } = req.query; // 'present' | 'absent' | 'all'

    const session = await AttendanceSession.findOne({
      _id: sessionId,
      $or: [
        { teacherId: req.user!.userId },
        { coHosts: req.user!.userId },
      ],
    }).populate('subjectId', 'subjectName subjectCode department year section');

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    const records = await AttendanceRecord.find({ sessionId })
      .populate('studentId', 'name email rollNumber year section department')
      .sort({ timestamp: 1 });

    const subjectInfo = session.subjectId as any;
    const rows: string[] = [];
    const header = 'Name,Roll Number,Year,Section,Department,Status,Time,Method,Late';
    rows.push(header);

    if (type !== 'absent') {
      records.forEach(r => {
        const s = r.studentId as any;
        rows.push([
          s.name || '', s.rollNumber || '', s.year || '', s.section || '', s.department || '',
          'Present',
          new Date(r.timestamp).toLocaleTimeString(),
          r.verificationMethod || 'password',
          r.isLate ? 'Yes' : 'No',
        ].map(v => `"${v}"`).join(','));
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

      const presentIds = new Set(records.map(r => r.studentId.toString()));
      enrolled
        .filter(s => !presentIds.has(s._id.toString()))
        .forEach(s => {
          rows.push([
            s.name || '', s.rollNumber || '', s.year || '', s.section || '', s.department || '',
            'Absent', '', '', '',
          ].map(v => `"${v}"`).join(','));
        });
    }

    const csv = rows.join('\n');
    const filename = `${subjectInfo.subjectCode}-${session.sessionCode}-${type}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── STUDENT: VERIFY ATTENDANCE ────────────────────────────────────────────────
export const verifyAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, subjectId, secureToken, passwordCode } = req.body;

    if (!sessionId || !secureToken || !passwordCode) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    const session = await AttendanceSession.findById(sessionId);
    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    // Grace period: allow late entry for gracePeriodMinutes after expiry
    const effectiveExpiry = new Date(
      session.expiryTime.getTime() + (session.gracePeriodMinutes || 0) * 60 * 1000
    );
    const isLate = session.status !== 'active' && new Date() <= effectiveExpiry;

    if (session.status !== 'active' && !isLate) {
      res.status(400).json({ success: false, message: 'Session is no longer active' });
      return;
    }
    if (new Date() > effectiveExpiry) {
      if (session.status === 'active') { session.status = 'expired'; await session.save(); }
      res.status(400).json({ success: false, message: 'Session has expired' });
      return;
    }

    if (session.qrToken !== secureToken) {
      res.status(400).json({ success: false, message: 'Invalid QR code — it may have refreshed. Scan again.' });
      return;
    }

    if (session.passwordCode !== passwordCode.toUpperCase()) {
      res.status(400).json({ success: false, message: 'Incorrect session password' });
      return;
    }

    // Capacity check
    if (session.capacity && session.totalPresent >= session.capacity) {
      res.status(400).json({ success: false, message: `Session is at full capacity (${session.capacity})` });
      return;
    }

    const existingRecord = await AttendanceRecord.findOne({
      studentId: req.user!.userId,
      sessionId,
    });
    if (existingRecord) {
      res.status(409).json({ success: false, message: 'Attendance already marked for this session' });
      return;
    }

    const subject = await Subject.findById(session.subjectId);
    const student = await User.findById(req.user!.userId);

    if (!subject || !student) {
      res.status(404).json({ success: false, message: 'Subject or student not found' });
      return;
    }

    // Verification mode checks
    if (session.verificationMode === 'strict') {
      if (
        student.department !== subject.department ||
        student.year !== subject.year ||
        student.section !== subject.section
      ) {
        res.status(403).json({
          success: false,
          message: 'You are not enrolled in this class section',
        });
        return;
      }
    } else if (session.verificationMode === 'invite') {
      const roll = student.rollNumber?.toUpperCase() || '';
      if (!session.inviteList.includes(roll)) {
        res.status(403).json({
          success: false,
          message: 'You are not on the invite list for this session',
        });
        return;
      }
    }
    // 'open' mode — no enrollment check

    // Atomically increment totalPresent
    await AttendanceSession.findByIdAndUpdate(sessionId, { $inc: { totalPresent: 1 } });

    const record = await AttendanceRecord.create({
      studentId: req.user!.userId,
      sessionId: session._id,
      subjectId: session.subjectId,
      timestamp: new Date(),
      verificationStatus: 'verified',
      verificationMethod: 'password',
      isLate,
      ipAddress: getClientIp(req),
    });

    const io: Server = req.app.get('io');
    const updatedSession = await AttendanceSession.findById(sessionId).select('totalPresent');
    emitToSession(io, sessionId.toString(), 'attendance:marked', {
      studentId: student._id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      year: student.year,
      section: student.section,
      isLate,
      timestamp: record.timestamp,
      totalPresent: updatedSession?.totalPresent ?? session.totalPresent + 1,
    });

    await createAuditLog(
      req.user!.userId, 'MARK_ATTENDANCE', 'AttendanceRecord', record._id.toString(),
      { sessionId, isLate }, getClientIp(req)
    );

    // Background: risk reassessment
    import('../controllers/academic.controller')
      .then(m => m.triggerRiskAssessment(req.user!.userId))
      .catch(() => {});

    const { Notification } = await import('../models/Notification.model');
    await Notification.create({
      userId: req.user!.userId,
      title: 'Attendance Marked',
      message: `Your attendance for ${subject.subjectName} has been recorded${isLate ? ' (late entry)' : ''}.`,
      type: 'success',
      link: '/student/attendance',
    });

    res.json({
      success: true,
      message: `Attendance marked${isLate ? ' (late entry accepted)' : ''} successfully`,
      data: {
        record,
        isLate,
        subject: { subjectName: subject.subjectName, subjectCode: subject.subjectCode },
        timestamp: record.timestamp,
        sessionType: session.sessionType,
        venue: session.venue,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── STUDENT: ATTENDANCE HISTORY ───────────────────────────────────────────────
export const getAttendanceHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subjectId, page = 1, limit = 20 } = req.query;
    const query: any = { studentId: req.user!.userId };
    if (subjectId) query.subjectId = subjectId;

    const skip = (Number(page) - 1) * Number(limit);
    const [records, total] = await Promise.all([
      AttendanceRecord.find(query)
        .populate('subjectId', 'subjectName subjectCode department')
        .populate({
          path: 'sessionId',
          select: 'startTime expiryTime passwordCode status duration sessionType venue',
        })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(Number(limit)),
      AttendanceRecord.countDocuments(query),
    ]);

    res.json({ success: true, data: { records, total, page: Number(page), limit: Number(limit) } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── STUDENT: FIND SESSION BY CODE ─────────────────────────────────────────────
export const findSessionByCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionCode } = req.params;

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
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── STUDENT: VALIDATE QR ──────────────────────────────────────────────────────
export const validateQR = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, secureToken } = req.body;

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
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── STUDENT: RAISE DISPUTE ────────────────────────────────────────────────────
export const raiseDispute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { recordId } = req.params;
    const { reason } = req.body;

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
    res.status(500).json({ success: false, message: error.message });
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

    // Also include open sessions that are active
    const sessions = await AttendanceSession.find({
      $or: [
        { subjectId: { $in: subjectIds }, status: 'active' },
        { verificationMode: 'open', status: 'active' },
      ],
    }).populate('subjectId', 'subjectName subjectCode department year section');

    res.json({ success: true, data: { sessions } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── STUDENT: ATTENDANCE RECEIPT ───────────────────────────────────────────────
export const getAttendanceReceipt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const record = await AttendanceRecord.findOne({
      studentId: req.user!.userId,
      sessionId,
    }).populate('subjectId', 'subjectName subjectCode department year section');

    if (!record) {
      res.status(404).json({ success: false, message: 'No attendance record found for this session' });
      return;
    }

    const session = await AttendanceSession.findById(sessionId)
      .select('sessionCode passwordCode sessionType venue title startTime expiryTime status');

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
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── OFFLINE ATTENDANCE SYNC ───────────────────────────────────────────────────
export const syncOfflineAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json({ success: false, message: 'records array required' });
      return;
    }

    const results: { sessionId: string; status: string; message: string }[] = [];

    for (const record of records) {
      try {
        const { sessionId, subjectId, secureToken, passwordCode, timestamp } = record;

        const session = await AttendanceSession.findById(sessionId)
          .populate('subjectId', 'subjectName subjectCode department year section');

        if (!session) {
          results.push({ sessionId, status: 'failed', message: 'Session not found' });
          continue;
        }

        const sessionAge = Date.now() - new Date(session.startTime).getTime();
        if (sessionAge > 24 * 60 * 60 * 1000) {
          results.push({ sessionId, status: 'failed', message: 'Session too old (>24h) to sync' });
          continue;
        }

        const existing = await AttendanceRecord.findOne({ sessionId, studentId: req.user!.userId });
        if (existing) {
          results.push({ sessionId, status: 'duplicate', message: 'Already marked' });
          continue;
        }

        if (session.passwordCode !== passwordCode?.toUpperCase()) {
          results.push({ sessionId, status: 'failed', message: 'Invalid password code' });
          continue;
        }

        await AttendanceRecord.create({
          studentId: req.user!.userId,
          sessionId,
          subjectId: session.subjectId,
          timestamp: timestamp ? new Date(timestamp) : new Date(),
          verificationStatus: 'verified',
          verificationMethod: 'offline_sync',
          isLate: false,
        });

        await AttendanceSession.findByIdAndUpdate(sessionId, { $inc: { totalPresent: 1 } });

        results.push({ sessionId, status: 'synced', message: 'Attendance synced successfully' });
      } catch (err: any) {
        results.push({ sessionId: record.sessionId, status: 'failed', message: err.message });
      }
    }

    const synced = results.filter(r => r.status === 'synced').length;
    const failed = results.filter(r => r.status === 'failed').length;

    res.json({
      success: true,
      message: `${synced} synced, ${failed} failed`,
      data: { results, synced, failed },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
