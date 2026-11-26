import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import { Assessment } from '../models/Assessment.model';
import { AssessmentResult } from '../models/AssessmentResult.model';
import { Subject } from '../models/Subject.model';
import { User } from '../models/User.model';
import { AttendanceRecord } from '../models/AttendanceRecord.model';
import { AttendanceSession } from '../models/AttendanceSession.model';
import { RiskAssessment } from '../models/RiskAssessment.model';
import { mlPredict } from '../utils/mlClient';
import { isValidObjectId, sanitizeCsvCell } from '../utils/security';

const createAssessmentSchema = z.object({
  title: z.string().min(1).max(150),
  type: z.enum(['internal_exam', 'unit_test', 'quiz', 'assignment']),
  subjectId: z.string().refine(isValidObjectId, 'Invalid subject ID'),
  maxMarks: z.coerce.number().positive().max(1000),
  assessmentDate: z.string().min(1),
  dueDate: z.string().optional(),
  description: z.string().max(1000).optional(),
});

const updateAssessmentSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  type: z.enum(['internal_exam', 'unit_test', 'quiz', 'assignment']).optional(),
  maxMarks: z.coerce.number().positive().max(1000).optional(),
  assessmentDate: z.string().optional(),
  dueDate: z.string().optional(),
  description: z.string().max(1000).optional(),
});

const createInterventionSchema = z.object({
  studentId: z.string().refine(isValidObjectId, 'Invalid student ID'),
  type: z.enum(['counselling', 'mentoring', 'remedial_class', 'subject_support', 'assignment_help', 'parent_meeting', 'other']),
  description: z.string().min(1).max(1000),
  scheduledDate: z.string().min(1),
  followUpDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

const updateInterventionSchema = z.object({
  type: z.enum(['counselling', 'mentoring', 'remedial_class', 'subject_support', 'assignment_help', 'parent_meeting', 'other']).optional(),
  description: z.string().min(1).max(1000).optional(),
  scheduledDate: z.string().optional(),
  followUpDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(['pending', 'scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
});

async function ensureTeacherHasStudent(teacherId: string, studentId: string): Promise<boolean> {
  const student = await User.findOne({ _id: studentId, role: 'student', isActive: true })
    .select('department year section');
  if (!student) return false;
  const match = await Subject.findOne({
    assignedTeacher: teacherId,
    department: student.department,
    year: student.year,
    section: student.section,
    isActive: true,
  }).select('_id');
  return !!match;
}

// ── ASSESSMENTS ──────────────────────────────────────────────

export const createAssessment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = createAssessmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Validation error', errors: parsed.error.errors });
      return;
    }
    const { title, type, subjectId, maxMarks, assessmentDate, dueDate, description } = parsed.data;
    const subject = await Subject.findById(subjectId);
    if (!subject) { res.status(404).json({ success: false, message: 'Subject not found' }); return; }
    if (req.user!.role === 'teacher' && subject.assignedTeacher.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Not authorized for this subject' }); return;
    }
    const assessment = await Assessment.create({
      title, type, subjectId,
      teacherId: req.user!.userId,
      department: subject.department,
      year: subject.year,
      section: subject.section,
      maxMarks, assessmentDate, dueDate, description,
    });
    res.status(201).json({ success: true, message: 'Assessment created', data: { assessment } });
  } catch { res.status(500).json({ success: false, message: 'Failed to create assessment' }); }
};

export const getAssessments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subjectId, type } = req.query;
    const query: any = { isActive: true };
    if (subjectId) {
      if (!isValidObjectId(String(subjectId))) {
        res.status(400).json({ success: false, message: 'Invalid subject ID' }); return;
      }
      query.subjectId = String(subjectId);
    }
    if (type) query.type = String(type);

    if (req.user!.role === 'teacher') {
      query.teacherId = req.user!.userId;
    } else if (req.user!.role === 'student') {
      const student = await User.findById(req.user!.userId).select('department year section');
      if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return; }
      query.isPublished = true;
      query.department = student.department;
      query.year = student.year;
      query.section = student.section;
    }

    const assessments = await Assessment.find(query)
      .populate('subjectId', 'subjectName subjectCode')
      .populate('teacherId', 'name email')
      .sort({ assessmentDate: -1 });
    res.json({ success: true, data: { assessments } });
  } catch { res.status(500).json({ success: false, message: 'Failed to load assessments' }); }
};

