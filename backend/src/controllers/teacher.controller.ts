import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Subject } from '../models/Subject.model';
import { Timetable } from '../models/Timetable.model';
import { AttendanceSession } from '../models/AttendanceSession.model';
import { AttendanceRecord } from '../models/AttendanceRecord.model';
import { User } from '../models/User.model';

export const getMySubjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const subjects = await Subject.find({
      assignedTeacher: req.user!.userId,
      isActive: true,
    }).sort({ subjectName: 1 });
    res.json({ success: true, data: { subjects } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const timetable = await Timetable.find({
      teacherId: req.user!.userId,
      isActive: true,
    })
      .populate('subjectId', 'subjectName subjectCode department year section')
      .sort({ day: 1, startTime: 1 });
    res.json({ success: true, data: { timetable } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getActiveSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessions = await AttendanceSession.find({
      teacherId: req.user!.userId,
      status: 'active',
    }).populate('subjectId', 'subjectName subjectCode department year section');
    res.json({ success: true, data: { sessions } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSessionReport = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const records = await AttendanceRecord.find({ sessionId })
      .populate('studentId', 'name email rollNumber year section department')
      .sort({ timestamp: 1 });

    res.json({ success: true, data: { session, records, totalPresent: records.length } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSubjectAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subjectId } = req.params;

    const subject = await Subject.findOne({ _id: subjectId, assignedTeacher: req.user!.userId });
    if (!subject) {
      res.status(404).json({ success: false, message: 'Subject not found' });
      return;
    }

    const sessions = await AttendanceSession.find({ subjectId, teacherId: req.user!.userId }).sort({ createdAt: -1 });
    const sessionIds = sessions.map(s => s._id);

    const records = await AttendanceRecord.find({ subjectId, sessionId: { $in: sessionIds } })
      .populate('studentId', 'name rollNumber year section');

    // Group by student
    const studentMap = new Map<string, { name: string; rollNumber: string; present: number }>();
    records.forEach(record => {
      const student = record.studentId as any;
      const key = student._id.toString();
      if (!studentMap.has(key)) {
        studentMap.set(key, { name: student.name, rollNumber: student.rollNumber, present: 0 });
      }
      studentMap.get(key)!.present += 1;
    });

    const studentStats = Array.from(studentMap.entries()).map(([id, data]) => ({
      studentId: id,
      ...data,
      totalSessions: sessions.length,
      percentage: sessions.length > 0 ? Math.round((data.present / sessions.length) * 100) : 0,
    }));

    res.json({
      success: true,
      data: { subject, sessions, studentStats, totalSessions: sessions.length },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
