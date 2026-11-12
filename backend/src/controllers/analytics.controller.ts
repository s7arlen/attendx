import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { AttendanceRecord } from '../models/AttendanceRecord.model';
import { AttendanceSession } from '../models/AttendanceSession.model';
import { Subject } from '../models/Subject.model';
import { User } from '../models/User.model';

// ── ADMIN ANALYTICS ──────────────────────────────────────────────
export const getAdminAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Daily attendance for last 30 days
    const dailyAttendance = await AttendanceRecord.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Subject-wise attendance
    const subjectAttendance = await AttendanceRecord.aggregate([
      {
        $group: {
          _id: '$subjectId',
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'subjects',
          localField: '_id',
          foreignField: '_id',
          as: 'subject',
        },
      },
      { $unwind: '$subject' },
      {
        $project: {
          subjectName: '$subject.subjectName',
          subjectCode: '$subject.subjectCode',
          count: 1,
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Monthly attendance
    const monthlyAttendance = await AttendanceRecord.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 12 },
    ]);

    const [totalStudents, totalTeachers, totalSubjects, totalSessions] = await Promise.all([
      User.countDocuments({ role: 'student', isActive: true }),
      User.countDocuments({ role: 'teacher', isActive: true }),
      Subject.countDocuments({ isActive: true }),
      AttendanceSession.countDocuments(),
    ]);

    res.json({
      success: true,
      data: {
        overview: { totalStudents, totalTeachers, totalSubjects, totalSessions },
        dailyAttendance: dailyAttendance.map(d => ({ date: d._id, count: d.count })),
        subjectAttendance,
        monthlyAttendance: monthlyAttendance.map(m => ({ month: m._id, count: m.count })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── TEACHER ANALYTICS ──────────────────────────────────────────────
export const getTeacherAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacherId = req.user!.userId;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const subjects = await Subject.find({ assignedTeacher: teacherId, isActive: true });
    const subjectIds = subjects.map(s => s._id);

    const sessions = await AttendanceSession.find({ teacherId });
    const sessionIds = sessions.map(s => s._id);

    // Attendance trend per session
    const attendanceTrend = await AttendanceSession.aggregate([
      { $match: { teacherId: { $toString: teacherId }, createdAt: { $gte: thirtyDaysAgo } } },
      {
        $lookup: {
          from: 'attendancerecords',
          localField: '_id',
          foreignField: 'sessionId',
          as: 'records',
        },
      },
      {
        $project: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          present: { $size: '$records' },
          subjectId: 1,
        },
      },
      { $sort: { date: 1 } },
    ]);

    // Per-subject stats
    const subjectStats = await AttendanceRecord.aggregate([
      { $match: { subjectId: { $in: subjectIds } } },
      { $group: { _id: '$subjectId', totalPresent: { $sum: 1 } } },
      {
        $lookup: { from: 'subjects', localField: '_id', foreignField: '_id', as: 'subject' },
      },
      { $unwind: '$subject' },
      {
        $project: {
          subjectName: '$subject.subjectName',
          subjectCode: '$subject.subjectCode',
          totalPresent: 1,
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        totalSubjects: subjects.length,
        totalSessions: sessions.length,
        subjects,
        attendanceTrend,
        subjectStats,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── STUDENT ANALYTICS ──────────────────────────────────────────────
export const getStudentAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = req.user!.userId;

    // Monthly attendance trend
    const monthlyTrend = await AttendanceRecord.aggregate([
      { $match: { studentId: { $toString: studentId } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Per-subject attendance
    const subjectBreakdown = await AttendanceRecord.aggregate([
      { $match: { studentId: { $toString: studentId } } },
      { $group: { _id: '$subjectId', present: { $sum: 1 } } },
      { $lookup: { from: 'subjects', localField: '_id', foreignField: '_id', as: 'subject' } },
      { $unwind: '$subject' },
      {
        $project: {
          subjectName: '$subject.subjectName',
          subjectCode: '$subject.subjectCode',
          department: '$subject.department',
          present: 1,
        },
      },
    ]);

    const totalRecords = await AttendanceRecord.countDocuments({ studentId });
    const recentActivity = await AttendanceRecord.find({ studentId })
      .populate('subjectId', 'subjectName subjectCode')
      .sort({ timestamp: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        totalPresent: totalRecords,
        monthlyTrend: monthlyTrend.map(m => ({ month: m._id, count: m.count })),
        subjectBreakdown,
        recentActivity,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