export const updateAssessment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) { res.status(400).json({ success: false, message: 'Invalid ID' }); return; }
    const parsed = updateAssessmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.errors }); return;
    }
    const assessment = await Assessment.findById(id);
    if (!assessment) { res.status(404).json({ success: false, message: 'Assessment not found' }); return; }
    if (req.user!.role === 'teacher' && assessment.teacherId.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Not authorized' }); return;
    }
    const updated = await Assessment.findByIdAndUpdate(id, { $set: parsed.data }, { new: true });
    res.json({ success: true, data: { assessment: updated } });
  } catch { res.status(500).json({ success: false, message: 'Failed to update assessment' }); }
};

export const publishAssessment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) { res.status(400).json({ success: false, message: 'Invalid ID' }); return; }
    const assessment = await Assessment.findById(id);
    if (!assessment) { res.status(404).json({ success: false, message: 'Assessment not found' }); return; }
    if (req.user!.role === 'teacher' && assessment.teacherId.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Not authorized' }); return;
    }
    assessment.isPublished = true;
    await assessment.save();
    res.json({ success: true, message: 'Assessment published', data: { assessment } });
  } catch { res.status(500).json({ success: false, message: 'Failed to publish assessment' }); }
};

export const deleteAssessment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) { res.status(400).json({ success: false, message: 'Invalid ID' }); return; }
    const assessment = await Assessment.findById(id);
    if (!assessment) { res.status(404).json({ success: false, message: 'Assessment not found' }); return; }
    if (req.user!.role === 'teacher' && assessment.teacherId.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Not authorized' }); return;
    }
    if (assessment.isPublished) {
      res.status(400).json({ success: false, message: 'Cannot delete a published assessment' }); return;
    }
    await Assessment.findByIdAndUpdate(id, { isActive: false });
    res.json({ success: true, message: 'Assessment deleted' });
  } catch { res.status(500).json({ success: false, message: 'Failed to delete assessment' }); }
};

export const getStudentsBySubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subjectId } = req.params;
    if (!isValidObjectId(subjectId)) { res.status(400).json({ success: false, message: 'Invalid subject ID' }); return; }
    const subject = await Subject.findById(subjectId);
    if (!subject) { res.status(404).json({ success: false, message: 'Subject not found' }); return; }
    if (req.user!.role === 'teacher' && subject.assignedTeacher.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Not authorized' }); return;
    }
    const students = await User.find({
      role: 'student',
      department: subject.department,
      year: subject.year,
      section: subject.section,
      isActive: true,
    }).select('name email rollNumber year section').sort({ name: 1 });
    res.json({ success: true, data: { students } });
  } catch { res.status(500).json({ success: false, message: 'Failed to load students' }); }
};

