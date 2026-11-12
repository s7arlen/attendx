import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Subject } from '../models/Subject.model';
import { AttendanceRecord } from '../models/AttendanceRecord.model';
import { AttendanceSession } from '../models/AttendanceSession.model';

export const getMySubjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await import('../models/User.model').then(m => m.User.findById(req.user!.userId));
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    const subjects = await Subject.find({
      department: student.department,
      year: student.year,
      section: student.section,
      isActive: true,
    }).populate('assignedTeacher', 'name email');

    res.json({ success: true, data: { subjects } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const records = await AttendanceRecord.find({ studentId: req.user!.userId })
      .populate('subjectId', 'subjectName subjectCode department')
      .populate({
        path: 'sessionId',
        select: 'startTime endTime status',
      })
      .sort({ timestamp: -1 });

    // Group by subject
    const subjectMap = new Map<string, { subjectName: string; subjectCode: string; present: number; records: any[] }>();
    records.forEach(record => {
      const subject = record.subjectId as any;
      const key = subject._id.toString();
      if (!subjectMap.has(key)) {
        subjectMap.set(key, { subjectName: subject.subjectName, subjectCode: subject.subjectCode, present: 0, records: [] });
      }
      const entry = subjectMap.get(key)!;
      entry.present += 1;
      entry.records.push(record);
    });

    const bySubject = Array.from(subjectMap.entries()).map(([id, data]) => ({
      subjectId: id,
      subjectName: data.subjectName,
      subjectCode: data.subjectCode,
      present: data.present,
      records: data.records,
    }));

    res.json({
      success: true,
      data: {
        totalPresent: records.length,
        bySubject,
        recentRecords: records.slice(0, 10),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await import('../models/User.model').then(m => m.User.findById(req.user!.userId));
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    const subjects = await Subject.find({
      department: student.department,
      year: student.year,
      section: student.section,
      isActive: true,
    });

    const totalSubjects = subjects.length;
    const subjectIds = subjects.map(s => s._id);

    const records = await AttendanceRecord.find({
      studentId: req.user!.userId,
      subjectId: { $in: subjectIds },
    });

    const totalSessions = await AttendanceSession.countDocuments({
      subjectId: { $in: subjectIds },
      status: { $in: ['ended', 'expired'] },
    });

    const percentage = totalSessions > 0 ? Math.round((records.length / totalSessions) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalSubjects,
        totalPresent: records.length,
        totalAbsent: Math.max(0, totalSessions - records.length),
        attendancePercentage: percentage,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
