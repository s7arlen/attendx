/**
 * AttendX 2.0 — AI Chatbot Controller
 * Natural language interface for students and teachers.
 * No external AI API — purely rule-based NLP with intent matching.
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { User } from '../models/User.model';
import { Subject } from '../models/Subject.model';
import { AttendanceRecord } from '../models/AttendanceRecord.model';
import { AttendanceSession } from '../models/AttendanceSession.model';
import { Assessment } from '../models/Assessment.model';
import { AssessmentResult } from '../models/AssessmentResult.model';
import { RiskAssessment } from '../models/RiskAssessment.model';
import { Intervention } from '../models/Intervention.model';

// ── Intent Detection ──────────────────────────────────────────

type Intent =
  | 'attendance_query'
  | 'marks_query'
  | 'risk_query'
  | 'subject_query'
  | 'recommendation_query'
  | 'intervention_query'
  | 'greeting'
  | 'help'
  | 'unknown';

interface DetectedIntent {
  intent: Intent;
  subject?: string;
  confidence: number;
}

function detectIntent(message: string): DetectedIntent {
  const msg = message.toLowerCase().trim();

  // Greeting
  if (/^(hi|hello|hey|good morning|good evening|hii|helo|howdy)/i.test(msg)) {
    return { intent: 'greeting', confidence: 1.0 };
  }

  // Help
  if (/\b(help|what can you|commands|guide|how to use|options)\b/.test(msg)) {
    return { intent: 'help', confidence: 0.9 };
  }

  // Attendance
  if (/\b(attendance|present|absent|classes|attended|missed|shortage|percent)\b/.test(msg)) {
    // Check if asking about specific subject
    const subjectMatch = msg.match(/\b(ds|data structure|oop|java|os|operating|ddco|digital|probability|stats|statistics|project|yoga|nss|pe|music|lab)\b/);
    return {
      intent: 'attendance_query',
      subject: subjectMatch?.[0],
      confidence: 0.95,
    };
  }

  // Marks / scores
  if (/\b(marks|score|result|exam|quiz|assignment|internal|grade|performance|test|unit)\b/.test(msg)) {
    const subjectMatch = msg.match(/\b(ds|data structure|oop|java|os|operating|ddco|digital|probability|stats|statistics|project|yoga|nss|pe|music|lab)\b/);
    return {
      intent: 'marks_query',
      subject: subjectMatch?.[0],
      confidence: 0.95,
    };
  }

  // Risk
  if (/\b(risk|danger|at risk|failing|fail|warning|safe|okay academically|academic status|how am i doing)\b/.test(msg)) {
    return { intent: 'risk_query', confidence: 0.95 };
  }

  // Recommendation
  if (/\b(suggest|recommend|improve|advice|tip|what should i|how can i|help me|better)\b/.test(msg)) {
    return { intent: 'recommendation_query', confidence: 0.9 };
  }

  // Subjects
  if (/\b(subject|course|enrolled|my subjects|what subjects|which subjects)\b/.test(msg)) {
    return { intent: 'subject_query', confidence: 0.9 };
  }

  // Intervention (teacher)
  if (/\b(intervention|mentoring|counselling|remedial|student.*risk|at.risk student|high risk)\b/.test(msg)) {
    return { intent: 'intervention_query', confidence: 0.9 };
  }

  return { intent: 'unknown', confidence: 0.0 };
}

// ── Response Builders ─────────────────────────────────────────

async function handleStudentChat(userId: string, message: string): Promise<string> {
  const student = await User.findById(userId).select('name rollNumber department year section');
  if (!student) return "I couldn't find your profile. Please try logging out and back in.";

  const { intent, subject } = detectIntent(message);

  switch (intent) {

    case 'greeting': {
      const hour = new Date().getHours();
      const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
      return `${greet}, ${student.name.split(' ')[0]}! 👋 I'm your AttendX assistant. I can help you with:\n\n• Your attendance percentage\n• Your marks and results\n• Your academic risk level\n• Improvement recommendations\n\nWhat would you like to know?`;
    }

    case 'help': {
      return `Here's what you can ask me:\n\n📊 **Attendance**\n• "What is my attendance?"\n• "My attendance in OOP Java"\n• "Am I in shortage?"\n\n📝 **Marks**\n• "What are my marks?"\n• "My quiz results"\n• "Show my internal exam scores"\n\n⚠️ **Risk**\n• "Am I at risk?"\n• "What is my academic status?"\n\n💡 **Recommendations**\n• "How can I improve?"\n• "Give me suggestions"`;
    }

    case 'attendance_query': {
      const subjects = await Subject.find({
        department: student.department,
        year: student.year,
        section: student.section,
        isActive: true,
      });

      const rows: string[] = [];
      let overallPresent = 0;
      let overallTotal = 0;
      let shortageCount = 0;

      for (const sub of subjects) {
        // Filter by subject keyword if mentioned
        if (subject) {
          const subLower = sub.subjectName.toLowerCase();
          const codeLower = sub.subjectCode.toLowerCase();
          if (!subLower.includes(subject) && !codeLower.includes(subject)) continue;
        }

        const totalSessions = await AttendanceSession.countDocuments({
          subjectId: sub._id,
          status: { $in: ['ended', 'expired'] },
        });
        const present = await AttendanceRecord.countDocuments({
          studentId: userId,
          subjectId: sub._id,
        });

        if (totalSessions === 0) continue;

        const pct = Math.round((present / totalSessions) * 100);
        overallPresent += present;
        overallTotal += totalSessions;

        const icon = pct < 75 ? '🔴' : pct < 85 ? '🟡' : '🟢';
        if (pct < 75) shortageCount++;

        // Calculate how many classes can still be missed
        const canMiss = Math.max(0, Math.floor(totalSessions * 0.25) - (totalSessions - present));

        rows.push(`${icon} **${sub.subjectCode}** — ${pct}% (${present}/${totalSessions})${pct < 75 ? ` ⚠️ Shortage` : ` — Can miss ${canMiss} more`}`);
      }

      if (rows.length === 0) {
        return "No attendance data found yet. Attendance is recorded once sessions are conducted.";
      }

      const overallPct = overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 100) : 0;
      let response = `📊 **Your Attendance Summary**\n\n${rows.join('\n')}\n\n`;
      response += `**Overall: ${overallPct}%**\n`;

      if (shortageCount > 0) {
        response += `\n⚠️ You have shortage in **${shortageCount} subject(s)**. Please attend classes regularly.`;
      } else {
        response += `\n✅ Your attendance is good! Keep it up.`;
      }

      return response;
    }

    case 'marks_query': {
      const results = await AssessmentResult.find({ studentId: userId })
        .populate({
          path: 'assessmentId',
          match: { isPublished: true, isActive: true },
          populate: { path: 'subjectId', select: 'subjectName subjectCode' },
        })
        .sort({ createdAt: -1 });

      const validResults = results.filter(r => r.assessmentId);

      if (validResults.length === 0) {
        return "No marks have been published yet. Check back after your faculty publishes assessment results.";
      }

      // Filter by subject if mentioned
      let filtered = validResults;
      if (subject) {
        filtered = validResults.filter(r => {
          const a = r.assessmentId as any;
          const subName = (a?.subjectId?.subjectName || '').toLowerCase();
          const subCode = (a?.subjectId?.subjectCode || '').toLowerCase();
          return subName.includes(subject) || subCode.includes(subject);
        });
      }

      const rows = filtered.slice(0, 8).map(r => {
        const a = r.assessmentId as any;
        const pct = r.isAbsent ? 0 : Math.round((r.marksObtained / a.maxMarks) * 100);
        const icon = r.isAbsent ? '⬜' : pct < 40 ? '🔴' : pct < 60 ? '🟡' : '🟢';
        return `${icon} **${a.title}** (${a.subjectId?.subjectCode})\n   ${r.isAbsent ? 'Absent' : `${r.marksObtained}/${a.maxMarks} — ${pct}%`}`;
      });

      const avgPct = filtered.filter(r => !r.isAbsent).length > 0
        ? Math.round(filtered.filter(r => !r.isAbsent).reduce((acc, r) => {
            const a = r.assessmentId as any;
            return acc + (r.marksObtained / a.maxMarks) * 100;
          }, 0) / filtered.filter(r => !r.isAbsent).length)
        : 0;

      return `📝 **Your Assessment Results**\n\n${rows.join('\n\n')}\n\n**Average: ${avgPct}%**`;
    }

    case 'risk_query': {
      const latest = await RiskAssessment.findOne({ studentId: userId }).sort({ createdAt: -1 });

      if (!latest) {
        return "No risk assessment has been generated for you yet. It will be calculated once attendance and marks data is available.";
      }

      const icon = latest.riskLevel === 'HIGH' ? '🔴' : latest.riskLevel === 'MODERATE' ? '🟡' : '🟢';
      let response = `${icon} **Your Academic Risk Level: ${latest.riskLevel}**\n`;
      response += `Risk Score: ${latest.riskScore}/100\n`;
      response += `Assessment: ${latest.assessmentMethod}\n\n`;

      if (latest.contributingFactors.length > 0) {
        response += `**Contributing Factors:**\n`;
        latest.contributingFactors.forEach(f => {
          response += `• ${f.factor}: ${f.value}% (${f.impact} impact)\n`;
        });
      }

      if (latest.recommendations.length > 0) {
        response += `\n**Recommendations:**\n`;
        latest.recommendations.forEach(r => {
          response += `💡 ${r}\n`;
        });
      }

      return response;
    }

    case 'recommendation_query': {
      const latest = await RiskAssessment.findOne({ studentId: userId }).sort({ createdAt: -1 });

      if (!latest || latest.recommendations.length === 0) {
        return "No specific recommendations yet. Once your marks and attendance are recorded, I'll give you personalized advice.\n\nGeneral tips:\n💡 Maintain above 85% attendance in all subjects\n💡 Revise topics after each class\n💡 Contact your faculty if you're struggling";
      }

      let response = `💡 **Personalized Recommendations for You**\n\n`;
      latest.recommendations.forEach((r, i) => {
        response += `${i + 1}. ${r}\n`;
      });

      if (latest.riskLevel === 'HIGH') {
        response += `\n🚨 Your risk level is HIGH. Please visit your faculty for immediate support.`;
      }

      return response;
    }

    case 'subject_query': {
      const subjects = await Subject.find({
        department: student.department,
        year: student.year,
        section: student.section,
        isActive: true,
      }).populate('assignedTeacher', 'name');

      if (subjects.length === 0) {
        return "No subjects found for your profile. Please contact the admin.";
      }

      const rows = subjects.map(s => {
        const teacher = s.assignedTeacher as any;
        return `📚 **${s.subjectCode}** — ${s.subjectName}\n   Faculty: ${teacher?.name || 'TBD'} · Credits: ${s.credits}`;
      });

      return `📚 **Your Enrolled Subjects (${subjects.length})**\n\n${rows.join('\n\n')}`;
    }

    default:
      return `I didn't quite understand that. Here's what I can help with:\n\n• "What is my attendance?"\n• "Show my marks"\n• "Am I at risk?"\n• "Give me recommendations"\n• "List my subjects"\n\nTry asking one of these!`;
  }
}

async function handleTeacherChat(userId: string, message: string): Promise<string> {
  const teacher = await User.findById(userId).select('name');
  if (!teacher) return "Profile not found.";

  const { intent } = detectIntent(message);

  switch (intent) {
    case 'greeting': {
      const hour = new Date().getHours();
      const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
      return `${greet}, ${teacher.name.split(' ')[0]}! 👋\n\nI can help you with:\n• At-risk student summary\n• Your subjects and sessions\n• Intervention status\n• Student attendance overview`;
    }

    case 'risk_query':
    case 'intervention_query': {
      const subjects = await Subject.find({ assignedTeacher: userId, isActive: true });
      const students = await User.find({
        role: 'student',
        department: { $in: subjects.map(s => s.department) },
        year: { $in: subjects.map(s => s.year) },
        section: { $in: subjects.map(s => s.section) },
        isActive: true,
      });

      let high = 0, moderate = 0, low = 0, unassessed = 0;
      for (const s of students) {
        const risk = await RiskAssessment.findOne({ studentId: s._id }).sort({ createdAt: -1 });
        if (!risk) unassessed++;
        else if (risk.riskLevel === 'HIGH') high++;
        else if (risk.riskLevel === 'MODERATE') moderate++;
        else low++;
      }

      const pending = await (Intervention as any).countDocuments({
        facultyId: userId,
        status: { $in: ['pending', 'scheduled'] },
      });

      return `📊 **Your Student Risk Summary**\n\n🔴 High Risk: ${high} student(s)\n🟡 Moderate Risk: ${moderate} student(s)\n🟢 Low Risk: ${low} student(s)\n⚪ Not Assessed: ${unassessed} student(s)\n\n📋 Pending Interventions: ${pending}\n\nVisit the Early Warning Dashboard for details.`;
    }

    case 'attendance_query': {
      const subjects = await Subject.find({ assignedTeacher: userId, isActive: true });
      const rows = [];
      for (const sub of subjects) {
        const sessions = await AttendanceSession.countDocuments({
          subjectId: sub._id,
          status: { $in: ['ended', 'expired'] },
        });
        const records = await AttendanceRecord.countDocuments({ subjectId: sub._id });
        rows.push(`📚 **${sub.subjectCode}** — ${sessions} sessions conducted, ${records} total attendance records`);
      }
      return `📊 **Your Subjects Overview**\n\n${rows.join('\n') || 'No session data yet.'}`;
    }

    default:
      return `I can help you with:\n\n• "Show at-risk students"\n• "My subject attendance"\n• "Pending interventions"\n\nOr visit the Early Warning Dashboard for full details.`;
  }
}

// ── Main Controller ───────────────────────────────────────────

export const chatWithBot = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Message is required' });
      return;
    }

    if (message.length > 500) {
      res.status(400).json({ success: false, message: 'Message too long (max 500 characters)' });
      return;
    }

    const userId = req.user!.userId;
    const role   = req.user!.role;
    const { intent } = detectIntent(message);

    let reply: string;

    if (role === 'student') {
      reply = await handleStudentChat(userId, message);
    } else if (role === 'teacher') {
      reply = await handleTeacherChat(userId, message);
    } else {
      reply = "The chatbot is currently available for students and teachers.";
    }

    res.json({
      success: true,
      data: {
        message: reply,
        intent,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Suggested Questions ───────────────────────────────────────

export const getChatSuggestions = async (req: AuthRequest, res: Response): Promise<void> => {
  const role = req.user!.role;

  const suggestions = role === 'student'
    ? [
        "What is my attendance?",
        "Am I at risk academically?",
        "Show my marks",
        "Give me recommendations",
        "Which subjects am I enrolled in?",
        "Am I in attendance shortage?",
      ]
    : [
        "Show at-risk students",
        "My subject attendance overview",
        "How many pending interventions?",
        "Student risk summary",
      ];

  res.json({ success: true, data: { suggestions } });
};