export const exportAssessmentCSV = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { assessmentId } = req.params;
    if (!isValidObjectId(assessmentId)) { res.status(400).json({ success: false, message: 'Invalid assessment ID' }); return; }
    const assessment = await Assessment.findById(assessmentId).populate('subjectId', 'subjectName subjectCode');
    if (!assessment) { res.status(404).json({ success: false, message: 'Assessment not found' }); return; }
    if (req.user!.role === 'teacher' && assessment.teacherId.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Not authorized' }); return;
    }
    const results = await AssessmentResult.find({ assessmentId })
      .populate('studentId', 'name email rollNumber year section')
      .sort({ 'studentId.name': 1 });

    const sub = assessment.subjectId as any;
    const rows = [
      ['Roll Number', 'Student Name', 'Email', 'Marks Obtained', 'Max Marks', 'Percentage', 'Status'],
      ...results.map(r => {
        const s = r.studentId as any;
        const pct = r.isAbsent ? 'Absent' : `${Math.round((r.marksObtained / assessment.maxMarks) * 100)}%`;
        return [
          s?.rollNumber || '',
          s?.name || '',
          s?.email || '',
          r.isAbsent ? 'Absent' : r.marksObtained,
          assessment.maxMarks,
          pct,
          r.isAbsent ? 'Absent' : (r.marksObtained >= assessment.maxMarks * 0.4 ? 'Pass' : 'Fail'),
        ];
      }),
    ];

    const csv = rows.map(r => r.map(sanitizeCsvCell).join(',')).join('\n');
    const safeSub = String(sub?.subjectCode || 'assessment').replace(/[^a-zA-Z0-9_-]/g, '');
    const safeTitle = String(assessment.title || 'export').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeSub}_${safeTitle}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch { res.status(500).json({ success: false, message: 'Failed to export CSV' }); }
};

export const enterMarks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { assessmentId, results } = req.body;
    if (!isValidObjectId(assessmentId) || !Array.isArray(results) || results.length > 500) {
      res.status(400).json({ success: false, message: 'Valid assessmentId and results array required' }); return;
    }
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) { res.status(404).json({ success: false, message: 'Assessment not found' }); return; }
    if (req.user!.role === 'teacher' && assessment.teacherId.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Not authorized' }); return;
    }

    const saved = [];
    const errors = [];

    for (const r of results) {
      const { studentId, marksObtained, isAbsent, submittedLate, feedback } = r;
      if (!isValidObjectId(studentId)) {
        errors.push({ studentId, error: 'Invalid studentId' });
        continue;
      }
      const numericMarks = Number(marksObtained);
      if (!isAbsent && (!Number.isFinite(numericMarks) || numericMarks < 0 || numericMarks > assessment.maxMarks)) {
        errors.push({ studentId, error: `Marks must be 0-${assessment.maxMarks}` });
        continue;
      }
      try {
        const result = await AssessmentResult.findOneAndUpdate(
          { assessmentId, studentId },
          {
            assessmentId,
            studentId,
            subjectId: assessment.subjectId,
            marksObtained: isAbsent ? 0 : numericMarks,
            isAbsent: !!isAbsent,
            submittedLate: !!submittedLate,
            feedback: typeof feedback === 'string' ? feedback.slice(0, 500) : undefined,
            gradedBy: req.user!.userId,
          },
          { upsert: true, new: true }
        );
        saved.push(result);
      } catch (e: any) {
        errors.push({ studentId, error: 'Save failed' });
      }
    }

    const studentIds = saved.map(r => r.studentId.toString());
    for (const sid of [...new Set(studentIds)]) {
      triggerRiskAssessment(sid).catch(() => {});
    }

    res.json({ success: true, message: `${saved.length} records saved`, data: { saved: saved.length, errors } });
  } catch { res.status(500).json({ success: false, message: 'Failed to save marks' }); }
};

export const getAssessmentResults = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { assessmentId } = req.params;
    if (!isValidObjectId(assessmentId)) { res.status(400).json({ success: false, message: 'Invalid assessment ID' }); return; }
    const assessment = await Assessment.findById(assessmentId).populate('subjectId', 'subjectName subjectCode');
    if (!assessment) { res.status(404).json({ success: false, message: 'Assessment not found' }); return; }

    if (req.user!.role === 'teacher' && assessment.teacherId.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Not authorized for this assessment' });
      return;
    }

    const results = await AssessmentResult.find({ assessmentId })
      .populate('studentId', 'name email rollNumber year section')
      .sort({ 'studentId.name': 1 });

    const marks = results.filter(r => !r.isAbsent).map(r => r.marksObtained);
    const avg = marks.length ? +(marks.reduce((a, b) => a + b, 0) / marks.length).toFixed(2) : 0;
    const highest = marks.length ? Math.max(...marks) : 0;
    const lowest = marks.length ? Math.min(...marks) : 0;
    const passCount = marks.filter(m => m >= assessment.maxMarks * 0.4).length;

    res.json({
      success: true,
      data: {
        assessment,
        results,
        stats: { total: results.length, appeared: marks.length, average: avg, highest, lowest, passCount },
      },
    });
  } catch { res.status(500).json({ success: false, message: 'Failed to load assessment results' }); }
};

