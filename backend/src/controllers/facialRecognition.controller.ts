/**
 * Facial Recognition Controller
 * Handles liveness-verified face enrollment and anti-spoofing attendance verification.
 */

import { Response } from 'express';
import { Server } from 'socket.io';
import { AuthRequest } from '../middleware/auth.middleware';
import { User } from '../models/User.model';
import { AttendanceSession } from '../models/AttendanceSession.model';
import { AttendanceRecord } from '../models/AttendanceRecord.model';
import { AttendanceChallenge } from '../models/AttendanceChallenge.model';
import { Subject } from '../models/Subject.model';
import { createAuditLog, getClientIp } from '../utils/auditLogger';
import { isValidObjectId, checkGeoFence } from '../utils/security';
import { evaluateSessionWindow } from '../utils/qrSession';
import { emitToSession } from '../config/socket';
import {
  calculateEuclideanDistance,
  evaluateFaceMatch,
  LivenessAction,
  pickLivenessActions,
  verifyLivenessProof,
} from '../utils/faceSecurity';
import {
  checkStudentSessionEligibility,
  consumeChallengeAtomically,
  detectSameDeviceCollusion,
  getNormalizedDeviceId,
  incrementChallengeFailure,
  MAX_CHALLENGE_FAILED_ATTEMPTS,
  validateActiveChallenge,
} from '../utils/attendanceHelper';

const REGISTRATION_LIVENESS_ACTIONS: LivenessAction[] = ['blink', 'turn_left'];
const DUPLICATE_FACE_DISTANCE_THRESHOLD = 0.42;

/**
 * Register face descriptor for a user (one-time locked enrollment with liveness + cross-user uniqueness check).
 */
export const registerFace = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { livenessProof } = req.body;

    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (user.faceDescriptor?.descriptor?.length && user.faceDescriptor.locked !== false) {
      res.status(403).json({
        success: false,
        message: 'Face profile is locked after initial enrollment. Contact an administrator to reset it.',
      });
      return;
    }

    const livenessResult = verifyLivenessProof(REGISTRATION_LIVENESS_ACTIONS, livenessProof);
    if (!livenessResult.valid || !livenessResult.primaryDescriptor) {
      res.status(400).json({
        success: false,
        message: livenessResult.reason || 'Liveness verification failed during face enrollment.',
      });
      return;
    }

    const newDescriptor = livenessResult.primaryDescriptor;

    // Cross-user uniqueness check: prevent two accounts from enrolling the same face
    const otherUsers = await User.find({
      _id: { $ne: user._id },
      'faceDescriptor.descriptor.0': { $exists: true },
    }).select('_id rollNumber email faceDescriptor.descriptor');

    for (const other of otherUsers) {
      const otherDesc = other.faceDescriptor?.descriptor;
      if (!otherDesc || otherDesc.length !== 128) continue;
      const dist = calculateEuclideanDistance(newDescriptor, otherDesc);
      if (dist < DUPLICATE_FACE_DISTANCE_THRESHOLD) {
        await createAuditLog(
          req.user!.userId,
          'DUPLICATE_FACE_ENROLLMENT_BLOCKED',
          'User',
          user._id.toString(),
          { matchedUserId: other._id.toString(), distance: Number(dist.toFixed(3)) },
          getClientIp(req)
        );
        res.status(409).json({
          success: false,
          message: 'This face matches an already enrolled account. Contact an administrator if this is an error.',
        });
        return;
      }
    }

    user.faceDescriptor = {
      descriptor: newDescriptor,
      capturedAt: new Date(),
      locked: true,
      recentVerificationHashes: [],
    };
    await user.save();

    await createAuditLog(
      req.user!.userId,
      'REGISTER_FACE',
      'User',
      user._id.toString(),
      { timestamp: new Date().toISOString(), livenessActions: REGISTRATION_LIVENESS_ACTIONS },
      getClientIp(req)
    );

    res.json({
      success: true,
      message: 'Face enrolled and locked successfully',
      data: { hasFaceDescriptor: true, faceLocked: true },
    });
  } catch (error: any) {
    const message = process.env.NODE_ENV === 'production' ? 'Failed to register face' : error.message;
    res.status(500).json({ success: false, message });
  }
};

