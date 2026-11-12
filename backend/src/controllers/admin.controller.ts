import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.model';
import { Subject } from '../models/Subject.model';
import { Timetable } from '../models/Timetable.model';
import { AttendanceRecord } from '../models/AttendanceRecord.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { createAuditLog, getClientIp } from '../utils/auditLogger';
import { z } from 'zod';

const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['teacher', 'student', 'security']),
  department: z.string().min(2),
  year: z.number().int().min(1).max(4).optional(),
  section: z.string().optional(),
  rollNumber: z.string()
    .optional()
    .refine(v => !v || /^4CB\d{2}(CS|AI|IS|CG|EC|ME|CV|EE)\d{3}$/i.test(v), {
      message: 'USN must be in format 4CB25CS001',
    }),
  phone: z.string().optional(),
});

const createSubjectSchema = z.object({
  subjectName: z.string().min(2),
  subjectCode: z.string().min(2).max(20),
  assignedTeacher: z.string(),
  department: z.string().min(2),
  year: z.number().int().min(1).max(4),
  section: z.string(),
  credits: z.number().int().min(1).max(6).optional(),
  description: z.string().optional(),
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── TEACHERS ──────────────────────────────────────────────
export const getTeachers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query: any = { role: 'teacher' };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [teachers, total] = await Promise.all([
      User.find(query).select('-passwordHash -refreshToken').skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
      User.countDocuments(query),
    ]);
    res.json({ success: true, data: { teachers, total, page: Number(page), limit: Number(limit) } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validation = createUserSchema.safeParse({ ...req.body, role: 'teacher' });
    if (!validation.success) {
      res.status(400).json({ success: false, errors: validation.error.errors });
      return;
    }
    const { name, email, password, department, phone } = validation.data;
    const existing = await User.findOne({ email });
    if (existing) { res.status(409).json({ success: false, message: 'Email already exists' }); return; }
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    const teacher = await User.create({ name, email, passwordHash, role: 'teacher', department, phone });
    await createAuditLog(req.user!.userId, 'CREATE_TEACHER', 'User', teacher._id.toString(), { name, email }, getClientIp(req));
    res.status(201).json({ success: true, message: 'Teacher created', data: { teacher } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, department, phone, isActive } = req.body;
    const teacher = await User.findOneAndUpdate(
      { _id: id, role: 'teacher' },
      { name, department, phone, isActive },
      { new: true }
    ).select('-passwordHash -refreshToken');
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found' }); return; }
    await createAuditLog(req.user!.userId, 'UPDATE_TEACHER', 'User', id, { name }, getClientIp(req));
    res.json({ success: true, data: { teacher } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await User.findOneAndUpdate({ _id: id, role: 'teacher' }, { isActive: false });
    await createAuditLog(req.user!.userId, 'DEACTIVATE_TEACHER', 'User', id, {}, getClientIp(req));
    res.json({ success: true, message: 'Teacher deactivated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const activateTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const teacher = await User.findOneAndUpdate(
      { _id: id, role: 'teacher' },
      { isActive: true },
      { new: true }
    ).select('-passwordHash -refreshToken');
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found' }); return; }
    await createAuditLog(req.user!.userId, 'ACTIVATE_TEACHER', 'User', id, {}, getClientIp(req));
    res.json({ success: true, message: 'Teacher activated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const hardDeleteTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const teacher = await User.findOne({ _id: id, role: 'teacher' });
    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher not found' });
      return;
    }
    await User.findByIdAndDelete(id);
    await createAuditLog(req.user!.userId, 'HARD_DELETE_TEACHER', 'User', id, { name: teacher.name, email: teacher.email }, getClientIp(req));
    res.json({ success: true, message: 'Teacher permanently deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── STUDENTS ──────────────────────────────────────────────
export const getStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, department, year, section, page = 1, limit = 20 } = req.query;
    const query: any = { role: 'student' };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } },
      ];
    }
    if (department) query.department = department;
    if (year) query.year = Number(year);
    if (section) query.section = section;
    const skip = (Number(page) - 1) * Number(limit);
    const [students, total] = await Promise.all([
      User.find(query).select('-passwordHash -refreshToken').skip(skip).limit(Number(limit)).sort({ name: 1 }),
      User.countDocuments(query),
    ]);
    res.json({ success: true, data: { students, total, page: Number(page), limit: Number(limit) } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validation = createUserSchema.safeParse({ ...req.body, role: 'student' });
    if (!validation.success) {
      res.status(400).json({ success: false, errors: validation.error.errors });
      return;
    }
    const { name, email, password, department, year, section, rollNumber, phone } = validation.data;
    const existing = await User.findOne({ email });
    if (existing) { res.status(409).json({ success: false, message: 'Email already exists' }); return; }
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    const student = await User.create({ name, email, passwordHash, role: 'student', department, year, section, rollNumber, phone });
    await createAuditLog(req.user!.userId, 'CREATE_STUDENT', 'User', student._id.toString(), { name, email }, getClientIp(req));
    res.status(201).json({ success: true, message: 'Student created', data: { student } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, department, year, section, rollNumber, phone, isActive } = req.body;
    const student = await User.findOneAndUpdate(
      { _id: id, role: 'student' },
      { name, department, year, section, rollNumber, phone, isActive },
      { new: true }
    ).select('-passwordHash -refreshToken');
    if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return; }
    res.json({ success: true, data: { student } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await User.findOneAndUpdate({ _id: id, role: 'student' }, { isActive: false });
    await createAuditLog(req.user!.userId, 'DEACTIVATE_STUDENT', 'User', id, {}, getClientIp(req));
    res.json({ success: true, message: 'Student deactivated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const activateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const student = await User.findOneAndUpdate(
      { _id: id, role: 'student' },
      { isActive: true },
      { new: true }
    ).select('-passwordHash -refreshToken');
    if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return; }
    await createAuditLog(req.user!.userId, 'ACTIVATE_STUDENT', 'User', id, {}, getClientIp(req));
    res.json({ success: true, message: 'Student activated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const hardDeleteStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const student = await User.findOne({ _id: id, role: 'student' });
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }
    await User.findByIdAndDelete(id);
    await createAuditLog(req.user!.userId, 'HARD_DELETE_STUDENT', 'User', id, { name: student.name, email: student.email }, getClientIp(req));
    res.json({ success: true, message: 'Student permanently deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── SUBJECTS ──────────────────────────────────────────────
export const getSubjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const subjects = await Subject.find({ isActive: true })
      .populate('assignedTeacher', 'name email department')
      .sort({ subjectName: 1 });
    res.json({ success: true, data: { subjects } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validation = createSubjectSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, errors: validation.error.errors });
      return;
    }

    // Check if a subject with this code already exists (active or inactive)
    const existing = await Subject.findOne({ subjectCode: validation.data.subjectCode.toUpperCase() });
    if (existing) {
      if (!existing.isActive) {
        // Reactivate and update the soft-deleted subject instead of throwing
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
        message: `Subject code "${validation.data.subjectCode.toUpperCase()}" is already in use. Each subject must have a unique code.`,
      });
      return;
    }

    const subject = await Subject.create(validation.data);
    const populated = await Subject.findById(subject._id).populate('assignedTeacher', 'name email');
    await createAuditLog(req.user!.userId, 'CREATE_SUBJECT', 'Subject', subject._id.toString(), {}, getClientIp(req));
    res.status(201).json({ success: true, data: { subject: populated } });
  } catch (error: any) {
    // Handle any remaining duplicate key errors gracefully
    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        message: `Subject code "${req.body.subjectCode}" is already in use. Each subject must have a unique code.`,
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const subject = await Subject.findByIdAndUpdate(id, req.body, { new: true })
      .populate('assignedTeacher', 'name email');
    if (!subject) { res.status(404).json({ success: false, message: 'Subject not found' }); return; }
    res.json({ success: true, data: { subject } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await Subject.findByIdAndUpdate(id, { isActive: false });
    await createAuditLog(req.user!.userId, 'DEACTIVATE_SUBJECT', 'Subject', id, {}, getClientIp(req));
    res.json({ success: true, message: 'Subject deactivated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const hardDeleteSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const subject = await Subject.findById(id);
    if (!subject) {
      res.status(404).json({ success: false, message: 'Subject not found' });
      return;
    }
    await Subject.findByIdAndDelete(id);
    await createAuditLog(req.user!.userId, 'HARD_DELETE_SUBJECT', 'Subject', id, { subjectName: subject.subjectName, subjectCode: subject.subjectCode }, getClientIp(req));
    res.json({ success: true, message: 'Subject permanently deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subjectId, teacherId, day, startTime, endTime, room } = req.body;

    // Conflict detection — same teacher, same day, overlapping time
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { subjectId, teacherId, day, startTime, endTime, room } = req.body;

    // Conflict detection — exclude the entry being edited
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await Timetable.findByIdAndUpdate(id, { isActive: false });
    res.json({ success: true, message: 'Timetable entry deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── REPORTS ──────────────────────────────────────────────
export const getAdminReports = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, type = 'daily' } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const records = await AttendanceRecord.find({
      createdAt: { $gte: start, $lte: end },
    }).populate('subjectId', 'subjectName subjectCode').populate('studentId', 'name rollNumber department year section');

    res.json({ success: true, data: { records, total: records.length } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── AUDIT LOGS ──────────────────────────────────────────────
import { AuditLog } from '../models/AuditLog.model';

export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 30, action, resource } = req.query;
    const query: any = {};
    if (action) query.action = { $regex: action, $options: 'i' };
    if (resource) query.resource = resource;
    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('userId', 'name email role')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(Number(limit)),
      AuditLog.countDocuments(query),
    ]);
    res.json({ success: true, data: { logs, total, page: Number(page), limit: Number(limit) } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── SUBJECT SEARCH ──────────────────────────────────────────
export const searchSubjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q, department, year, section } = req.query;
    const query: any = { isActive: true };
    if (q) {
      query.$or = [
        { subjectName: { $regex: q, $options: 'i' } },
        { subjectCode: { $regex: q, $options: 'i' } },
      ];
    }
    if (department) query.department = department;
    if (year) query.year = Number(year);
    if (section) query.section = section;
    const subjects = await Subject.find(query)
      .populate('assignedTeacher', 'name email department')
      .sort({ subjectName: 1 })
      .limit(50);
    res.json({ success: true, data: { subjects } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── ATTENDANCE DISPUTES / CORRECTION ────────────────────────
export const getDisputes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query: any = {};
    if (status) query.verificationStatus = status;
    else query.verificationStatus = 'pending';
    const skip = (Number(page) - 1) * Number(limit);
    const [records, total] = await Promise.all([
      AttendanceRecord.find(query)
        .populate('studentId', 'name rollNumber email department year section')
        .populate('subjectId', 'subjectName subjectCode')
        .populate('sessionId', 'startTime status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      AttendanceRecord.countDocuments(query),
    ]);
    res.json({ success: true, data: { records, total, page: Number(page), limit: Number(limit) } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resolveDispute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── ROLE / DEPARTMENT EDITING ────────────────────────────────
export const updateUserRoleDept = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, department } = req.body;
    const allowed: any = {};
    if (role && ['teacher', 'student'].includes(role)) allowed.role = role;
    if (department) allowed.department = department;
    const user = await User.findByIdAndUpdate(id, allowed, { new: true }).select('-passwordHash -refreshToken');
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    await createAuditLog(req.user!.userId, 'UPDATE_USER_ROLE_DEPT', 'User', id, allowed, getClientIp(req));
    res.json({ success: true, message: 'User role/department updated', data: { user } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── NOTIFICATIONS ────────────────────────────────────────────
import { Notification } from '../models/Notification.model';

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifications = await Notification.find({ userId: req.user!.userId })
      .sort({ createdAt: -1 })
      .limit(30);
    const unread = notifications.filter((n) => !n.read).length;
    res.json({ success: true, data: { notifications, unread } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markNotificationsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.updateMany({ userId: req.user!.userId, read: false }, { read: true });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