// ── STUDENT ACADEMIC PROFILE ──────────────────────────────────

export const getStudentAcademicProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = req.params.studentId || req.user!.userId;
    if (!isValidObjectId(targetId)) { res.status(400).json({ success: false, message: 'Invalid student ID' }); return; }

    if (req.user!.role === 'student' && targetId !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Access denied' }); return;
    }
    if (req.user!.role === 'teacher' && !(await ensureTeacherHasStudent(req.user!.userId, targetId))) {
      res.status(403).json({ success: false, message: 'Not authorized for this student' }); return;
    }

    const student = await User.findById(targetId).select('-passwordHash -refreshToken -passwordResetToken -passwordResetExpires');
    if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return; }

    const subjects = await Subject.find({
      department: student.department,
      year: student.year,
      section: student.section,
      isActive: true,
    }).populate('assignedTeacher', 'name email');

    const attendanceData = await Promise.all(subjects.map(async (sub) => {
      const totalSessions = await AttendanceSession.countDocuments({
        subjectId: sub._id,
        status: { $in: ['ended', 'expired'] },
      });
      const present = await AttendanceRecord.countDocuments({
        studentId: targetId,
        subjectId: sub._id,
      });
      return {
        subjectId: sub._id,
        subjectName: sub.subjectName,
        subjectCode: sub.subjectCode,
        present,
        total: totalSessions,
        percentage: totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 0,
      };
    }));

    const assessmentResults = await AssessmentResult.find({ studentId: targetId })
      .populate({
        path: 'assessmentId',
        match: { isPublished: true, isActive: true },
        populate: { path: 'subjectId', select: 'subjectName subjectCode' },
      })
      .sort({ createdAt: -1 });

    const validResults = assessmentResults.filter(r => r.assessmentId);

    const byType: Record<string, any[]> = {};
    for (const r of validResults) {
      const a = r.assessmentId as any;
      const t = a?.type || 'other';
      if (!byType[t]) byType[t] = [];
      byType[t].push({
        title: a?.title,
        subjectName: a?.subjectId?.subjectName,
        subjectCode: a?.subjectId?.subjectCode,
        maxMarks: a?.maxMarks,
        marksObtained: r.marksObtained,
        isAbsent: r.isAbsent,
        date: a?.assessmentDate,
        percentage: a?.maxMarks > 0 ? Math.round((r.marksObtained / a.maxMarks) * 100) : 0,
      });
    }

    const latestRisk = await RiskAssessment.findOne({ studentId: targetId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        student,
        subjects: subjects.length,
        attendance: attendanceData,
        overallAttendance: attendanceData.length
          ? Math.round(attendanceData.reduce((a, b) => a + b.percentage, 0) / attendanceData.length)
          : 0,
        assessmentsByType: byType,
        riskAssessment: latestRisk,
      },
    });
  } catch { res.status(500).json({ success: false, message: 'Failed to load academic profile' }); }
};

// ── RISK ENGINE ────────────────────────────────────────────────