/**
 * Rotate liveness actions on an active scan challenge after a failed capture attempt
 */
export const retryFaceChallenge = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, challengeToken } = req.body;
    if (!isValidObjectId(sessionId)) {
      res.status(400).json({ success: false, message: 'Invalid session ID' });
      return;
    }
    const deviceId = getNormalizedDeviceId(req);
    const check = await validateActiveChallenge(challengeToken, req.user!.userId, sessionId, deviceId);
    if (!check.valid || !check.challenge) {
      res.status(check.status || 400).json({ success: false, message: check.message });
      return;
    }

    const nextActions = pickLivenessActions();
    check.challenge.livenessActions = nextActions;
    await check.challenge.save();

    res.json({
      success: true,
      data: {
        livenessActions: nextActions,
        remainingAttempts: Math.max(0, MAX_CHALLENGE_FAILED_ATTEMPTS - check.challenge.failedAttempts),
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to refresh liveness challenge' });
  }
};

/**
 * Verify attendance using server-issued liveness challenge + multi-frame facial recognition
 */
export const verifyAttendanceWithFace = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, subjectId, challengeToken, livenessProof } = req.body;

    if (!isValidObjectId(sessionId)) {
      res.status(400).json({ success: false, message: 'Invalid session ID' });
      return;
    }

    const deviceId = getNormalizedDeviceId(req);

    // 1 — Validate user-bound, single-use challenge
    const challengeCheck = await validateActiveChallenge(
      challengeToken,
      req.user!.userId,
      sessionId,
      deviceId
    );
    if (!challengeCheck.valid || !challengeCheck.challenge) {
      res.status(challengeCheck.status || 400).json({ success: false, message: challengeCheck.message });
      return;
    }
    const challenge = challengeCheck.challenge;

    // 2 — Validate session state & time window strictly (status === 'active' && now <= effectiveExpiry)
    const session = await AttendanceSession.findById(sessionId);
    const windowCheck = evaluateSessionWindow(session);
    if (!session || !windowCheck.valid) {
      res.status(400).json({ success: false, message: windowCheck.reason || 'Session is not active or has expired' });
      return;
    }

    const geoCheck = checkGeoFence(session.geoFence, req.body?.latitude, req.body?.longitude);
    if (!geoCheck.allowed) {
      res.status(403).json({ success: false, message: geoCheck.message });
      return;
    }

    // 3 — Duplicate & same-device collusion checks
    const existingRecord = await AttendanceRecord.findOne({
      studentId: req.user!.userId,
      sessionId,
    });
    if (existingRecord) {
      res.status(409).json({ success: false, message: 'Attendance already marked' });
      return;
    }

    const collusion = await detectSameDeviceCollusion(req, sessionId, req.user!.userId, deviceId);
    if (collusion.colluding) {
      res.status(403).json({ success: false, message: collusion.message });
      return;
    }

    // 4 — Retrieve enrolled face profile
    const user = await User.findById(req.user!.userId);
    if (!user || !user.faceDescriptor?.descriptor?.length) {
      res.status(400).json({
        success: false,
        message: 'No enrolled face profile found. Please enroll your face in Profile before marking attendance.',
      });
      return;
    }

    // 5 — Verify randomized active liveness proof
    const livenessResult = verifyLivenessProof(challenge.livenessActions, livenessProof);
    if (!livenessResult.valid || !livenessResult.primaryDescriptor) {
      const attempts = await incrementChallengeFailure(challenge._id.toString());
      await createAuditLog(
        req.user!.userId,
        'LIVENESS_CHECK_FAILED',
        'AttendanceSession',
        sessionId,
        { reason: livenessResult.reason, attempts },
        getClientIp(req)
      ).catch(() => {});
      res.status(400).json({
        success: false,
        message: livenessResult.reason || 'Liveness verification failed. Please complete the on-screen actions live.',
      });
      return;
    }

    // 6 — Compare live baseline descriptor against enrolled descriptor & reject replays
    const match = evaluateFaceMatch(
      livenessResult.primaryDescriptor,
      user.faceDescriptor.descriptor,
      user.faceDescriptor.recentVerificationHashes || []
    );

    if (match.isReplay) {
      await incrementChallengeFailure(challenge._id.toString());
      await createAuditLog(
        req.user!.userId,
        'FACE_REPLAY_DETECTED',
        'AttendanceSession',
        sessionId,
        { distance: Number(match.distance.toFixed(4)) },
        getClientIp(req)
      ).catch(() => {});
      res.status(401).json({
        success: false,
        message: 'Replayed or static face capture detected. Please look live at the camera and retry.',
      });
      return;
    }

    if (!match.matched) {
      await incrementChallengeFailure(challenge._id.toString());
      res.status(401).json({
        success: false,
        message: 'Face verification failed. Please ensure good lighting and retry.',
      });
      return;
    }

    // 7 — Eligibility & capacity check
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
      res.status(400).json({
        success: false,
        message: `Session is at full capacity (${session.capacity})`,
      });
      return;
    }

    // 8 — Consume challenge atomically to prevent concurrent double-submission
    const consumed = await consumeChallengeAtomically(challenge._id.toString());
    if (!consumed) {
      res.status(409).json({ success: false, message: 'Verification challenge already consumed.' });
      return;
    }

    // Save recent descriptor hash (keep latest 10) to block cross-session descriptor replay
    const prevHashes = user.faceDescriptor.recentVerificationHashes || [];
    user.faceDescriptor.recentVerificationHashes = [...prevHashes.slice(-9), match.liveHash];
    await user.save();

    const isLate = windowCheck.isLate;

    const record = await AttendanceRecord.create({
      studentId: req.user!.userId,
      sessionId: session._id,
      subjectId: session.subjectId,
      timestamp: new Date(),
      verificationStatus: 'verified',
      verificationMethod: 'facial_recognition',
      isLate,
      ipAddress: getClientIp(req),
      deviceId: deviceId || undefined,
      livenessPassed: true,
      livenessActions: challenge.livenessActions,
      faceConfidence: Number(match.similarity.toFixed(3)),
    });

    await AttendanceSession.findByIdAndUpdate(sessionId, { $inc: { totalPresent: 1 } });
    const updatedSession = await AttendanceSession.findById(sessionId).select('totalPresent');

    const io: Server = req.app.get('io');
    if (io) {
      emitToSession(io, sessionId, 'attendance:marked', {
        studentId: user._id,
        studentName: user.name,
        rollNumber: user.rollNumber,
        year: user.year,
        section: user.section,
        isLate,
        timestamp: record.timestamp,
        totalPresent: updatedSession?.totalPresent ?? session.totalPresent + 1,
        method: 'facial_recognition',
      });
    }

    await createAuditLog(
      req.user!.userId,
      'VERIFY_ATTENDANCE_FACE',
      'AttendanceRecord',
      record._id.toString(),
      {
        sessionId,
        subjectId,
        similarity: match.similarity.toFixed(2),
        livenessActions: challenge.livenessActions,
        isLate,
      },
      getClientIp(req)
    );

    res.json({
      success: true,
      message: `Attendance marked via facial recognition${isLate ? ' (late entry accepted)' : ''}`,
      data: {
        recordId: record._id,
        isLate,
        verificationMethod: 'facial_recognition',
        timestamp: record.timestamp,
      },
    });
  } catch (error: any) {
    const message = process.env.NODE_ENV === 'production' ? 'Failed to verify attendance' : error.message;
    res.status(500).json({ success: false, message });
  }
};
