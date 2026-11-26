import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.model';
import { Subject } from '../models/Subject.model';
import { Timetable } from '../models/Timetable.model';
import { AttendanceRecord } from '../models/AttendanceRecord.model';
import { AttendanceSession } from '../models/AttendanceSession.model';
import { AuditLog } from '../models/AuditLog.model';
import { Notification } from '../models/Notification.model';
import {
  getSystemSettings,
  MIN_QR_REFRESH_SECONDS,
  MAX_QR_REFRESH_SECONDS,
} from '../models/SystemSettings.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { createAuditLog, getClientIp } from '../utils/auditLogger';
import { clampPagination, escapeRegex, isValidObjectId } from '../utils/security';
import { z } from 'zod';

const USER_SAFE_PROJECTION = '-passwordHash -refreshToken -passwordResetToken -passwordResetExpires -passwordResetAttempts';

const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(['teacher', 'student', 'security']),
  department: z.string().min(2).max(100),
  year: z.number().int().min(1).max(4).optional(),
  section: z.string().max(20).optional(),
  rollNumber: z.string()
    .optional()
    .refine(v => !v || /^4CB\d{2}(CS|AI|IS|CG|EC|ME|CV|EE)\d{3}$/i.test(v), {
      message: 'USN must be in format 4CB25CS001',
    }),
  phone: z.string().max(30).optional(),
});

const updateTeacherSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  department: z.string().min(2).max(100).optional(),
  phone: z.string().max(30).optional(),
  isActive: z.boolean().optional(),
});

const updateStudentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  department: z.string().min(2).max(100).optional(),
  year: z.coerce.number().int().min(1).max(4).optional(),
  section: z.string().max(20).optional(),
  rollNumber: z.string().max(30).optional(),
  phone: z.string().max(30).optional(),
  isActive: z.boolean().optional(),
});

const createSubjectSchema = z.object({
  subjectName: z.string().min(2).max(150),
  subjectCode: z.string().min(2).max(20),
  assignedTeacher: z.string().refine(isValidObjectId, 'Invalid teacher ID'),
  department: z.string().min(2).max(100),
  year: z.coerce.number().int().min(1).max(4),
  section: z.string().max(20),
  credits: z.coerce.number().int().min(0).max(6).optional(),
  description: z.string().max(500).optional(),
});

const updateSubjectSchema = createSubjectSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const timetableSchema = z.object({
  subjectId: z.string().refine(isValidObjectId, 'Invalid subject ID'),
  teacherId: z.string().refine(isValidObjectId, 'Invalid teacher ID'),
  day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid HH:MM format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid HH:MM format'),
  room: z.string().max(50).optional(),
});

// ── DASHBOARD ──────────────────────────────────────────────
export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [totalStudents, totalTeachers, totalSubjects, recentRecords] = await Promise.all([
      User.countDocuments({ role: 'student', isActive: true }),
      User.countDocuments({ role: 'teacher', isActive: true }),
      Subject.countDocuments({ isActive: true }),
      AttendanceRecord.find().sort({ createdAt: -1 }).limit(100),
    ]);

    const totalAttendance = recentRecords.length;
    const verifiedAttendance = recentRecords.filter(r => r.verificationStatus === 'verified').length;
    const attendancePercentage = totalAttendance > 0 ? Math.round((verifiedAttendance / totalAttendance) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalStudents,
        totalTeachers,
        totalSubjects,
        attendancePercentage,
        totalSessions: totalAttendance,
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load dashboard stats' });
  }
};

// ── TEACHERS ──────────────────────────────────────────────
export const getTeachers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search } = req.query;
    const { page, limit, skip } = clampPagination(req.query.page, req.query.limit, 20, 100);
    const query: any = { role: 'teacher' };
    if (search && typeof search === 'string') {
      const safe = escapeRegex(search.trim());
      query.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { email: { $regex: safe, $options: 'i' } },
        { department: { $regex: safe, $options: 'i' } },
      ];
    }
    const [teachers, total] = await Promise.all([
      User.find(query).select(USER_SAFE_PROJECTION).skip(skip).limit(limit).sort({ createdAt: -1 }),
      User.countDocuments(query),
    ]);
    res.json({ success: true, data: { teachers, total, page, limit } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load teachers' });
  }
};

