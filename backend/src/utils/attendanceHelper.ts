import crypto from 'crypto';
import { Request } from 'express';
import { AttendanceChallenge, IAttendanceChallenge } from '../models/AttendanceChallenge.model';
import { AttendanceRecord } from '../models/AttendanceRecord.model';
import { IAttendanceSession } from '../models/AttendanceSession.model';
import { ISubject } from '../models/Subject.model';
import { IUser } from '../models/User.model';
import { createAuditLog, getClientIp } from './auditLogger';
import { pickLivenessActions } from './faceSecurity';
import { hashSha256 } from './security';

export const CHALLENGE_TTL_MS = 120_000;
export const MAX_CHALLENGE_FAILED_ATTEMPTS = 5;
export const VERIFIED_ATTENDANCE_FILTER = { verificationStatus: 'verified' } as const;

export function getNormalizedDeviceId(req: Request): string | null {
  const rawHeader = req.headers['x-device-id'];
  const rawBody = (req.body as any)?.deviceId;
  const candidate = typeof rawHeader === 'string' && rawHeader.trim()
    ? rawHeader.trim()
    : typeof rawBody === 'string' && rawBody.trim()
      ? rawBody.trim()
      : '';
  if (!candidate || candidate.length < 8 || candidate.length > 128) {
    return null;
  }
  return hashSha256(candidate);
}

export function checkStudentSessionEligibility(
  session: Pick<IAttendanceSession, 'verificationMode' | 'inviteList'>,
  student: Pick<IUser, 'department' | 'year' | 'section' | 'rollNumber'>,
  subject: Pick<ISubject, 'department' | 'year' | 'section'> | null | undefined
): { allowed: boolean; message?: string } {
  if (!subject) {
    return { allowed: false, message: 'Subject not found' };
  }
  if (session.verificationMode === 'strict') {
    if (
      student.department !== subject.department ||
      student.year !== subject.year ||
      student.section !== subject.section
    ) {
      return { allowed: false, message: 'You are not enrolled in this class section' };
    }
  } else if (session.verificationMode === 'invite') {
    const roll = student.rollNumber?.toUpperCase() || '';
    if (!roll || !session.inviteList.includes(roll)) {
      return { allowed: false, message: 'You are not on the invite list for this session' };
    }
  }
  return { allowed: true };
}

export async function detectSameDeviceCollusion(
  req: Request,
  sessionId: string,
  studentId: string,
  deviceId: string | null
): Promise<{ colluding: boolean; message?: string }> {
  if (!deviceId) return { colluding: false };

  const existingByOther = await AttendanceRecord.findOne({
    sessionId,
    deviceId,
    studentId: { $ne: studentId },
  }).select('_id');

  if (existingByOther) {
    await createAuditLog(
      studentId,
      'PROXY_ATTEMPT_SAME_DEVICE',
      'AttendanceSession',
      sessionId,
      { deviceIdPrefix: deviceId.slice(0, 12) },
      getClientIp(req)
    ).catch(() => {});
    return {
      colluding: true,
      message: 'This device was already used to mark attendance for another student in this session.',
    };
  }
  return { colluding: false };
}

export async function issueAttendanceChallenge(
  studentId: string,
  sessionId: string,
  deviceId: string | null
) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const livenessActions = pickLivenessActions();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  await AttendanceChallenge.create({
    tokenHash: hashSha256(rawToken),
    studentId,
    sessionId,
    livenessActions,
    deviceId,
    failedAttempts: 0,
    used: false,
    expiresAt,
  });

  return {
    challengeToken: rawToken,
    livenessActions,
    challengeExpiresAt: expiresAt.toISOString(),
  };
}

export async function validateActiveChallenge(
  rawChallengeToken: string,
  studentId: string,
  sessionId: string,
  deviceId: string | null
): Promise<{ valid: boolean; challenge?: IAttendanceChallenge; status?: number; message?: string }> {
  if (!rawChallengeToken || typeof rawChallengeToken !== 'string') {
    return { valid: false, status: 400, message: 'Verification challenge token required. Please re-scan the QR or classroom code.' };
  }

  const challenge = await AttendanceChallenge.findOne({
    tokenHash: hashSha256(rawChallengeToken),
    studentId,
    sessionId,
  });

  if (!challenge) {
    return { valid: false, status: 401, message: 'Invalid or expired scan challenge. Please re-scan the QR or code.' };
  }
  if (challenge.used) {
    return { valid: false, status: 409, message: 'This scan challenge has already been used. Please scan again.' };
  }
  if (challenge.expiresAt <= new Date()) {
    return { valid: false, status: 400, message: 'Scan verification timed out. Please re-scan the live QR or code.' };
  }
  if (challenge.failedAttempts >= MAX_CHALLENGE_FAILED_ATTEMPTS) {
    return { valid: false, status: 429, message: 'Too many failed verification attempts. Please re-scan the QR or wait.' };
  }
  if (challenge.deviceId && deviceId && challenge.deviceId !== deviceId) {
    return { valid: false, status: 403, message: 'Verification must be completed on the same device that scanned the session.' };
  }

  return { valid: true, challenge };
}

export async function consumeChallengeAtomically(challengeId: string): Promise<boolean> {
  const updated = await AttendanceChallenge.findOneAndUpdate(
    { _id: challengeId, used: false },
    { $set: { used: true } },
    { new: true }
  );
  return !!updated;
}

export async function incrementChallengeFailure(challengeId: string): Promise<number> {
  const updated = await AttendanceChallenge.findByIdAndUpdate(
    challengeId,
    { $inc: { failedAttempts: 1 } },
    { new: true }
  );
  return updated?.failedAttempts ?? 1;
}