export async function triggerRiskAssessment(studentId: string): Promise<void> {
  try {
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') return;

    const subjects = await Subject.find({
      department: student.department,
      year: student.year,
      section: student.section,
      isActive: true,
    });

    const subjectIds = subjects.map(s => s._id);
    const warnings: string[] = [];

    let totalSessions = 0, totalPresent = 0;
    for (const sub of subjects) {
      const sessions = await AttendanceSession.countDocuments({ subjectId: sub._id, status: { $in: ['ended', 'expired'] } });
      const present = await AttendanceRecord.countDocuments({ studentId, subjectId: sub._id });
      totalSessions += sessions;
      totalPresent += present;
    }
    const attendancePct = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : null;
    if (attendancePct === null) warnings.push('Insufficient attendance data');

    const internalResults = await AssessmentResult.find({ studentId, isAbsent: false })
      .populate({ path: 'assessmentId', match: { type: { $in: ['internal_exam', 'unit_test'] }, isPublished: true } });
    const validInternal = internalResults.filter(r => r.assessmentId);
    let internalAvg: number | null = null;
    if (validInternal.length > 0) {
      const pcts = validInternal.map(r => {
        const a = r.assessmentId as any;
        return a.maxMarks > 0 ? (r.marksObtained / a.maxMarks) * 100 : 0;
      });
      internalAvg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    } else {
      warnings.push('No internal exam data');
    }

    const quizResults = await AssessmentResult.find({ studentId, isAbsent: false })
      .populate({ path: 'assessmentId', match: { type: 'quiz', isPublished: true } });
    const validQuiz = quizResults.filter(r => r.assessmentId);
    let quizAvg: number | null = null;
    if (validQuiz.length > 0) {
      const pcts = validQuiz.map(r => {
        const a = r.assessmentId as any;
        return a.maxMarks > 0 ? (r.marksObtained / a.maxMarks) * 100 : 0;
      });
      quizAvg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    } else {
      warnings.push('No quiz data');
    }

    const assignmentAssessments = await Assessment.find({
      subjectId: { $in: subjectIds },
      type: 'assignment',
      isPublished: true,
      isActive: true,
    });
    let assignmentRate: number | null = null;
    if (assignmentAssessments.length > 0) {
      const submitted = await AssessmentResult.countDocuments({
        studentId,
        assessmentId: { $in: assignmentAssessments.map(a => a._id) },
        isAbsent: false,
      });
      assignmentRate = Math.round((submitted / assignmentAssessments.length) * 100);
    } else {
      warnings.push('No assignment data');
    }

    const mlResult = await mlPredict({
      studentId,
      attendancePercentage: attendancePct ?? undefined,
      internalMarksAverage: internalAvg ?? undefined,
      quizAverage: quizAvg ?? undefined,
      assignmentCompletion: assignmentRate ?? undefined,
    });

    let riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
    let riskScore: number;
    let factors: { factor: string; value: number | string; impact: 'LOW' | 'MEDIUM' | 'HIGH' }[];
    let recommendations: string[];
    let modelVersion: string;
    let assessmentMethod: 'RULE_BASED' | 'ML_MODEL';

    if (mlResult) {
      riskLevel        = mlResult.riskLevel;
      riskScore        = mlResult.riskScore;
      factors          = mlResult.contributingFactors.map(f => ({ ...f, impact: f.impact as 'LOW' | 'MEDIUM' | 'HIGH' }));
      recommendations  = mlResult.recommendations;
      modelVersion     = mlResult.modelVersion;
      assessmentMethod = 'ML_MODEL';
      warnings.push(...mlResult.dataWarnings);
    } else {
      factors = [];
      let score = 0;

      if (attendancePct !== null) {
        if (attendancePct < 60) { score += 40; factors.push({ factor: 'Attendance', value: attendancePct, impact: 'HIGH' }); }
        else if (attendancePct < 75) { score += 25; factors.push({ factor: 'Attendance', value: attendancePct, impact: 'HIGH' }); }
        else if (attendancePct < 85) { score += 10; factors.push({ factor: 'Attendance', value: attendancePct, impact: 'MEDIUM' }); }
      }
      if (internalAvg !== null) {
        if (internalAvg < 40) { score += 35; factors.push({ factor: 'Internal Marks', value: internalAvg, impact: 'HIGH' }); }
        else if (internalAvg < 55) { score += 20; factors.push({ factor: 'Internal Marks', value: internalAvg, impact: 'HIGH' }); }
        else if (internalAvg < 70) { score += 8;  factors.push({ factor: 'Internal Marks', value: internalAvg, impact: 'MEDIUM' }); }
      }
      if (quizAvg !== null) {
        if (quizAvg < 40) { score += 15; factors.push({ factor: 'Quiz Average', value: quizAvg, impact: 'MEDIUM' }); }
        else if (quizAvg < 55) { score += 8; factors.push({ factor: 'Quiz Average', value: quizAvg, impact: 'LOW' }); }
      }
      if (assignmentRate !== null) {
        if (assignmentRate < 50) { score += 10; factors.push({ factor: 'Assignment Completion', value: assignmentRate, impact: 'MEDIUM' }); }
        else if (assignmentRate < 75) { score += 5; factors.push({ factor: 'Assignment Completion', value: assignmentRate, impact: 'LOW' }); }
      }

      riskScore = Math.min(score, 100);
      riskLevel = riskScore >= 50 ? 'HIGH' : riskScore >= 25 ? 'MODERATE' : 'LOW';
      modelVersion = '1.0-rule-based';
      assessmentMethod = 'RULE_BASED';

      recommendations = [];
      if (attendancePct !== null && attendancePct < 75) recommendations.push('Attend all upcoming classes to improve attendance percentage');
      if (internalAvg !== null && internalAvg < 55) recommendations.push('Schedule extra study sessions and seek faculty mentoring for weak subjects');
      if (quizAvg !== null && quizAvg < 55) recommendations.push('Practice topic-wise quizzes to improve understanding');
      if (assignmentRate !== null && assignmentRate < 75) recommendations.push('Complete all pending assignments before deadlines');
      if (riskLevel === 'LOW') recommendations.push('Keep up the good work and maintain your current performance');
    }

    const prev = await RiskAssessment.findOne({ studentId }).sort({ createdAt: -1 });

    await RiskAssessment.create({
      studentId,
      riskLevel,
      assessmentMethod,
      riskScore: Math.min(riskScore, 100),
      contributingFactors: factors,
      recommendations,
      attendancePercentage: attendancePct ?? undefined,
      internalMarksAverage: internalAvg ?? undefined,
      assignmentCompletionRate: assignmentRate ?? undefined,
      quizAverage: quizAvg ?? undefined,
      modelVersion,
      dataWarnings: warnings,
      previousRiskLevel: prev?.riskLevel,
    });
  } catch (err) {
    console.error('[risk] Error:', err);
  }
}

