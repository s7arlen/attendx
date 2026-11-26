import { Response } from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransport,
} from '@simplewebauthn/types';
import { AuthRequest } from '../middleware/auth.middleware';
import { User } from '../models/User.model';
import { AttendanceSession } from '../models/AttendanceSession.model';
import { AttendanceRecord } from '../models/AttendanceRecord.model';
import { Subject } from '../models/Subject.model';
import { createAuditLog, getClientIp } from '../utils/auditLogger';
import { emitToSession } from '../config/socket';
import { getAllowedOrigins, isValidObjectId, checkGeoFence } from '../utils/security';
import { evaluateSessionWindow } from '../utils/qrSession';
import {
  checkStudentSessionEligibility,
  consumeChallengeAtomically,
  detectSameDeviceCollusion,
  getNormalizedDeviceId,
  incrementChallengeFailure,
  validateActiveChallenge,
} from '../utils/attendanceHelper';
import { Server } from 'socket.io';

const RP_NAME = 'AttendX';
const RP_ID   = process.env.WEBAUTHN_RP_ID || 'localhost';
const ORIGIN  = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173';
const getExpectedOrigins = (): string[] => Array.from(new Set([ORIGIN, ...getAllowedOrigins()]));

// ── REGISTRATION: Begin ──────────────────────────────────────────────────────
export const beginRegistration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    if (user.role === 'student' && user.webauthnCredentials.length > 0 && user.webauthnLocked !== false) {
      res.status(403).json({
        success: false,
        message: 'Biometric device is locked after initial registration. Contact an administrator to reset.',
      });
      return;
    }

    const excludeCredentials = user.webauthnCredentials.map((c) => ({
      id:         c.credentialId,
      type:       'public-key' as const,
      transports: (c.transports ?? []) as AuthenticatorTransport[],
    }));

    const options = await generateRegistrationOptions({
      rpName:                  RP_NAME,
      rpID:                    RP_ID,
      userID:                  new TextEncoder().encode(user._id.toString()),
      userName:                user.email,
      userDisplayName:         user.name,
      attestationType:         'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey:             'preferred',
        userVerification:        'required',
      },
      excludeCredentials,
    });

    user.webauthnChallenge = options.challenge;
    await user.save();

    res.json({ success: true, data: options });
  } catch (error: any) {
    const message = process.env.NODE_ENV === 'production' ? 'Failed to start biometric registration' : error.message;
    res.status(500).json({ success: false, message });
  }
};

// ── REGISTRATION: Complete ───────────────────────────────────────────────────
export const completeRegistration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user || !user.webauthnChallenge) {
      res.status(400).json({ success: false, message: 'No pending registration challenge' }); return;
    }

    if (user.role === 'student' && user.webauthnCredentials.length > 0 && user.webauthnLocked !== false) {
      res.status(403).json({
        success: false,
        message: 'Biometric device is locked after initial registration. Contact an administrator to reset.',
      });
      return;
    }

    const body: RegistrationResponseJSON = req.body;

    const verification = await verifyRegistrationResponse({
      response:                body,
      expectedChallenge:       user.webauthnChallenge,
      expectedOrigin:          getExpectedOrigins(),
      expectedRPID:            RP_ID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ success: false, message: 'Biometric registration failed' }); return;
    }

    const { registrationInfo } = verification;
    const credId   = (registrationInfo.credential as any).id;
    const pubKey   = Buffer.from((registrationInfo.credential as any).publicKey).toString('base64url');
    const counter  = (registrationInfo.credential as any).signCount || 0;
    const devType  = registrationInfo.credentialDeviceType || 'unknown';

    user.webauthnCredentials.push({
      credentialId: credId,
      publicKey:    pubKey,
      counter,
      deviceType:   devType,
      transports:   (body.response as any).transports ?? [],
      createdAt:    new Date(),
    });
    if (user.role === 'student') {
      user.webauthnLocked = true;
    }
    user.webauthnChallenge = undefined;
    await user.save();

    await createAuditLog(user._id.toString(), 'WEBAUTHN_REGISTER', 'User', user._id.toString(), { credentialId: credId }, getClientIp(req));

    res.json({ success: true, message: 'Biometric registered and locked successfully' });
  } catch (error: any) {
    const message = process.env.NODE_ENV === 'production' ? 'Failed to complete biometric registration' : error.message;
    res.status(500).json({ success: false, message });
  }
};

