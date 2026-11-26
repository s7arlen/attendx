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
import { getSystemSettings } from '../models/SystemSettings.model';
import { generateSessionAssets } from '../utils/qrGenerator';
import { createNotification } from '../utils/notificationHelper';
import { hashSha256 } from '../utils/security';

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
 * Get current IST wall-clock parts accurately regardless of host server timezone
 */
function getISTWallClock(now = new Date()): { dayName: string; hours: number; minutes: number } {
  const istMs = now.getTime() + 5.5 * 3600 * 1000;
  const istDate = new Date(istMs);
  return {
    dayName: DAY_MAP[istDate.getUTCDay()],
    hours: istDate.getUTCHours(),
    minutes: istDate.getUTCMinutes(),
  };
}

/**
 * Check timetable and auto-start sessions 2 minutes before class
 */
async function autoStartSessions() {
  try {
    const now = new Date();
    const { dayName: todayName, hours: currentHour, minutes: currentMinute } = getISTWallClock(now);

    if (todayName === 'Sunday') return;

    // Get today's timetable entries
    const entries = await Timetable.find({ day: todayName, isActive: true })
      .populate('subjectId')
      .populate('teacherId', 'name email');

    const settings = entries.length > 0 ? await getSystemSettings() : null;

    for (const entry of entries) {
      const { hours: startH, minutes: startM } = parseTime(entry.startTime);

      // Target window: 2 minutes before class start
      const targetM = startM - 2;
      const adjustedH = targetM < 0 ? (startH + 23) % 24 : startH;
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
      const durationMin = Math.max(5, (endH * 60 + endM) - (startH * 60 + startM));

      // Generate QR assets
      const newId = new mongoose.Types.ObjectId();
      const sessionIdStr = newId.toString();
      const { secureToken, sessionCode, dynamicCode, projectorSecret, qrCodeData } =
        await generateSessionAssets(sessionIdStr, subject._id.toString(), subject.subjectCode);

      // Store real UTC timestamps so expiry comparisons match `new Date()` everywhere
      const startTime  = new Date(now);
      const expiryTime = new Date(now.getTime() + durationMin * 60 * 1000);

      await AttendanceSession.create({
        _id:          newId,
        subjectId:    subject._id,
        teacherId:    entry.teacherId,
        sessionCode,
        dynamicCode,
        projectorSecret,
        qrToken:      secureToken,
        qrCodeData,
        issuedTokenHashes: [{ hash: hashSha256(secureToken), issuedAt: startTime }],
        startTime,
        expiryTime,
        status:       'active',
        duration:     durationMin,
        qrRefreshSeconds: settings?.qrRefreshSeconds ?? 15,
        qrLastRefreshedAt: startTime,
        autoCreated:  true,
      });

      console.log(`[auto-session] ✅ Started: ${subject.subjectCode} for ${teacher.name} (${entry.startTime}–${entry.endTime}, Room: ${entry.room || 'N/A'})`);

      // Notify teacher only (never send code to students)
      await createNotification(
        entry.teacherId.toString(),
        '📋 Attendance Session Started',
        `Your ${subject.subjectName} class starts in 2 minutes. Attendance session is live. Open Sessions to view QR and live classroom code.`,
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
    const { dayName: todayName, hours: currentHour, minutes: currentMinute } = getISTWallClock(new Date());
    if (todayName === 'Sunday') return;

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
 * Expire sessions that passed their effective expiry (expiryTime + gracePeriodMinutes)
 */
async function expireOverdueSessions() {
  try {
    const now = new Date();
    const activeSessions = await AttendanceSession.find({ status: 'active' }).select(
      '_id expiryTime gracePeriodMinutes'
    );
    const overdueIds = activeSessions
      .filter((s) => now.getTime() > new Date(s.expiryTime).getTime() + (s.gracePeriodMinutes || 0) * 60_000)
      .map((s) => s._id);

    if (overdueIds.length > 0) {
      const result = await AttendanceSession.updateMany(
        { _id: { $in: overdueIds }, status: 'active' },
        { $set: { status: 'expired' } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[auto-session] Expired ${result.modifiedCount} overdue session(s)`);
      }
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
