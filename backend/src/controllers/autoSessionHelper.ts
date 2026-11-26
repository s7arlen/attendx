import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Timetable } from '../models/Timetable.model';
import { AttendanceSession } from '../models/AttendanceSession.model';

const DAY_MAP: Record<number, string> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
  4: 'Thursday', 5: 'Friday', 6: 'Saturday',
};

function getISTParts(now = new Date()): {
  dayName: string;
  year: number;
  month: number;
  date: number;
  isoString: string;
} {
  const istMs = now.getTime() + 5.5 * 3600000;
  const ist = new Date(istMs);
  return {
    dayName: DAY_MAP[ist.getUTCDay()],
    year: ist.getUTCFullYear(),
    month: ist.getUTCMonth(),
    date: ist.getUTCDate(),
    isoString: ist.toISOString(),
  };
}

export const getAutoSessionsToday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const nowDate = new Date();
    const ist = getISTParts(nowDate);
    const todayName = ist.dayName;

    const timetable = await Timetable.find({
      teacherId: req.user!.userId,
      day: todayName,
      isActive: true,
    }).populate('subjectId', 'subjectName subjectCode').sort({ startTime: 1 });

    const slots = await Promise.all(timetable.map(async (slot) => {
      const sub = slot.subjectId as any;

      const [sh, sm] = slot.startTime.split(':').map(Number);

      // Compute slot start as real UTC epoch corresponding to today's IST HH:MM
      const slotStartUtcMs = Date.UTC(ist.year, ist.month, ist.date, sh, sm, 0, 0) - 5.5 * 3600000;

      // Find session created within 15 min of slot start (auto or manual)
      const windowStart = new Date(slotStartUtcMs - 15 * 60000);
      const session = await AttendanceSession.findOne({
        subjectId: sub?._id,
        teacherId: req.user!.userId,
        startTime: { $gte: windowStart },
      }).sort({ createdAt: -1 });

      const nowMs = nowDate.getTime();
      const startMs = slotStartUtcMs;

      let status: string;
      if (session?.status === 'active') status = 'live';
      else if (session?.status === 'ended' || session?.status === 'expired') status = 'done';
      else if (startMs > nowMs) status = 'upcoming';
      else status = 'missed';

      const minutesUntil = startMs > nowMs ? Math.round((startMs - nowMs) / 60000) : null;

      return {
        timetableId: slot._id,
        subjectName: sub?.subjectName || 'Unknown',
        subjectCode: sub?.subjectCode || '',
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room || null,
        status,
        minutesUntilStart: minutesUntil,
        autoSessionWillStart: status === 'upcoming' && !session,
        session: session ? {
          id: session._id,
          sessionCode: session.sessionCode,
          totalPresent: session.totalPresent,
          status: session.status,
          autoCreated: (session as any).autoCreated || false,
        } : null,
      };
    }));

    res.json({ success: true, data: { day: todayName, slots, istTime: ist.isoString } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
