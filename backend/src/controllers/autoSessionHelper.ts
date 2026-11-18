import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Timetable } from '../models/Timetable.model';
import { AttendanceSession } from '../models/AttendanceSession.model';

const DAY_MAP: Record<number, string> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
  4: 'Thursday', 5: 'Friday', 6: 'Saturday',
};

function getIST(): Date {
  const now = new Date();
  return new Date(now.getTime() + 5.5 * 3600000);
}

export const getAutoSessionsToday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ist = getIST();
    const todayName = DAY_MAP[ist.getDay()];

    const timetable = await Timetable.find({
      teacherId: req.user!.userId,
      day: todayName,
      isActive: true,
    }).populate('subjectId', 'subjectName subjectCode').sort({ startTime: 1 });

    const slots = await Promise.all(timetable.map(async (slot) => {
      const sub = slot.subjectId as any;

      const [sh, sm] = slot.startTime.split(':').map(Number);
      const [eh, em] = slot.endTime.split(':').map(Number);

      const slotStart = new Date(ist);
      slotStart.setHours(sh, sm, 0, 0);
      const slotEnd = new Date(ist);
      slotEnd.setHours(eh, em, 0, 0);

      // Find session created within 15 min of slot start (auto or manual)
      const windowStart = new Date(slotStart.getTime() - 15 * 60000);
      const session = await AttendanceSession.findOne({
        subjectId: sub?._id,
        teacherId: req.user!.userId,
        startTime: { $gte: windowStart },
      }).sort({ createdAt: -1 });

      const now = ist.getTime();
      const startMs = slotStart.getTime();
      const endMs = slotEnd.getTime();

      let status: string;
      if (session?.status === 'active') status = 'live';
      else if (session?.status === 'ended' || session?.status === 'expired') status = 'done';
      else if (startMs > now) status = 'upcoming';
      else status = 'missed';

      const minutesUntil = startMs > now ? Math.round((startMs - now) / 60000) : null;

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
          passwordCode: session.passwordCode,
          sessionCode: session.sessionCode,
          totalPresent: session.totalPresent,
          status: session.status,
          autoCreated: (session as any).autoCreated || false,
        } : null,
      };
    }));

    res.json({ success: true, data: { day: todayName, slots, istTime: ist.toISOString() } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