export const createTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validation = createUserSchema.safeParse({ ...req.body, role: 'teacher' });
    if (!validation.success) {
      res.status(400).json({ success: false, errors: validation.error.issues });
      return;
    }
    const { name, email, password, department, phone } = validation.data;
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) { res.status(409).json({ success: false, message: 'Email already exists' }); return; }
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    const teacher = await User.create({ name, email, passwordHash, role: 'teacher', department, phone });
    await createAuditLog(req.user!.userId, 'CREATE_TEACHER', 'User', teacher._id.toString(), { name, email }, getClientIp(req));
    res.status(201).json({ success: true, message: 'Teacher created', data: { teacher } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to create teacher' });
  }
};

export const updateTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) { res.status(400).json({ success: false, message: 'Invalid teacher ID' }); return; }
    const parsed = updateTeacherSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.issues }); return; }
    const teacher = await User.findOneAndUpdate(
      { _id: id, role: 'teacher' },
      { $set: parsed.data },
      { new: true }
    ).select(USER_SAFE_PROJECTION);
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found' }); return; }
    await createAuditLog(req.user!.userId, 'UPDATE_TEACHER', 'User', id, { name: teacher.name }, getClientIp(req));
    res.json({ success: true, data: { teacher } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update teacher' });
  }
};

export const deleteTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) { res.status(400).json({ success: false, message: 'Invalid teacher ID' }); return; }
    await User.findOneAndUpdate({ _id: id, role: 'teacher' }, { isActive: false });
    await createAuditLog(req.user!.userId, 'DEACTIVATE_TEACHER', 'User', id, {}, getClientIp(req));
    res.json({ success: true, message: 'Teacher deactivated' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to deactivate teacher' });
  }
};

export const activateTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) { res.status(400).json({ success: false, message: 'Invalid teacher ID' }); return; }
    const teacher = await User.findOneAndUpdate(
      { _id: id, role: 'teacher' },
      { isActive: true },
      { new: true }
    ).select(USER_SAFE_PROJECTION);
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found' }); return; }
    await createAuditLog(req.user!.userId, 'ACTIVATE_TEACHER', 'User', id, {}, getClientIp(req));
    res.json({ success: true, message: 'Teacher activated' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to activate teacher' });
  }
};

export const hardDeleteTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) { res.status(400).json({ success: false, message: 'Invalid teacher ID' }); return; }
    const teacher = await User.findOne({ _id: id, role: 'teacher' });
    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher not found' });
      return;
    }
    await User.findByIdAndDelete(id);
    await createAuditLog(req.user!.userId, 'HARD_DELETE_TEACHER', 'User', id, { name: teacher.name, email: teacher.email }, getClientIp(req));
    res.json({ success: true, message: 'Teacher permanently deleted' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete teacher' });
  }
};

// ── STUDENTS ──────────────────────────────────────────────
export const getStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, department, year, section } = req.query;
    const { page, limit, skip } = clampPagination(req.query.page, req.query.limit, 20, 100);
    const query: any = { role: 'student' };
    if (search && typeof search === 'string') {
      const safe = escapeRegex(search.trim());
      query.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { email: { $regex: safe, $options: 'i' } },
        { rollNumber: { $regex: safe, $options: 'i' } },
      ];
    }
    if (department && typeof department === 'string') query.department = department;
    if (year) query.year = Number(year);
    if (section && typeof section === 'string') query.section = section;
    const [students, total] = await Promise.all([
      User.find(query).select(USER_SAFE_PROJECTION).skip(skip).limit(limit).sort({ name: 1 }),
      User.countDocuments(query),
    ]);
    res.json({ success: true, data: { students, total, page, limit } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load students' });
  }
};

