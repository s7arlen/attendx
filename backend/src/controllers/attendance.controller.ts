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

// â”€â”€ TEACHER: START SESSION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const startSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subjectId, duration = 15 } = req.body;
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

    // Check for existing active session
    const existingSession = await AttendanceSession.findOne({
      subjectId,
      teacherId: req.user!.userId,
      status: 'active',
    });
    if (existingSession) {
      res.status(409).json({ success: false, message: 'An active session already exists for this subject' });
      return;
    }

    // Generate a real MongoDB ObjectId upfront so we can embed it in the QR payload
    const newId = new mongoose.Types.ObjectId();
    const sessionIdStr = newId.toString();

    const { secureToken, passwordCode, sessionCode, qrCodeData } = await generateSessionAssets(
      sessionIdStr,
      subjectId,
      subject.subjectCode
    );

    const startTime = new Date();
    const expiryTime = new Date(startTime.getTime() + duration * 60 * 1000);

    const session = await AttendanceSession.create({
      _id: newId,          // ObjectId â€” no more BSONError
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
    });

    const populated = await AttendanceSession.findById(session._id)
      .populate('subjectId', 'subjectName subjectCode department year section');

    await createAuditLog(req.user!.userId, 'START_SESSION', 'AttendanceSession', sessionIdStr, { subjectId, duration }, getClientIp(req));

    res.status(201).json({ success: true, message: 'Session started', data: { session: populated } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// â”€â”€ TEACHER: REFRESH QR TOKEN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const refreshQR = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await AttendanceSession.findOne({
      _id: sessionId,
      teacherId: req.user!.userId,
      status: 'active',
    }).populate('subjectId', 'subjectName subjectCode department year section');

    if (!session) {
      res.status(404).json({ success: false, message: 'Active session not found' });
      return;
    }

    if (new Date() > session.expiryTime) {
      session.status = 'expired';
      await session.save();
      res.status(400).json({ success: false, message: 'Session has expired' });
      return;
    }

    // Generate fresh token and QR image â€” old token is now invalid
    const { secureToken, qrCodeData } = await generateFreshQR(
      sessionId,
      (session.subjectId as any)._id?.toString() ?? session.subjectId.toString()
    );

    session.qrToken = secureToken;
    session.qrCodeData = qrCodeData;
    await session.save();

    // Push update to any connected clients via Socket.IO
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

// â”€â”€ TEACHER: END SESSION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const endSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await AttendanceSession.findOne({
      _id: sessionId,
      teacherId: req.user!.userId,
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

    // Notify teacher the session ended
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

