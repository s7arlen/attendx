/**
 * Facial Recognition Controller
 * Handles face registration and verification for attendance
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { User } from '../models/User.model';
import { AttendanceSession } from '../models/AttendanceSession.model';
import { AttendanceRecord } from '../models/AttendanceRecord.model';
import { Subject } from '../models/Subject.model';
import { createAuditLog, getClientIp } from '../utils/auditLogger';
import { isValidObjectId } from '../utils/security';

const isValidDescriptor = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.length === 128 &&
  value.every((entry) => typeof entry === 'number' && Number.isFinite(entry));

/**
 * Calculate Euclidean distance between two face descriptors
 */
const calculateDistance = (descriptor1: number[], descriptor2: number[]): number => {
  if (descriptor1.length !== descriptor2.length) {
    throw new Error('Descriptors must have the same length');
  }

  let sumSquaredDiff = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    const diff = descriptor1[i] - descriptor2[i];
    sumSquaredDiff += diff * diff;
  }

  return Math.sqrt(sumSquaredDiff);
};

/**
 * Register face descriptor for a user
 * Called when student chooses facial recognition for first time
 */
export const registerFace = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { faceDescriptor } = req.body;

    if (!isValidDescriptor(faceDescriptor)) {
      res.status(400).json({
        success: false,
        message: 'Invalid face descriptor. Must be an array of 128 finite numbers.',
      });
      return;
    }

    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Store the face descriptor
    user.faceDescriptor = {
      descriptor: faceDescriptor,
      capturedAt: new Date(),
    };

    await user.save();

    await createAuditLog(
      req.user!.userId,
      'REGISTER_FACE',
      'User',
      user._id.toString(),
      { timestamp: new Date().toISOString() },
      getClientIp(req)
    );

    res.json({
      success: true,
      message: 'Face registered successfully',
      data: { hasFaceDescriptor: true },
    });
  } catch (error: any) {
    const message = process.env.NODE_ENV === 'production' ? 'Failed to register face' : error.message;
    res.status(500).json({ success: false, message });
  }
};

/**
 * Verify attendance using facial recognition
 */
export const verifyAttendanceWithFace = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, subjectId, secureToken, faceDescriptor } = req.body;

    if (!sessionId || !secureToken || !faceDescriptor || typeof secureToken !== 'string') {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    if (!isValidObjectId(sessionId)) {
      res.status(400).json({ success: false, message: 'Invalid session ID' });
      return;
    }

    if (!isValidDescriptor(faceDescriptor)) {
      res.status(400).json({
        success: false,
        message: 'Invalid face descriptor. Must be an array of 128 finite numbers.',
      });
      return;
    }

    // 1 — Validate session
    const session = await AttendanceSession.findById(sessionId);
    if (!session) {
      res.status(400).json({ success: false, message: 'Session not found' });
      return;
    }

    // Check if session is active or within grace period
    const expiry = new Date(
      session.expiryTime.getTime() + (session.gracePeriodMinutes || 0) * 60 * 1000
    );
    const isSessionValid = session.status === 'active' || new Date() <= expiry;

    if (!isSessionValid) {
      res.status(400).json({ success: false, message: 'Session is not active or has expired' });
      return;
    }

    if (session.qrToken !== secureToken) {
      res.status(400).json({ success: false, message: 'Invalid QR code' });
      return;
    }

    // 2 — Duplicate check
    const existingRecord = await AttendanceRecord.findOne({
      studentId: req.user!.userId,
      sessionId,
    });
    if (existingRecord) {
      res.status(409).json({ success: false, message: 'Attendance already marked' });
      return;
    }

    // 3 — Retrieve user and verify face
    const user = await User.findById(req.user!.userId);
    if (!user || !user.faceDescriptor?.descriptor) {
      res.status(400).json({
        success: false,
        message: 'No face descriptor registered. Please register your face first.',
      });
      return;
    }

    // Compare face descriptors
    const distance = calculateDistance(faceDescriptor, user.faceDescriptor.descriptor);
    const threshold = parseFloat(process.env.FACE_SIMILARITY_THRESHOLD || '0.65'); // Configurable threshold
    const similarity = Math.max(0, 1 - distance / 0.6);

    if (similarity < threshold) {
      res.status(401).json({
        success: false,
        message: 'Face verification failed. Please try again.',
        data: { similarity: similarity.toFixed(2), threshold, required: threshold }, // Return scores for debugging
      });
      return;
    }

    // 4 — Record attendance
    const subject = await Subject.findById(session.subjectId);
    const student = await User.findById(req.user!.userId);

    if (!subject || !student) {
      res.status(404).json({ success: false, message: 'Subject or student not found' });
      return;
    }

    // Grace period check
    const effectiveExpiry = new Date(
      session.expiryTime.getTime() + (session.gracePeriodMinutes || 0) * 60 * 1000
    );
    const isLate = session.status !== 'active' && new Date() <= effectiveExpiry;

    // Capacity check
    if (session.capacity && session.totalPresent >= session.capacity) {
      res.status(400).json({
        success: false,
        message: `Session is at full capacity (${session.capacity})`,
      });
      return;
    }

    // Verification mode check
    if (session.verificationMode === 'strict') {
      if (
        student.department !== subject.department ||
        student.year !== subject.year ||
        student.section !== subject.section
      ) {
        res.status(403).json({
          success: false,
          message: 'You are not enrolled in this class section',
        });
        return;
      }
    } else if (session.verificationMode === 'invite') {
      const roll = student.rollNumber?.toUpperCase() || '';
      if (!session.inviteList.includes(roll)) {
        res.status(403).json({
          success: false,
          message: 'You are not on the invite list for this session',
        });
        return;
      }
    }

    // Create attendance record
    const record = await AttendanceRecord.create({
      studentId: req.user!.userId,
      sessionId: session._id,
      subjectId: session.subjectId,
      timestamp: new Date(),
      verificationStatus: 'verified',
      verificationMethod: 'facial_recognition',
      isLate,
      ipAddress: getClientIp(req),
    });

    // Atomic increment
    await AttendanceSession.findByIdAndUpdate(sessionId, { $inc: { totalPresent: 1 } });

    await createAuditLog(
      req.user!.userId,
      'VERIFY_ATTENDANCE_FACE',
      'AttendanceRecord',
      record._id.toString(),
      {
        sessionId,
        subjectId,
        similarity: similarity.toFixed(2),
        isLate,
      },
      getClientIp(req)
    );

    res.json({
      success: true,
      message: 'Attendance marked via facial recognition',
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
