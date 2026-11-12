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
} from '@simplewebauthn/types';
import { AuthRequest } from '../middleware/auth.middleware';
import { User } from '../models/User.model';
import { AttendanceSession } from '../models/AttendanceSession.model';
import { AttendanceRecord } from '../models/AttendanceRecord.model';
import { Subject } from '../models/Subject.model';
import { createAuditLog, getClientIp } from '../utils/auditLogger';
import { emitToSession } from '../config/socket';
import { Server } from 'socket.io';

const RP_NAME = 'AttendX';
const RP_ID   = process.env.WEBAUTHN_RP_ID  || 'localhost';
const ORIGIN  = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173';

// ── REGISTRATION: Begin ──────────────────────────────────────────────────────
export const beginRegistration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    const excludeCredentials = user.webauthnCredentials.map((c) => ({
      id:         Buffer.from(c.credentialId, 'base64url'),
      type:       'public-key' as const,
      transports: (c.transports ?? []) as AuthenticatorTransport[],
    }));

    const options = await generateRegistrationOptions({
      rpName:                  RP_NAME,
      rpID:                    RP_ID,
      userID:                  user._id.toString(),
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
    res.status(500).json({ success: false, message: error.message });
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
      expectedOrigin:          ORIGIN,
      expectedRPID:            RP_ID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ success: false, message: 'Biometric registration failed' }); return;
    }

    const { registrationInfo } = verification;
    // v9 API: registrationInfo.credentialID, credentialPublicKey, counter, credentialDeviceType
    const credId   = Buffer.from(registrationInfo.credentialID).toString('base64url');
    const pubKey   = Buffer.from(registrationInfo.credentialPublicKey).toString('base64url');
    const counter  = registrationInfo.counter;
    const devType  = registrationInfo.credentialDeviceType;

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
    res.status(500).json({ success: false, message: error.message });
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
      id:         Buffer.from(c.credentialId, 'base64url'),
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
    res.status(500).json({ success: false, message: error.message });
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

    if (!sessionId || !secureToken || !assertion) {
      res.status(400).json({ success: false, message: 'Missing required fields' }); return;
    }

    // 1 — Validate session
    const session = await AttendanceSession.findById(sessionId);
    if (!session || session.status !== 'active' || new Date() > session.expiryTime) {
      res.status(400).json({ success: false, message: 'Session is not active or has expired' }); return;
    }
    if (session.qrToken !== secureToken) {
      res.status(400).json({ success: false, message: 'Invalid QR code' }); return;
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
      expectedOrigin:        ORIGIN,
      expectedRPID:          RP_ID,
      requireUserVerification: true,
      authenticator: {
        credentialID:        Buffer.from(storedCred.credentialId, 'base64url'),
        credentialPublicKey: Buffer.from(storedCred.publicKey,    'base64url'),
        counter:             storedCred.counter,
        transports:          (storedCred.transports ?? []) as AuthenticatorTransport[],
      },
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

    const record = await AttendanceRecord.create({
      studentId:          req.user!.userId,
      sessionId:          session._id,
      subjectId:          session.subjectId,
      timestamp:          new Date(),
      verificationStatus: 'verified',
      ipAddress:          getClientIp(req),
    });

    session.totalPresent += 1;
    await session.save();

    const io: Server = req.app.get('io');
    emitToSession(io, sessionId, 'attendance:marked', {
      studentId:    student._id,
      studentName:  student.name,
      rollNumber:   student.rollNumber,
      year:         student.year,
      section:      student.section,
      timestamp:    record.timestamp,
      totalPresent: session.totalPresent,
      method:       'biometric',
    });

    await createAuditLog(req.user!.userId, 'MARK_ATTENDANCE_BIOMETRIC', 'AttendanceRecord', record._id.toString(), { sessionId }, getClientIp(req));

    res.json({
      success: true,
      message: 'Attendance marked via biometric',
      data: {
        record,
        subject: { subjectName: subject.subjectName, subjectCode: subject.subjectCode },
        timestamp: record.timestamp,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
};
