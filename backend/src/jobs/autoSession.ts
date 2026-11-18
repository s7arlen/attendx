/**
 * AttendX 2.0 — Auto Session Scheduler
 * Automatically starts attendance sessions 2 minutes before class
 * and ends them when class time is over — based on the timetable.
 */

import cron from 'node-cron';
import mongoose from 'mongoose';
import { Timetable } from '../models/Timetable.model';
import { AttendanceSession } from '../models/AttendanceSession.model';
import { Subject } from '../models/Subject.model';
import { User } from '../models/User.model';
import { generateSessionAssets } from '../utils/qrGenerator';
import { createNotification } from '../utils/notificationHelper';

const DAY_MAP: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

/**
 * Parse "HH:MM" time string into { hours, minutes }
 */
function parseTime(t: string): { hours: number; minutes: number } {
  const [h, m] = t.split(':').map(Number);
  return { hours: h, minutes: m };
}

/**
 * Get current IST time (UTC + 5:30)
 */
function getISTNow(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 5.5 * 3600000);
}

/**
 * Check timetable and auto-start sessions 2 minutes before class
 */
async function autoStartSessions() {
  try {
    const ist = getISTNow();
    const todayName = DAY_MAP[ist.getDay()];

    if (todayName === 'Sunday') return;

    const currentHour   = ist.getHours();
    const currentMinute = ist.getMinutes();

    // Get today's timetable entries
    const entries = await Timetable.find({ day: todayName, isActive: true })
      .populate('subjectId')
      .populate('teacherId', 'name email');

    for (const entry of entries) {
      const { hours: startH, minutes: startM } = parseTime(entry.startTime);

      // Target window: 2 minutes before class start
      const targetH = startH;
      const targetM = startM - 2;
      const adjustedH = targetM < 0 ? startH - 1 : startH;
      const adjustedM = targetM < 0 ? 60 + targetM : targetM;

      if (currentHour !== adjustedH || currentMinute !== adjustedM) continue;

      const subject = entry.subjectId as any;
      const teacher = entry.teacherId as any;

      // Check no active session already exists
      const existing = await AttendanceSession.findOne({
        subjectId: subject._id,
        teacherId: entry.teacherId,
        status: 'active',
      });
      if (existing) continue;

      // Calculate duration from timetable
      const { hours: endH, minutes: endM } = parseTime(entry.endTime);
      const durationMin = (endH * 60 + endM) - (startH * 60 + startM);

      // Generate QR assets
      const newId = new mongoose.Types.ObjectId();
      const sessionIdStr = newId.toString();
      const { secureToken, passwordCode, sessionCode, qrCodeData } =
        await generateSessionAssets(sessionIdStr, subject._id.toString(), subject.subjectCode);

      const startTime  = new Date(ist);
      const expiryTime = new Date(ist.getTime() + durationMin * 60 * 1000);

      await AttendanceSession.create({
        _id:          newId,
        subjectId:    subject._id,
        teacherId:    entry.teacherId,
        sessionCode,
        qrToken:      secureToken,
        qrCodeData,
        passwordCode,
        startTime,
        expiryTime,
        status:       'active',
        duration:     durationMin,
        autoCreated:  true,
      });

      console.log(`[auto-session] ✅ Started: ${subject.subjectCode} for ${teacher.name} (${entry.startTime}–${entry.endTime}, Room: ${entry.room || 'N/A'})`);

      // Notify teacher
      await createNotification(
        entry.teacherId.toString(),
        '📋 Attendance Session Started',
        `Your ${subject.subjectName} class starts in 2 minutes. Attendance session is live. Code: ${passwordCode}`,
        'info',
        '/teacher/sessions'
      );
    }
  } catch (err) {
    console.error('[auto-session] Start error:', err);
  }
}

/**
 * Check timetable and auto-end sessions when class time is over
 */
async function autoEndSessions() {
  try {
    const ist = getISTNow();
    const todayName = DAY_MAP[ist.getDay()];
    if (todayName === 'Sunday') return;

    const currentHour   = ist.getHours();
    const currentMinute = ist.getMinutes();

    const entries = await Timetable.find({ day: todayName, isActive: true })
      .populate('subjectId');

    for (const entry of entries) {
      const { hours: endH, minutes: endM } = parseTime(entry.endTime);

      if (currentHour !== endH || currentMinute !== endM) continue;

      const subject = entry.subjectId as any;

      // Find active session for this slot
      const session = await AttendanceSession.findOne({
        subjectId: subject._id,
        teacherId: entry.teacherId,
        status: 'active',
        autoCreated: true,
      });

      if (!session) continue;

      session.status = 'ended';
      await session.save();

      console.log(`[auto-session] ⏹  Ended: ${subject.subjectCode} session at ${entry.endTime}`);

      // Notify teacher
      await createNotification(
        entry.teacherId.toString(),
        '⏹ Attendance Session Ended',
        `Your ${subject.subjectName} session has ended automatically. ${session.totalPresent} students marked present.`,
        'success',
        '/teacher/sessions'
      );
    }
  } catch (err) {
    console.error('[auto-session] End error:', err);
  }
}

/**
 * Also expire sessions that passed their expiryTime
 */
async function expireOverdueSessions() {
  try {
    const now = new Date();
    const result = await AttendanceSession.updateMany(
      { status: 'active', expiryTime: { $lt: now } },
      { $set: { status: 'expired' } }
    );
    if (result.modifiedCount > 0) {
      console.log(`[auto-session] Expired ${result.modifiedCount} overdue session(s)`);
    }
  } catch (err) {
    console.error('[auto-session] Expire error:', err);
  }
}

export function startAutoSessionJob() {
  // Check every minute for sessions to start or end
  cron.schedule('* * * * *', async () => {
    await autoStartSessions();
    await autoEndSessions();
    await expireOverdueSessions();
  }, { timezone: 'UTC' });

  console.log('[auto-session] Cron job scheduled — checks every minute');
}

export { autoStartSessions, autoEndSessions };