// ── AUTHENTICATION: Begin ────────────────────────────────────────────────────
export const beginAuthentication = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    if (!user.webauthnCredentials.length) {
      res.status(400).json({ success: false, message: 'No biometric credentials registered. Please enroll your device in Profile first.' }); return;
    }

    const allowCredentials = user.webauthnCredentials.map((c) => ({
      id:         c.credentialId,
      type:       'public-key' as const,
      transports: (c.transports ?? []) as AuthenticatorTransport[],
    }));

    const options = await generateAuthenticationOptions({
      rpID:             RP_ID,
      userVerification: 'required',
      allowCredentials,
    });

    user.webauthnChallenge = options.challenge;
    await user.save();

    res.json({ success: true, data: options });
  } catch (error: any) {
    const message = process.env.NODE_ENV === 'production' ? 'Failed to start biometric authentication' : error.message;
    res.status(500).json({ success: false, message });
  }
};

// ── ATTENDANCE: Verify with biometric ───────────────────────────────────────
export const verifyAttendanceWithBiometric = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, challengeToken, assertion } = req.body as {
      sessionId: string;
      challengeToken: string;
      assertion: AuthenticationResponseJSON;
    };

    if (!sessionId || !challengeToken || !assertion) {
      res.status(400).json({ success: false, message: 'Missing required fields' }); return;
    }

    if (!isValidObjectId(sessionId)) {
      res.status(400).json({ success: false, message: 'Invalid session ID' }); return;
    }

    const deviceId = getNormalizedDeviceId(req);

    // 1 — Validate user-bound, single-use scan challenge
    const challengeCheck = await validateActiveChallenge(
      challengeToken,
      req.user!.userId,
      sessionId,
      deviceId
    );
    if (!challengeCheck.valid || !challengeCheck.challenge) {
      res.status(challengeCheck.status || 400).json({ success: false, message: challengeCheck.message }); return;
    }
    const challenge = challengeCheck.challenge;

    // 2 — Validate session strictly (active + within expiryTime + gracePeriodMinutes)
    const session = await AttendanceSession.findById(sessionId);
    const windowCheck = evaluateSessionWindow(session);
    if (!session || !windowCheck.valid) {
      res.status(400).json({ success: false, message: windowCheck.reason || 'Session is not active or has expired' }); return;
    }

    const geoCheck = checkGeoFence(session.geoFence, (req.body as any)?.latitude, (req.body as any)?.longitude);
    if (!geoCheck.allowed) {
      res.status(403).json({ success: false, message: geoCheck.message }); return;
    }

    // 3 — Duplicate & same-device collusion check
    const existingRecord = await AttendanceRecord.findOne({ studentId: req.user!.userId, sessionId });
    if (existingRecord) {
      res.status(409).json({ success: false, message: 'Attendance already marked' }); return;
    }

    const collusion = await detectSameDeviceCollusion(req, sessionId, req.user!.userId, deviceId);
    if (collusion.colluding) {
      res.status(403).json({ success: false, message: collusion.message }); return;
    }

    // 4 — Verify biometric assertion
    const user = await User.findById(req.user!.userId);
    if (!user || !user.webauthnChallenge) {
      res.status(400).json({ success: false, message: 'No pending biometric challenge. Call /auth/webauthn/authenticate/begin first.' }); return;
    }

    const storedCred = user.webauthnCredentials.find((c) => c.credentialId === assertion.id);
    if (!storedCred) {
      res.status(400).json({ success: false, message: 'Biometric credential not found on this account' }); return;
    }

    const verification = await verifyAuthenticationResponse({
      response:              assertion,
      expectedChallenge:     user.webauthnChallenge,
      expectedOrigin:        getExpectedOrigins(),
      expectedRPID:          RP_ID,
      requireUserVerification: true,
      credential: {
        id:                  storedCred.credentialId,
        publicKey:           Buffer.from(storedCred.publicKey, 'base64url'),
        signCount:           storedCred.counter,
        transports:          (storedCred.transports ?? []) as AuthenticatorTransport[],
      } as any,
    });

    if (!verification.verified) {
      await incrementChallengeFailure(challenge._id.toString());
      res.status(401).json({ success: false, message: 'Biometric verification failed' }); return;
    }

    // Update counter to prevent replay attacks
    storedCred.counter      = verification.authenticationInfo.newCounter;
    user.webauthnChallenge  = undefined;
    await user.save();

    // 5 — Record attendance
    const subject = await Subject.findById(session.subjectId);
    const eligibility = checkStudentSessionEligibility(session, user, subject);
    if (!eligibility.allowed || !subject) {
      res.status(eligibility.message === 'Subject not found' ? 404 : 403).json({
        success: false,
        message: eligibility.message,
      });
      return;
    }

    if (session.capacity && session.totalPresent >= session.capacity) {
      res.status(400).json({ success: false, message: `Session is at full capacity (${session.capacity})` }); return;
    }

    const consumed = await consumeChallengeAtomically(challenge._id.toString());
    if (!consumed) {
      res.status(409).json({ success: false, message: 'Verification challenge already consumed.' }); return;
    }

    const isLate = windowCheck.isLate;

    const record = await AttendanceRecord.create({
      studentId:          req.user!.userId,
      sessionId:          session._id,
      subjectId:          session.subjectId,
      timestamp:          new Date(),
      verificationStatus: 'verified',
      verificationMethod: 'biometric',
      isLate,
      ipAddress:          getClientIp(req),
      deviceId:           deviceId || undefined,
    });

    await AttendanceSession.findByIdAndUpdate(sessionId, { $inc: { totalPresent: 1 } });
    const updatedSession = await AttendanceSession.findById(sessionId).select('totalPresent');

    const io: Server = req.app.get('io');
    emitToSession(io, sessionId, 'attendance:marked', {
      studentId:    user._id,
      studentName:  user.name,
      rollNumber:   user.rollNumber,
      year:         user.year,
      section:      user.section,
      isLate,
      timestamp:    record.timestamp,
      totalPresent: updatedSession?.totalPresent ?? session.totalPresent + 1,
      method:       'biometric',
    });

    await createAuditLog(req.user!.userId, 'MARK_ATTENDANCE_BIOMETRIC', 'AttendanceRecord', record._id.toString(), { sessionId, isLate }, getClientIp(req));

    const { Notification } = await import('../models/Notification.model');
    await Notification.create({
      userId: req.user!.userId,
      title: 'Attendance Marked',
      message: `Your attendance for ${subject.subjectName} has been recorded via biometrics${isLate ? ' (late entry)' : ''}.`,
      type: 'success',
      link: '/student/attendance',
    });

    import('../controllers/academic.controller')
      .then(m => m.triggerRiskAssessment(req.user!.userId))
      .catch(() => {});

    res.json({
      success: true,
      message: `Attendance marked via biometric${isLate ? ' (late entry accepted)' : ''}`,
      data: {
        record,
        isLate,
        subject: { subjectName: subject.subjectName, subjectCode: subject.subjectCode },
        timestamp: record.timestamp,
        sessionType: session.sessionType,
        venue: session.venue,
      },
    });
  } catch (error: any) {
    const message = process.env.NODE_ENV === 'production' ? 'Biometric verification failed' : error.message;
    res.status(500).json({ success: false, message });
  }
};

