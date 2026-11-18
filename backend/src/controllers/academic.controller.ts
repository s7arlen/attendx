import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware';
import { Assessment } from '../models/Assessment.model';
import { AssessmentResult } from '../models/AssessmentResult.model';
import { Subject } from '../models/Subject.model';
import { User } from '../models/User.model';
import { AttendanceRecord } from '../models/AttendanceRecord.model';
import { AttendanceSession } from '../models/AttendanceSession.model';
import { RiskAssessment } from '../models/RiskAssessment.model';
import { mlPredict } from '../utils/mlClient';

// ── ASSESSMENTS ──────────────────────────────────────────────

export const createAssessment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, type, subjectId, maxMarks, assessmentDate, dueDate, description } = req.body;
    if (!title || !type || !subjectId || !maxMarks || !assessmentDate) {
      res.status(400).json({ success: false, message: 'title, type, subjectId, maxMarks and assessmentDate are required' });
      return;
    }
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
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const getAssessments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subjectId, type } = req.query;
    const query: any = { isActive: true };
    if (subjectId) query.subjectId = subjectId;
    if (type) query.type = type;
    if (req.user!.role === 'teacher') query.teacherId = req.user!.userId;
    const assessments = await Assessment.find(query)
      .populate('subjectId', 'subjectName subjectCode')
      .populate('teacherId', 'name email')
      .sort({ assessmentDate: -1 });
    res.json({ success: true, data: { assessments } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const updateAssessment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const assessment = await Assessment.findById(id);
    if (!assessment) { res.status(404).json({ success: false, message: 'Assessment not found' }); return; }
    if (req.user!.role === 'teacher' && assessment.teacherId.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Not authorized' }); return;
    }
    const updated = await Assessment.findByIdAndUpdate(id, req.body, { new: true });
    res.json({ success: true, data: { assessment: updated } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const publishAssessment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const assessment = await Assessment.findById(id);
    if (!assessment) { res.status(404).json({ success: false, message: 'Assessment not found' }); return; }
    if (req.user!.role === 'teacher' && assessment.teacherId.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Not authorized' }); return;
    }
    assessment.isPublished = true;
    await assessment.save();
    res.json({ success: true, message: 'Assessment published', data: { assessment } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const deleteAssessment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
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
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const getStudentsBySubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subjectId } = req.params;
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
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const exportAssessmentCSV = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { assessmentId } = req.params;
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

    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const filename = `${sub?.subjectCode || 'assessment'}_${assessment.title.replace(/\s+/g, '_')}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};



export const enterMarks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { assessmentId, results } = req.body;
    // results: [{ studentId, marksObtained, isAbsent, feedback }]
    if (!assessmentId || !Array.isArray(results)) {
      res.status(400).json({ success: false, message: 'assessmentId and results array required' }); return;
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
      // Validate marks
      if (!isAbsent && (marksObtained < 0 || marksObtained > assessment.maxMarks)) {
        errors.push({ studentId, error: `Marks must be 0–${assessment.maxMarks}` });
        continue;
      }
      try {
        const result = await AssessmentResult.findOneAndUpdate(
          { assessmentId, studentId },
          {
            assessmentId,
            studentId,
            subjectId: assessment.subjectId,
            marksObtained: isAbsent ? 0 : marksObtained,
            isAbsent: !!isAbsent,
            submittedLate: !!submittedLate,
            feedback,
            gradedBy: req.user!.userId,
          },
          { upsert: true, new: true }
        );
        saved.push(result);
      } catch (e: any) {
        errors.push({ studentId, error: e.message });
      }
    }

    // Trigger risk reassessment for affected students in background
    const studentIds = saved.map(r => r.studentId.toString());
    for (const sid of [...new Set(studentIds)]) {
      triggerRiskAssessment(sid).catch(console.error);
    }

    res.json({ success: true, message: `${saved.length} records saved`, data: { saved: saved.length, errors } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const getAssessmentResults = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { assessmentId } = req.params;
    const assessment = await Assessment.findById(assessmentId).populate('subjectId', 'subjectName subjectCode');
    if (!assessment) { res.status(404).json({ success: false, message: 'Assessment not found' }); return; }

    const results = await AssessmentResult.find({ assessmentId })
      .populate('studentId', 'name email rollNumber year section')
      .sort({ 'studentId.name': 1 });

    // Class stats
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
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

// ── STUDENT ACADEMIC PROFILE ──────────────────────────────────

export const getStudentAcademicProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = req.params.studentId || req.user!.userId;

    // Security: students can only view their own profile
    if (req.user!.role === 'student' && targetId !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Access denied' }); return;
    }

    const student = await User.findById(targetId).select('-passwordHash -refreshToken');
    if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return; }

    // Get subjects for this student
    const subjects = await Subject.find({
      department: student.department,
      year: student.year,
      section: student.section,
      isActive: true,
    }).populate('assignedTeacher', 'name email');

    const subjectIds = subjects.map(s => s._id);

    // Attendance per subject
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

    // Assessment results grouped by subject and type
    const assessmentResults = await AssessmentResult.find({ studentId: targetId })
      .populate({
        path: 'assessmentId',
        match: { isPublished: true, isActive: true },
        populate: { path: 'subjectId', select: 'subjectName subjectCode' },
      })
      .sort({ createdAt: -1 });

    const validResults = assessmentResults.filter(r => r.assessmentId);

    // Group by type
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

    // Latest risk assessment
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
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
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

    // 1. Attendance
    let totalSessions = 0, totalPresent = 0;
    for (const sub of subjects) {
      const sessions = await AttendanceSession.countDocuments({ subjectId: sub._id, status: { $in: ['ended', 'expired'] } });
      const present = await AttendanceRecord.countDocuments({ studentId, subjectId: sub._id });
      totalSessions += sessions;
      totalPresent += present;
    }
    const attendancePct = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : null;
    if (attendancePct === null) warnings.push('Insufficient attendance data');

    // 2. Internal marks average
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

    // 3. Quiz average
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

    // 4. Assignment completion
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

    // ── TRY ML MODEL FIRST ────────────────────────────────────
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
      // Use ML prediction
      riskLevel        = mlResult.riskLevel;
      riskScore        = mlResult.riskScore;
      factors          = mlResult.contributingFactors.map(f => ({ ...f, impact: f.impact as 'LOW' | 'MEDIUM' | 'HIGH' }));
      recommendations  = mlResult.recommendations;
      modelVersion     = mlResult.modelVersion;
      assessmentMethod = 'ML_MODEL';
      warnings.push(...mlResult.dataWarnings);
    } else {
      // ── RULE-BASED FALLBACK ────────────────────────────────
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

    // Get previous risk
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

    console.log(`[risk] Student ${studentId}: ${riskLevel} (score=${riskScore})`);
  } catch (err) {
    console.error('[risk] Error:', err);
  }
}

// ── RISK ASSESSMENT API ────────────────────────────────────────

export const getStudentRisk = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = req.params.studentId || req.user!.userId;
    if (req.user!.role === 'student' && targetId !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Access denied' }); return;
    }
    const latest = await RiskAssessment.findOne({ studentId: targetId }).sort({ createdAt: -1 });
    const history = await RiskAssessment.find({ studentId: targetId }).sort({ createdAt: -1 }).limit(10);
    res.json({ success: true, data: { latest, history } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const triggerRiskForStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;
    await triggerRiskAssessment(studentId);
    const latest = await RiskAssessment.findOne({ studentId }).sort({ createdAt: -1 });
    res.json({ success: true, message: 'Risk assessment completed', data: { assessment: latest } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const getRiskDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Get all students for this teacher's subjects
    let studentIds: string[] = [];

    if (req.user!.role === 'teacher') {
      const subjects = await Subject.find({ assignedTeacher: req.user!.userId, isActive: true });
      const students = await User.find({
        role: 'student',
        department: { $in: subjects.map(s => s.department) },
        year: { $in: subjects.map(s => s.year) },
        section: { $in: subjects.map(s => s.section) },
        isActive: true,
      });
      studentIds = students.map(s => s._id.toString());
    } else {
      // Admin sees all
      const students = await User.find({ role: 'student', isActive: true });
      studentIds = students.map(s => s._id.toString());
    }

    // Get latest risk for each student
    const riskData = await Promise.all(studentIds.map(async (sid) => {
      const student = await User.findById(sid).select('name email rollNumber department year section');
      const risk = await RiskAssessment.findOne({ studentId: sid }).sort({ createdAt: -1 });
      return { student, risk };
    }));

    const high = riskData.filter(r => r.risk?.riskLevel === 'HIGH').length;
    const moderate = riskData.filter(r => r.risk?.riskLevel === 'MODERATE').length;
    const low = riskData.filter(r => r.risk?.riskLevel === 'LOW').length;
    const unassessed = riskData.filter(r => !r.risk).length;

    // High risk students details
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
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

// ── ML Service info ───────────────────────────────────────────
export const getMLInfo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { mlServiceHealthy, mlModelInfo } = await import('../utils/mlClient');
    const healthy = await mlServiceHealthy();
    const info = healthy ? await mlModelInfo() : null;
    res.json({ success: true, data: { mlAvailable: healthy, modelInfo: info } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

// ── What-If Simulator ─────────────────────────────────────────
export const whatIfSimulate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId, attendancePercentage, internalMarksAverage, quizAverage, assignmentCompletion } = req.body;

    // Security: students can only simulate for themselves
    if (req.user!.role === 'student' && studentId !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Access denied' }); return;
    }

    // Get current actual risk
    const currentRisk = await RiskAssessment.findOne({ studentId }).sort({ createdAt: -1 });

    // Run simulation (never saves to DB)
    const { mlPredict: mlP } = await import('../utils/mlClient');
    const simResult = await mlP({ studentId: 'simulation', attendancePercentage, internalMarksAverage, quizAverage, assignmentCompletion });

    // Rule-based fallback for simulation
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
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const createIntervention = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { Intervention } = await import('../models/Intervention.model');
    const { studentId, type, description, scheduledDate, followUpDate, notes } = req.body;
    if (!studentId || !type || !description || !scheduledDate) {
      res.status(400).json({ success: false, message: 'studentId, type, description and scheduledDate required' }); return;
    }
    const latestRisk = await RiskAssessment.findOne({ studentId }).sort({ createdAt: -1 });
    const intervention = await Intervention.create({
      studentId,
      facultyId: req.user!.userId,
      type, description, scheduledDate, followUpDate, notes,
      riskLevelAtCreation: latestRisk?.riskLevel,
    });
    res.status(201).json({ success: true, message: 'Intervention created', data: { intervention } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const getInterventions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { Intervention } = await import('../models/Intervention.model');
    const { studentId, status } = req.query;
    const query: any = {};
    if (studentId) query.studentId = studentId;
    if (status) query.status = status;
    if (req.user!.role === 'teacher') query.facultyId = req.user!.userId;
    const interventions = await Intervention.find(query)
      .populate('studentId', 'name email rollNumber department year section')
      .populate('facultyId', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: { interventions } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const updateIntervention = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { Intervention } = await import('../models/Intervention.model');
    const { id } = req.params;
    const intervention = await Intervention.findById(id);
    if (!intervention) { res.status(404).json({ success: false, message: 'Intervention not found' }); return; }
    if (req.user!.role === 'teacher' && intervention.facultyId.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Not authorized' }); return;
    }
    const updated = await Intervention.findByIdAndUpdate(id, req.body, { new: true })
      .populate('studentId', 'name email rollNumber')
      .populate('facultyId', 'name email');
    res.json({ success: true, data: { intervention: updated } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};