export const createStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validation = createUserSchema.safeParse({ ...req.body, role: 'student' });
    if (!validation.success) {
      res.status(400).json({ success: false, errors: validation.error.issues });
      return;
    }
    const { name, email, password, department, year, section, rollNumber, phone } = validation.data;
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) { res.status(409).json({ success: false, message: 'Email already exists' }); return; }
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    const student = await User.create({ name, email, passwordHash, role: 'student', department, year, section, rollNumber, phone });
    await createAuditLog(req.user!.userId, 'CREATE_STUDENT', 'User', student._id.toString(), { name, email }, getClientIp(req));
    res.status(201).json({ success: true, message: 'Student created', data: { student } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to create student' });
  }
};

export const updateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) { res.status(400).json({ success: false, message: 'Invalid student ID' }); return; }
    const parsed = updateStudentSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.issues }); return; }
    const student = await User.findOneAndUpdate(
      { _id: id, role: 'student' },
      { $set: parsed.data },
      { new: true }
    ).select(USER_SAFE_PROJECTION);
    if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return; }
    res.json({ success: true, data: { student } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update student' });
  }
};

export const deleteStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) { res.status(400).json({ success: false, message: 'Invalid student ID' }); return; }
    await User.findOneAndUpdate({ _id: id, role: 'student' }, { isActive: false });
    await createAuditLog(req.user!.userId, 'DEACTIVATE_STUDENT', 'User', id, {}, getClientIp(req));
    res.json({ success: true, message: 'Student deactivated' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to deactivate student' });
  }
};

export const activateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) { res.status(400).json({ success: false, message: 'Invalid student ID' }); return; }
    const student = await User.findOneAndUpdate(
      { _id: id, role: 'student' },
      { isActive: true },
      { new: true }
    ).select(USER_SAFE_PROJECTION);
    if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return; }
    await createAuditLog(req.user!.userId, 'ACTIVATE_STUDENT', 'User', id, {}, getClientIp(req));
    res.json({ success: true, message: 'Student activated' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to activate student' });
  }
};

export const hardDeleteStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) { res.status(400).json({ success: false, message: 'Invalid student ID' }); return; }
    const student = await User.findOne({ _id: id, role: 'student' });
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }
    await User.findByIdAndDelete(id);
    await createAuditLog(req.user!.userId, 'HARD_DELETE_STUDENT', 'User', id, { name: student.name, email: student.email }, getClientIp(req));
    res.json({ success: true, message: 'Student permanently deleted' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete student' });
  }
};

// ── SUBJECTS ──────────────────────────────────────────────
export const getSubjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const subjects = await Subject.find({ isActive: true })
      .populate('assignedTeacher', 'name email department')
      .sort({ subjectName: 1 });
    res.json({ success: true, data: { subjects } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load subjects' });
  }
};

export const createSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validation = createSubjectSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, errors: validation.error.issues });
      return;
    }

    const existing = await Subject.findOne({ subjectCode: validation.data.subjectCode.toUpperCase() });
    if (existing) {
      if (!existing.isActive) {
        const updated = await Subject.findByIdAndUpdate(
          existing._id,
          { ...validation.data, isActive: true },
          { new: true }
        ).populate('assignedTeacher', 'name email');
        await createAuditLog(req.user!.userId, 'REACTIVATE_SUBJECT', 'Subject', existing._id.toString(), {}, getClientIp(req));
        res.status(201).json({ success: true, message: 'Subject reactivated and updated', data: { subject: updated } });
        return;
      }
      res.status(409).json({
        success: false,
        message: `Subject code "${validation.data.subjectCode.toUpperCase()}" is already in use.`,
      });
      return;
    }

    const subject = await Subject.create(validation.data);
    const populated = await Subject.findById(subject._id).populate('assignedTeacher', 'name email');
    await createAuditLog(req.user!.userId, 'CREATE_SUBJECT', 'Subject', subject._id.toString(), {}, getClientIp(req));
    res.status(201).json({ success: true, data: { subject: populated } });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({ success: false, message: 'Subject code is already in use.' });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to create subject' });
  }
};