// ── RISK ASSESSMENT API ────────────────────────────────────────

export const getStudentRisk = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = req.params.studentId || req.user!.userId;
    if (!isValidObjectId(targetId)) { res.status(400).json({ success: false, message: 'Invalid student ID' }); return; }
    if (req.user!.role === 'student' && targetId !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Access denied' }); return;
    }
    if (req.user!.role === 'teacher' && !(await ensureTeacherHasStudent(req.user!.userId, targetId))) {
      res.status(403).json({ success: false, message: 'Not authorized for this student' }); return;
    }
    const latest = await RiskAssessment.findOne({ studentId: targetId }).sort({ createdAt: -1 });
    const history = await RiskAssessment.find({ studentId: targetId }).sort({ createdAt: -1 }).limit(10);
    res.json({ success: true, data: { latest, history } });
  } catch { res.status(500).json({ success: false, message: 'Failed to load risk data' }); }
};

export const triggerRiskForStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;
    if (!isValidObjectId(studentId)) { res.status(400).json({ success: false, message: 'Invalid student ID' }); return; }
    if (req.user!.role === 'teacher' && !(await ensureTeacherHasStudent(req.user!.userId, studentId))) {
      res.status(403).json({ success: false, message: 'Not authorized for this student' }); return;
    }
    await triggerRiskAssessment(studentId);
    const latest = await RiskAssessment.findOne({ studentId }).sort({ createdAt: -1 });
    res.json({ success: true, message: 'Risk assessment completed', data: { assessment: latest } });
  } catch { res.status(500).json({ success: false, message: 'Failed to trigger risk assessment' }); }
};