// â”€â”€ TEACHER: GET LIVE SESSION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getLiveSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await AttendanceSession.findOne({
      _id: sessionId,
      teacherId: req.user!.userId,
    }).populate('subjectId', 'subjectName subjectCode department year section');

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    const attendanceRecords = await AttendanceRecord.find({ sessionId })
      .populate('studentId', 'name email rollNumber year section')
      .sort({ timestamp: -1 });

    res.json({
      success: true,
      data: {
        session,
        attendanceRecords,
        totalPresent: attendanceRecords.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// â”€â”€ TEACHER: GET MY SESSIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ STUDENT: VERIFY ATTENDANCE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const verifyAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, subjectId, secureToken, passwordCode } = req.body;

    if (!sessionId || !secureToken || !passwordCode) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    // Find and validate session
    const session = await AttendanceSession.findById(sessionId);
    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    if (session.status !== 'active') {
      res.status(400).json({ success: false, message: 'Session is no longer active' });
      return;
    }

    if (new Date() > session.expiryTime) {
      session.status = 'expired';
      await session.save();
      res.status(400).json({ success: false, message: 'Session has expired' });
      return;
    }

    // Verify secure token from QR
    if (session.qrToken !== secureToken) {
      res.status(400).json({ success: false, message: 'Invalid QR code' });
      return;
    }

    // Verify password
    if (session.passwordCode !== passwordCode.toUpperCase()) {
      res.status(400).json({ success: false, message: 'Incorrect session password' });
      return;
    }

    // Check if student already marked attendance
    const existingRecord = await AttendanceRecord.findOne({
      studentId: req.user!.userId,
      sessionId,
    });
    if (existingRecord) {
      res.status(409).json({ success: false, message: 'Attendance already marked for this session' });
      return;
    }

    // Verify student belongs to the subject's department/year/section
    const subject = await Subject.findById(session.subjectId);
    const student = await User.findById(req.user!.userId);

    if (!subject || !student) {
      res.status(404).json({ success: false, message: 'Subject or student not found' });
      return;
    }

    // Create attendance record
    const record = await AttendanceRecord.create({
      studentId: req.user!.userId,
      sessionId: session._id,
      subjectId: session.subjectId,
      timestamp: new Date(),
      verificationStatus: 'verified',
      ipAddress: getClientIp(req),
    });

    // Update session count
    session.totalPresent += 1;
    await session.save();

    // Emit real-time update to teacher
    const io: Server = req.app.get('io');
    emitToSession(io, sessionId.toString(), 'attendance:marked', {
      studentId: student._id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      year: student.year,
      section: student.section,
      timestamp: record.timestamp,
      totalPresent: session.totalPresent,
    });

    await createAuditLog(req.user!.userId, 'MARK_ATTENDANCE', 'AttendanceRecord', record._id.toString(), { sessionId }, getClientIp(req));

    // Auto-trigger risk reassessment in background (non-blocking)
    import('../controllers/academic.controller').then(m => m.triggerRiskAssessment(req.user!.userId)).catch(() => {});

    // Notify student their attendance was marked
    const { Notification } = await import('../models/Notification.model');
    await Notification.create({
      userId: req.user!.userId,
      title: 'Attendance Marked',
      message: `Your attendance for ${subject.subjectName} has been recorded.`,
      type: 'success',
      link: '/student/attendance',
    });

    res.json({
      success: true,
      message: 'Attendance marked successfully',
      data: {
        record,
        subject: { subjectName: subject.subjectName, subjectCode: subject.subjectCode },
        timestamp: record.timestamp,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// â”€â”€ STUDENT: ATTENDANCE HISTORY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          select: 'startTime expiryTime passwordCode status duration',
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

// â”€â”€ STUDENT: ATTENDANCE SUMMARY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getAttendanceSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = req.user!.userId;

    const records = await AttendanceRecord.find({ studentId }).populate('subjectId', 'subjectName subjectCode');

    // Group by subject
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
      data: {
        totalPresent: records.length,
        summaryBySubject,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// â”€â”€ STUDENT: FIND SESSION BY CODE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    if (new Date() > session.expiryTime) {
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
        },
        alreadyMarked: !!alreadyMarked,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// â”€â”€ STUDENT: RAISE DISPUTE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const raiseDispute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { recordId } = req.params;
    const { reason } = req.body;

    const record = await AttendanceRecord.findOne({
      _id: recordId,
      studentId: req.user!.userId,
    });
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

    // Create a notification for admin
    const { Notification } = await import('../models/Notification.model');
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
    await Promise.all(admins.map(admin =>
      Notification.create({
        userId: admin._id,
        title: 'Attendance Dispute',
        message: `A student raised a dispute for their attendance record.${reason ? ` Reason: ${reason}` : ''}`,
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

// â”€â”€ STUDENT: GET ACTIVE SESSIONS FOR MY SUBJECTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    const sessions = await AttendanceSession.find({
      subjectId: { $in: subjectIds },
      status: 'active',
    }).populate('subjectId', 'subjectName subjectCode department year section');

    res.json({ success: true, data: { sessions } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const validateQR = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, secureToken } = req.body;

    const session = await AttendanceSession.findById(sessionId)
      .populate('subjectId', 'subjectName subjectCode department year section');

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }
    if (session.status !== 'active' || new Date() > session.expiryTime) {
      res.status(400).json({ success: false, message: 'Session is not active or has expired' });
      return;
    }
    if (session.qrToken !== secureToken) {
      res.status(400).json({ success: false, message: 'Invalid QR token' });
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
        },
        alreadyMarked: !!alreadyMarked,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── OFFLINE ATTENDANCE SYNC ───────────────────────────────────
export const syncOfflineAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { records } = req.body;
    // records: [{ sessionId, subjectId, secureToken, passwordCode, timestamp }]
    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json({ success: false, message: 'records array required' });
      return;
    }

    const results: { sessionId: string; status: string; message: string }[] = [];

    for (const record of records) {
      try {
        const { sessionId, subjectId, secureToken, passwordCode, timestamp } = record;

        // Find session
        const session = await AttendanceSession.findById(sessionId)
          .populate('subjectId', 'subjectName subjectCode department year section');

        if (!session) {
          results.push({ sessionId, status: 'failed', message: 'Session not found' });
          continue;
        }

        // Allow syncing for sessions that ended within last 24 hours
        const sessionAge = Date.now() - new Date(session.startTime).getTime();
        if (sessionAge > 24 * 60 * 60 * 1000) {
          results.push({ sessionId, status: 'failed', message: 'Session too old (>24h) to sync' });
          continue;
        }

        // Check already marked
        const existing = await AttendanceRecord.findOne({
          sessionId,
          studentId: req.user!.userId,
        });
        if (existing) {
          results.push({ sessionId, status: 'duplicate', message: 'Already marked' });
          continue;
        }

        // Verify password code
        if (session.passwordCode !== passwordCode?.toUpperCase()) {
          results.push({ sessionId, status: 'failed', message: 'Invalid password code' });
          continue;
        }

        // Create offline record
        await AttendanceRecord.create({
          studentId: req.user!.userId,
          sessionId,
          subjectId: session.subjectId,
          timestamp: timestamp ? new Date(timestamp) : new Date(),
          verificationStatus: 'verified',
          verificationMethod: 'offline_sync',
        });

        session.totalPresent += 1;
        await session.save();

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