export const updateSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) { res.status(400).json({ success: false, message: 'Invalid subject ID' }); return; }
    const parsed = updateSubjectSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.issues }); return; }
    const subject = await Subject.findByIdAndUpdate(id, { $set: parsed.data }, { new: true })
      .populate('assignedTeacher', 'name email');
    if (!subject) { res.status(404).json({ success: false, message: 'Subject not found' }); return; }
    res.json({ success: true, data: { subject } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update subject' });
  }
};

export const deleteSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) { res.status(400).json({ success: false, message: 'Invalid subject ID' }); return; }
    await Subject.findByIdAndUpdate(id, { isActive: false });
    await createAuditLog(req.user!.userId, 'DEACTIVATE_SUBJECT', 'Subject', id, {}, getClientIp(req));
    res.json({ success: true, message: 'Subject deactivated' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to deactivate subject' });
  }
};

export const hardDeleteSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) { res.status(400).json({ success: false, message: 'Invalid subject ID' }); return; }
    const subject = await Subject.findById(id);
    if (!subject) {
      res.status(404).json({ success: false, message: 'Subject not found' });
      return;
    }

    const [recordCount, sessionCount] = await Promise.all([
      AttendanceRecord.countDocuments({ subjectId: id }),
      AttendanceSession.countDocuments({ subjectId: id }),
    ]);

    if (recordCount > 0 || sessionCount > 0) {
      res.status(409).json({
        success: false,
        message: `Cannot permanently delete "${subject.subjectName}" because it has ${recordCount} attendance record(s) and ${sessionCount} session(s).`,
      });
      return;
    }

    await Subject.findByIdAndDelete(id);
    await createAuditLog(req.user!.userId, 'HARD_DELETE_SUBJECT', 'Subject', id, { subjectName: subject.subjectName, subjectCode: subject.subjectCode }, getClientIp(req));
    res.json({ success: true, message: 'Subject permanently deleted' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete subject' });
  }
};

// ── TIMETABLE ──────────────────────────────────────────────
export const getTimetables = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const timetables = await Timetable.find({ isActive: true })
      .populate('subjectId', 'subjectName subjectCode department year section')
      .populate('teacherId', 'name email')
      .sort({ day: 1, startTime: 1 });
    res.json({ success: true, data: { timetables } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load timetables' });
  }
};

export const createTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = timetableSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.issues }); return;
    }
    const { subjectId, teacherId, day, startTime, endTime, room } = parsed.data;

    const conflict = await Timetable.findOne({
      teacherId,
      day,
      isActive: true,
      $or: [
        { startTime: { $lt: endTime, $gte: startTime } },
        { endTime:   { $gt: startTime, $lte: endTime } },
        { startTime: { $lte: startTime }, endTime: { $gte: endTime } },
      ],
    }).populate('subjectId', 'subjectName');

    if (conflict) {
      const conflictSubject = (conflict.subjectId as any)?.subjectName ?? 'another class';
      res.status(409).json({
        success: false,
        message: `Time conflict: this teacher already has "${conflictSubject}" on ${day} from ${conflict.startTime} to ${conflict.endTime}.`,
      });
      return;
    }

    const timetable = await Timetable.create({ subjectId, teacherId, day, startTime, endTime, room });
    const populated = await Timetable.findById(timetable._id)
      .populate('subjectId', 'subjectName subjectCode')
      .populate('teacherId', 'name email');
    res.status(201).json({ success: true, data: { timetable: populated } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to create timetable entry' });
  }
};