export const getRiskDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let studentIds: string[] = [];

    if (req.user!.role === 'teacher') {
      const subjects = await Subject.find({ assignedTeacher: req.user!.userId, isActive: true });
      const cohortFilters = subjects.map(s => ({
        role: 'student',
        department: s.department,
        year: s.year,
        section: s.section,
        isActive: true,
      }));
      const students = cohortFilters.length > 0 ? await User.find({ $or: cohortFilters }) : [];
      studentIds = students.map(s => s._id.toString());
    } else {
      const students = await User.find({ role: 'student', isActive: true });
      studentIds = students.map(s => s._id.toString());
    }

    const riskData = await Promise.all(studentIds.map(async (sid) => {
      const student = await User.findById(sid).select('name email rollNumber department year section');
      const risk = await RiskAssessment.findOne({ studentId: sid }).sort({ createdAt: -1 });
      return { student, risk };
    }));

    const high = riskData.filter(r => r.risk?.riskLevel === 'HIGH').length;
    const moderate = riskData.filter(r => r.risk?.riskLevel === 'MODERATE').length;
    const low = riskData.filter(r => r.risk?.riskLevel === 'LOW').length;
    const unassessed = riskData.filter(r => !r.risk).length;

    const highRiskStudents = riskData
      .filter(r => r.risk?.riskLevel === 'HIGH')
      .map(r => ({
        student: r.student,
        riskScore: r.risk!.riskScore,
        riskLevel: r.risk!.riskLevel,
        factors: r.risk!.contributingFactors,
        attendancePercentage: r.risk!.attendancePercentage,
        internalMarksAverage: r.risk!.internalMarksAverage,
        lastAssessed: r.risk!.createdAt,
      }));

    res.json({
      success: true,
      data: {
        summary: { total: studentIds.length, high, moderate, low, unassessed },
        highRiskStudents,
        allStudents: riskData.map(r => ({
          student: r.student,
          riskLevel: r.risk?.riskLevel || 'UNASSESSED',
          riskScore: r.risk?.riskScore || 0,
          lastAssessed: r.risk?.createdAt,
        })),
      },
    });
  } catch { res.status(500).json({ success: false, message: 'Failed to load risk dashboard' }); }
};

// ── ML Service info ───────────────────────────────────────────
export const getMLInfo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { mlServiceHealthy, mlModelInfo } = await import('../utils/mlClient');
    const healthy = await mlServiceHealthy();
    const info = healthy ? await mlModelInfo() : null;
    res.json({ success: true, data: { mlAvailable: healthy, modelInfo: info } });
  } catch { res.status(500).json({ success: false, message: 'Failed to load ML status' }); }
};