// ── GET: Status ──────────────────────────────────────────────────────────────
export const getBiometricStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId).select('webauthnCredentials webauthnLocked role');
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    res.json({
      success: true,
      data: {
        registered: user.webauthnCredentials.length > 0,
        locked:     !!user.webauthnLocked,
        count:      user.webauthnCredentials.length,
        devices:    user.webauthnCredentials.map((c) => ({
          id:           c.credentialId,
          credentialId: c.credentialId.slice(0, 8) + '…',
          deviceType:   c.deviceType,
          registeredAt: c.createdAt,
        })),
      },
    });
  } catch (error: any) {
    const message = process.env.NODE_ENV === 'production' ? 'Failed to fetch biometric status' : error.message;
    res.status(500).json({ success: false, message });
  }
};

// ── DELETE: Remove credential ────────────────────────────────────────────────
export const removeCredential = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { credentialId } = req.params;
    const user = await User.findById(req.user!.userId);
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    if (user.role === 'student' && user.webauthnLocked) {
      res.status(403).json({
        success: false,
        message: 'Biometric device is locked by institutional policy. Contact an administrator to reset.',
      });
      return;
    }

    const before = user.webauthnCredentials.length;
    user.webauthnCredentials = user.webauthnCredentials.filter(
      (c) => c.credentialId !== credentialId
    ) as any;
    if (user.webauthnCredentials.length === before) {
      res.status(404).json({ success: false, message: 'Credential not found' }); return;
    }
    await user.save();
    res.json({ success: true, message: 'Biometric credential removed' });
  } catch (error: any) {
    const message = process.env.NODE_ENV === 'production' ? 'Failed to remove biometric credential' : error.message;
    res.status(500).json({ success: false, message });
  }
};
