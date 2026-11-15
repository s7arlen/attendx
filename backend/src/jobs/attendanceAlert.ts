import cron from 'node-cron';
import { User } from '../models/User.model';
import { Subject } from '../models/Subject.model';
import { AttendanceRecord } from '../models/AttendanceRecord.model';
import { AttendanceSession } from '../models/AttendanceSession.model';
import { sendAttendanceWarningEmail } from '../utils/mailer';

const THRESHOLD = 75; // alert if below this %

interface LowSubject {
  subjectName: string;
  subjectCode: string;
  present: number;
  total: number;
  percentage: number;
}

async function checkAndAlert() {
  console.log('[attendance-alert] Running daily attendance check...');

  try {
    // Get all active students
    const students = await User.find({ role: 'student', isActive: true });

    let alertsSent = 0;
    let alertsSkipped = 0;

    for (const student of students) {
      // Get subjects matching this student
      const subjects = await Subject.find({
        department: student.department,
        year: student.year,
        section: student.section,
        isActive: true,
      });

      if (!subjects.length) continue;

      const lowSubjects: LowSubject[] = [];

      for (const subject of subjects) {
        // Total ended/expired sessions for this subject
        const totalSessions = await AttendanceSession.countDocuments({
          subjectId: subject._id,
          status: { $in: ['ended', 'expired'] },
        });

        if (totalSessions === 0) continue;

        // Sessions this student attended
        const present = await AttendanceRecord.countDocuments({
          studentId: student._id,
          subjectId: subject._id,
        });

        const percentage = Math.round((present / totalSessions) * 100);

        if (percentage < THRESHOLD) {
          lowSubjects.push({
            subjectName: subject.subjectName,
            subjectCode: subject.subjectCode,
            present,
            total: totalSessions,
            percentage,
          });
        }
      }

      if (lowSubjects.length > 0) {
        // Send warning email to student
        const sent = await sendAttendanceWarningEmail(
          student.email,
          student.name,
          lowSubjects
        );
        if (sent) {
          alertsSent++;
          console.log(`[attendance-alert] ⚠️  Alert sent to ${student.name} (${student.email}) — ${lowSubjects.length} subject(s) below ${THRESHOLD}%`);
        }
      } else {
        alertsSkipped++;
      }
    }

    console.log(`[attendance-alert] Done — ${alertsSent} alerts sent, ${alertsSkipped} students OK`);
  } catch (err) {
    console.error('[attendance-alert] Error:', err);
  }
}

// Schedule: every day at 6:00 PM IST = 12:30 UTC
// Cron format: minute hour * * *
export function startAttendanceAlertJob() {
  cron.schedule('30 12 * * *', () => {
    checkAndAlert();
  }, {
    timezone: 'UTC',
  });

  console.log('[attendance-alert] Cron job scheduled — runs daily at 6:00 PM IST');
}

// Export for manual trigger (testing)
export { checkAndAlert };