// ── What-If Simulator ─────────────────────────────────────────
export const whatIfSimulate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId, attendancePercentage, internalMarksAverage, quizAverage, assignmentCompletion } = req.body;
    if (!isValidObjectId(studentId)) {
      res.status(400).json({ success: false, message: 'Invalid student ID' }); return;
    }

    if (req.user!.role === 'student' && studentId !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Access denied' }); return;
    }
    if (req.user!.role === 'teacher' && !(await ensureTeacherHasStudent(req.user!.userId, studentId))) {
      res.status(403).json({ success: false, message: 'Not authorized for this student' }); return;
    }

    const currentRisk = await RiskAssessment.findOne({ studentId }).sort({ createdAt: -1 });

    const { mlPredict: mlP } = await import('../utils/mlClient');
    const simResult = await mlP({ studentId: 'simulation', attendancePercentage, internalMarksAverage, quizAverage, assignmentCompletion });

    let simRisk = simResult;
    if (!simResult) {
      let score = 0;
      const factors: any[] = [];
      if (attendancePercentage != null) {
        if (attendancePercentage < 60) score += 40;
        else if (attendancePercentage < 75) score += 25;
        else if (attendancePercentage < 85) score += 10;
        factors.push({ factor: 'Attendance', value: attendancePercentage, impact: attendancePercentage < 75 ? 'HIGH' : 'MEDIUM' });
      }
      if (internalMarksAverage != null) {
        if (internalMarksAverage < 40) score += 35;
        else if (internalMarksAverage < 55) score += 20;
        factors.push({ factor: 'Internal Marks', value: internalMarksAverage, impact: internalMarksAverage < 55 ? 'HIGH' : 'MEDIUM' });
      }
      simRisk = {
        studentId: 'simulation',
        riskLevel: score >= 50 ? 'HIGH' : score >= 25 ? 'MODERATE' : 'LOW',
        assessmentType: 'RULE_BASED',
        riskScore: Math.min(score, 100),
        riskProbability: null,
        contributingFactors: factors,
        recommendations: [],
        dataWarnings: ['Simulation using rule-based engine'],
        modelVersion: '1.0-rule-based',
        predictionTimestamp: new Date().toISOString(),
      } as any;
    }

    res.json({
      success: true,
      data: {
        simulation: { ...simRisk, note: 'SIMULATED — not saved to database' },
        current: currentRisk ? { riskLevel: currentRisk.riskLevel, riskScore: currentRisk.riskScore } : null,
        changed: currentRisk ? currentRisk.riskLevel !== simRisk?.riskLevel : false,
      },
    });
  } catch { res.status(500).json({ success: false, message: 'Simulation failed' }); }
};

export const createIntervention = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { Intervention } = await import('../models/Intervention.model');
    const parsed = createInterventionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Validation error', errors: parsed.error.errors }); return;
    }
    const { studentId, type, description, scheduledDate, followUpDate, notes } = parsed.data;
    if (req.user!.role === 'teacher' && !(await ensureTeacherHasStudent(req.user!.userId, studentId))) {
      res.status(403).json({ success: false, message: 'Not authorized for this student' }); return;
    }
    const latestRisk = await RiskAssessment.findOne({ studentId }).sort({ createdAt: -1 });
    const intervention = await Intervention.create({
      studentId,
      facultyId: req.user!.userId,
      type, description, scheduledDate, followUpDate, notes,
      riskLevelAtCreation: latestRisk?.riskLevel,
    });
    res.status(201).json({ success: true, message: 'Intervention created', data: { intervention } });
  } catch { res.status(500).json({ success: false, message: 'Failed to create intervention' }); }
};

export const getInterventions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { Intervention } = await import('../models/Intervention.model');
    const { studentId, status } = req.query;
    const query: any = {};
    if (studentId) {
      if (!isValidObjectId(String(studentId))) { res.status(400).json({ success: false, message: 'Invalid student ID' }); return; }
      query.studentId = String(studentId);
    }
    if (status) query.status = String(status);
    if (req.user!.role === 'teacher') query.facultyId = req.user!.userId;
    const interventions = await Intervention.find(query)
      .populate('studentId', 'name email rollNumber department year section')
      .populate('facultyId', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: { interventions } });
  } catch { res.status(500).json({ success: false, message: 'Failed to load interventions' }); }
};

export const updateIntervention = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { Intervention } = await import('../models/Intervention.model');
    const { id } = req.params;
    if (!isValidObjectId(id)) { res.status(400).json({ success: false, message: 'Invalid intervention ID' }); return; }
    const parsed = updateInterventionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.errors }); return;
    }
    const intervention = await Intervention.findById(id);
    if (!intervention) { res.status(404).json({ success: false, message: 'Intervention not found' }); return; }
    if (req.user!.role === 'teacher' && intervention.facultyId.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Not authorized' }); return;
    }
    const updated = await Intervention.findByIdAndUpdate(id, { $set: parsed.data }, { new: true })
      .populate('studentId', 'name email rollNumber')
      .populate('facultyId', 'name email');
    res.json({ success: true, data: { intervention: updated } });
  } catch { res.status(500).json({ success: false, message: 'Failed to update intervention' }); }
};
