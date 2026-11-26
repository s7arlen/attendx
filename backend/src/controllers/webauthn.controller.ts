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
import { isValidSessionQrToken } from '../utils/qrSession';
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
    // v14 API: in registrationInfo object
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
    user.webauthnChallenge = undefined;
    await user.save();

    await createAuditLog(user._id.toString(), 'WEBAUTHN_REGISTER', 'User', user._id.toString(), { credentialId: credId }, getClientIp(req));

    res.json({ success: true, message: 'Biometric registered successfully' });
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
      res.status(400).json({ success: false, message: 'No biometric credentials registered. Please register a device first.' }); return;
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
    const { sessionId, subjectId, secureToken, assertion } = req.body as {
      sessionId:   string;
      subjectId:   string;
      secureToken: string;
      assertion:   AuthenticationResponseJSON;
    };

    if (!sessionId || !secureToken || !assertion || typeof secureToken !== 'string') {
      res.status(400).json({ success: false, message: 'Missing required fields' }); return;
    }

    if (!isValidObjectId(sessionId)) {
      res.status(400).json({ success: false, message: 'Invalid session ID' }); return;
    }

    // 1 — Validate session
    const session = await AttendanceSession.findById(sessionId);
    if (!session || session.status !== 'active' || new Date() > session.expiryTime) {
      res.status(400).json({ success: false, message: 'Session is not active or has expired' }); return;
    }
    if (!isValidSessionQrToken(session, secureToken, true)) {
      res.status(400).json({ success: false, message: 'Invalid or expired QR code' }); return;
    }

    const geoCheck = checkGeoFence(session.geoFence, (req.body as any)?.latitude, (req.body as any)?.longitude);
    if (!geoCheck.allowed) {
      res.status(403).json({ success: false, message: geoCheck.message }); return;
    }

    // 2 — Duplicate check
    const existingRecord = await AttendanceRecord.findOne({ studentId: req.user!.userId, sessionId });
    if (existingRecord) {
      res.status(409).json({ success: false, message: 'Attendance already marked' }); return;
    }

    // 3 — Verify biometric assertion
    const user = await User.findById(req.user!.userId);
    if (!user || !user.webauthnChallenge) {
      res.status(400).json({ success: false, message: 'No pending biometric challenge. Call /auth/webauthn/authenticate/begin first.' }); return;
    }

    const storedCred = user.webauthnCredentials.find((c) => c.credentialId === assertion.id);
    if (!storedCred) {
      res.status(400).json({ success: false, message: 'Biometric credential not found on this account' }); return;
    }

    // v9 API: authenticator object instead of credential
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
      res.status(401).json({ success: false, message: 'Biometric verification failed' }); return;
    }

    // Update counter to prevent replay attacks
    storedCred.counter      = verification.authenticationInfo.newCounter;
    user.webauthnChallenge  = undefined;
    await user.save();

    // 4 — Record attendance
    const subject = await Subject.findById(session.subjectId);
    const student = await User.findById(req.user!.userId);
    if (!subject || !student) {
      res.status(404).json({ success: false, message: 'Subject or student not found' }); return;
    }

    // Grace period check
    const effectiveExpiry = new Date(
      session.expiryTime.getTime() + (session.gracePeriodMinutes || 0) * 60 * 1000
    );
    const isLate = session.status !== 'active' && new Date() <= effectiveExpiry;

    // Capacity check
    if (session.capacity && session.totalPresent >= session.capacity) {
      res.status(400).json({ success: false, message: `Session is at full capacity (${session.capacity})` }); return;
    }

    // Verification mode check
    if (session.verificationMode === 'strict') {
      if (
        student.department !== subject.department ||
        student.year !== subject.year ||
        student.section !== subject.section
      ) {
        res.status(403).json({ success: false, message: 'You are not enrolled in this class section' }); return;
      }
    } else if (session.verificationMode === 'invite') {
      const roll = student.rollNumber?.toUpperCase() || '';
      if (!session.inviteList.includes(roll)) {
        res.status(403).json({ success: false, message: 'You are not on the invite list for this session' }); return;
      }
    }

    const record = await AttendanceRecord.create({
      studentId:          req.user!.userId,
      sessionId:          session._id,
      subjectId:          session.subjectId,
      timestamp:          new Date(),
      verificationStatus: 'verified',
      verificationMethod: 'biometric',
      isLate,
      ipAddress:          getClientIp(req),
    });

    // Atomic increment
    await AttendanceSession.findByIdAndUpdate(sessionId, { $inc: { totalPresent: 1 } });
    const updatedSession = await AttendanceSession.findById(sessionId).select('totalPresent');

    const io: Server = req.app.get('io');
    emitToSession(io, sessionId, 'attendance:marked', {
      studentId:    student._id,
      studentName:  student.name,
      rollNumber:   student.rollNumber,
      year:         student.year,
      section:      student.section,
      isLate,
      timestamp:    record.timestamp,
      totalPresent: updatedSession?.totalPresent ?? session.totalPresent + 1,
      method:       'biometric',
    });

    await createAuditLog(req.user!.userId, 'MARK_ATTENDANCE_BIOMETRIC', 'AttendanceRecord', record._id.toString(), { sessionId, isLate }, getClientIp(req));

    // Notify student
    const { Notification } = await import('../models/Notification.model');
    await Notification.create({
      userId: req.user!.userId,
      title: 'Attendance Marked',
      message: `Your attendance for ${subject.subjectName} has been recorded via biometrics${isLate ? ' (late entry)' : ''}.`,
      type: 'success',
      link: '/student/attendance',
    });

    // Background risk reassessment
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
    const user = await User.findById(req.user!.userId).select('webauthnCredentials');
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    res.json({
      success: true,
      data: {
        registered: user.webauthnCredentials.length > 0,
        count:      user.webauthnCredentials.length,
        devices:    user.webauthnCredentials.map((c) => ({
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