export const updateTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) { res.status(400).json({ success: false, message: 'Invalid timetable ID' }); return; }
    const parsed = timetableSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.issues }); return; }
    const { subjectId, teacherId, day, startTime, endTime, room } = parsed.data;

    const conflict = await Timetable.findOne({
      _id: { $ne: id },
      teacherId,
      day,
      isActive: true,
      $or: [
        { startTime: { $lt: endTime, $gte: startTime } },
        { endTime:   { $gt: startTime, $lte: endTime } },
        { startTime: { $lte: startTime }, endTime: { $gte: endTime } },
      ],
    }).populate('subjectId', 'subjectName');

    if (conflict) {
      const conflictSubject = (conflict.subjectId as any)?.subjectName ?? 'another class';
      res.status(409).json({
        success: false,
        message: `Time conflict: this teacher already has "${conflictSubject}" on ${day} from ${conflict.startTime} to ${conflict.endTime}.`,
      });
      return;
    }

    const timetable = await Timetable.findByIdAndUpdate(
      id,
      { subjectId, teacherId, day, startTime, endTime, room },
      { new: true }
    ).populate('subjectId', 'subjectName subjectCode').populate('teacherId', 'name email');
    if (!timetable) { res.status(404).json({ success: false, message: 'Timetable not found' }); return; }
    res.json({ success: true, data: { timetable } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update timetable' });
  }
};

export const deleteTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) { res.status(400).json({ success: false, message: 'Invalid timetable ID' }); return; }
    await Timetable.findByIdAndUpdate(id, { isActive: false });
    res.json({ success: true, message: 'Timetable entry deleted' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete timetable entry' });
  }
};

// ── REPORTS ──────────────────────────────────────────────
export const getAdminReports = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const records = await AttendanceRecord.find({
      createdAt: { $gte: start, $lte: end },
    })
      .populate('subjectId', 'subjectName subjectCode')
      .populate('studentId', 'name rollNumber department year section')
      .limit(5000);

    res.json({ success: true, data: { records, total: records.length } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load reports' });
  }
};

// ── AUDIT LOGS ──────────────────────────────────────────────
export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action, resource } = req.query;
    const { page, limit, skip } = clampPagination(req.query.page, req.query.limit, 30, 100);
    const query: any = {};
    if (action && typeof action === 'string') query.action = { $regex: escapeRegex(action.trim()), $options: 'i' };
    if (resource && typeof resource === 'string') query.resource = resource;
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('userId', 'name email role')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      AuditLog.countDocuments(query),
    ]);
    res.json({ success: true, data: { logs, total, page, limit } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load audit logs' });
  }
};

// ── SUBJECT SEARCH ──────────────────────────────────────────
export const searchSubjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q, department, year, section } = req.query;
    const query: any = { isActive: true };
    if (q && typeof q === 'string') {
      const safe = escapeRegex(q.trim());
      query.$or = [
        { subjectName: { $regex: safe, $options: 'i' } },
        { subjectCode: { $regex: safe, $options: 'i' } },
      ];
    }
    if (department && typeof department === 'string') query.department = department;
    if (year) query.year = Number(year);
    if (section && typeof section === 'string') query.section = section;
    const subjects = await Subject.find(query)
      .populate('assignedTeacher', 'name email department')
      .sort({ subjectName: 1 })
      .limit(50);
    res.json({ success: true, data: { subjects } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to search subjects' });
  }
};

// ── ATTENDANCE DISPUTES / CORRECTION ────────────────────────
export const getDisputes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const { page, limit, skip } = clampPagination(req.query.page, req.query.limit, 20, 100);
    const query: any = {};
    if (status && ['pending', 'verified', 'rejected'].includes(String(status))) query.verificationStatus = String(status);
    else query.verificationStatus = 'pending';
    const [records, total] = await Promise.all([
      AttendanceRecord.find(query)
        .populate('studentId', 'name rollNumber email department year section')
        .populate('subjectId', 'subjectName subjectCode')
        .populate('sessionId', 'startTime status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      AttendanceRecord.countDocuments(query),
    ]);
    res.json({ success: true, data: { records, total, page, limit } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load disputes' });
  }
};

export const resolveDispute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) { res.status(400).json({ success: false, message: 'Invalid dispute ID' }); return; }
    const { verificationStatus } = req.body;
    if (!['verified', 'rejected'].includes(verificationStatus)) {
      res.status(400).json({ success: false, message: 'Status must be verified or rejected' });
      return;
    }
    const record = await AttendanceRecord.findByIdAndUpdate(
      id,
      { verificationStatus },
      { new: true }
    );
    if (!record) { res.status(404).json({ success: false, message: 'Record not found' }); return; }
    await createAuditLog(req.user!.userId, 'RESOLVE_DISPUTE', 'AttendanceRecord', id, { verificationStatus }, getClientIp(req));
    res.json({ success: true, message: `Record ${verificationStatus}`, data: { record } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to resolve dispute' });
  }
};

// ── ROLE / DEPARTMENT EDITING ────────────────────────────────
export const updateUserRoleDept = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) { res.status(400).json({ success: false, message: 'Invalid user ID' }); return; }
    const { role, department } = req.body;
    const allowed: any = {};
    if (role && ['teacher', 'student'].includes(role)) allowed.role = role;
    if (department && typeof department === 'string') allowed.department = department.trim().slice(0, 100);
    const user = await User.findByIdAndUpdate(id, { $set: allowed }, { new: true }).select(USER_SAFE_PROJECTION);
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    await createAuditLog(req.user!.userId, 'UPDATE_USER_ROLE_DEPT', 'User', id, allowed, getClientIp(req));
    res.json({ success: true, message: 'User role/department updated', data: { user } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update role/department' });
  }
};

// ── NOTIFICATIONS ────────────────────────────────────────────
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifications = await Notification.find({ userId: req.user!.userId })
      .sort({ createdAt: -1 })
      .limit(30);
    const unread = notifications.filter((n) => !n.read).length;
    res.json({ success: true, data: { notifications, unread } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load notifications' });
  }
};

export const markNotificationsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.updateMany({ userId: req.user!.userId, read: false }, { read: true });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to mark notifications read' });
  }
};

// ── SYSTEM SETTINGS ──────────────────────────────────────────
const updateSettingsSchema = z.object({
  qrRefreshSeconds: z.coerce
    .number()
    .int()
    .min(MIN_QR_REFRESH_SECONDS, `Minimum refresh interval is ${MIN_QR_REFRESH_SECONDS}s`)
    .max(MAX_QR_REFRESH_SECONDS, `Maximum refresh interval is ${MAX_QR_REFRESH_SECONDS}s`),
  applyToActiveSessions: z.boolean().optional().default(true),
});

export const getAdminSettings = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await getSystemSettings();
    res.json({
      success: true,
      data: {
        qrRefreshSeconds: settings.qrRefreshSeconds,
        minQrRefreshSeconds: MIN_QR_REFRESH_SECONDS,
        maxQrRefreshSeconds: MAX_QR_REFRESH_SECONDS,
        updatedAt: settings.updatedAt,
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load system settings' });
  }
};

export const updateAdminSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid settings parameters',
        errors: parsed.error.issues,
      });
      return;
    }

    const { qrRefreshSeconds, applyToActiveSessions } = parsed.data;
    const settings = await getSystemSettings();
    settings.qrRefreshSeconds = qrRefreshSeconds;
    settings.updatedBy = req.user!.userId as any;
    await settings.save();

    let updatedActiveSessions = 0;
    if (applyToActiveSessions) {
      const result = await AttendanceSession.updateMany(
        { status: 'active' },
        { $set: { qrRefreshSeconds } }
      );
      updatedActiveSessions = result.modifiedCount ?? 0;
    }

    await createAuditLog(
      req.user!.userId,
      'UPDATE_SETTINGS',
      'SystemSettings',
      settings._id.toString(),
      { qrRefreshSeconds, applyToActiveSessions, updatedActiveSessions },
      getClientIp(req)
    );

    res.json({
      success: true,
      message: 'QR refresh settings updated',
      data: {
        qrRefreshSeconds: settings.qrRefreshSeconds,
        minQrRefreshSeconds: MIN_QR_REFRESH_SECONDS,
        maxQrRefreshSeconds: MAX_QR_REFRESH_SECONDS,
        updatedActiveSessions,
        updatedAt: settings.updatedAt,
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update system settings' });
  }
};
