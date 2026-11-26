import { Response } from 'express';
import { Request } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { User } from '../models/User.model';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { createAuditLog, getClientIp } from '../utils/auditLogger';
import { sendPasswordResetEmail, sendEmailVerificationCode } from '../utils/mailer';
import { AuthRequest } from '../middleware/auth.middleware';
import { hashSha256, safeEqualHex } from '../utils/security';
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(['teacher', 'student']),
  department: z.string().min(2).max(100),
  year: z.number().int().min(1).max(4).optional(),
  section: z.string().max(20).optional(),
  rollNumber: z.string()
    .optional()
    .refine(v => !v || /^4CB\d{2}(CS|AI|IS|CG|EC|ME|CV|EE)\d{3}$/i.test(v), {
      message: 'USN must be in format 4CB25CS001',
    }),
  phone: z.string().max(30).optional(),
  teacherInviteCode: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, message: 'Validation error', errors: validation.error.issues });
      return;
    }

    const { name, email, password, role, department, year, section, rollNumber, phone, teacherInviteCode } = validation.data;

    const requiredTeacherCode = process.env.TEACHER_INVITE_CODE?.trim();
    if (role === 'teacher' && requiredTeacherCode && teacherInviteCode?.trim() !== requiredTeacherCode) {
      res.status(403).json({
        success: false,
        message: 'Valid institutional teacher invite code is required for teacher registration.',
      });
      return;
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      res.status(409).json({ success: false, message: 'Email already registered' });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    const verifyCode = crypto.randomInt(100000, 999999).toString();
    const verifyExpiry = new Date(Date.now() + 15 * 60 * 1000);

    const user = await User.create({
      name,
      email,
      passwordHash,
      role,
      department,
      year,
      section,
      rollNumber,
      phone,
      isEmailVerified: false,
      emailVerifyToken: hashSha256(verifyCode),
      emailVerifyExpires: verifyExpiry,
      emailVerifyAttempts: 0,
    });

    const accessToken = generateAccessToken({ userId: user._id.toString(), role: user.role, email: user.email });
    const refreshToken = generateRefreshToken({ userId: user._id.toString(), role: user.role, email: user.email });

    await User.findByIdAndUpdate(user._id, { refreshToken: hashSha256(refreshToken) });

    sendEmailVerificationCode(user.email, user.name, verifyCode).catch(() => {});

    await createAuditLog(user._id.toString(), 'REGISTER', 'User', user._id.toString(), { role }, getClientIp(req));

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          year: user.year,
          section: user.section,
          rollNumber: user.rollNumber,
          isEmailVerified: false,
          hasWebAuthn: false,
          hasFaceDescriptor: false,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, message: 'Invalid credentials format' });
      return;
    }

    const { email, password } = validation.data;

    const user = await User.findOne({ email: email.toLowerCase().trim(), isActive: true });
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const accessToken = generateAccessToken({ userId: user._id.toString(), role: user.role, email: user.email });
    const refreshToken = generateRefreshToken({ userId: user._id.toString(), role: user.role, email: user.email });

    await User.findByIdAndUpdate(user._id, { refreshToken: hashSha256(refreshToken) });

    await createAuditLog(user._id.toString(), 'LOGIN', 'User', user._id.toString(), {}, getClientIp(req));

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          year: user.year,
          section: user.section,
          rollNumber: user.rollNumber,
          avatar: user.avatar,
          isEmailVerified: !!user.isEmailVerified,
          hasWebAuthn: Array.isArray(user.webauthnCredentials) && user.webauthnCredentials.length > 0,
          webauthnLocked: !!user.webauthnLocked,
          hasFaceDescriptor: !!user.faceDescriptor?.descriptor?.length,
          faceLocked: !!user.faceDescriptor?.locked,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;
    if (!token || typeof token !== 'string') {
      res.status(401).json({ success: false, message: 'Refresh token required' });
      return;
    }

    const decoded = verifyRefreshToken(token);
    const user = await User.findOne({
      _id: decoded.userId,
      refreshToken: hashSha256(token),
      isActive: true,
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }

    const accessToken = generateAccessToken({ userId: user._id.toString(), role: user.role, email: user.email });
    const newRefreshToken = generateRefreshToken({ userId: user._id.toString(), role: user.role, email: user.email });

    await User.findByIdAndUpdate(user._id, { refreshToken: hashSha256(newRefreshToken) });

    res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await User.findByIdAndUpdate(req.user?.userId, { refreshToken: null });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.userId).select('-passwordHash -refreshToken -passwordResetToken -passwordResetExpires');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.json({ success: true, data: { user } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load profile' });
  }
};

// ── UPDATE PROFILE ──────────────────────────────────────────
const safeAvatarSchema = z.string().max(500).refine((val) => {
  if (val.startsWith('/uploads/avatars/')) return !val.includes('..');
  try {
    const url = new URL(val);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}, { message: 'Avatar must be a valid HTTPS URL or uploaded avatar path' });

const updateProfileSchema = z.object({
  name:        z.string().min(2).max(100).optional(),
  phone:       z.string().max(30).optional(),
  department:  z.string().min(2).max(100).optional(),
  year:        z.number().int().min(1).max(4).optional(),
  section:     z.string().max(20).optional(),
  rollNumber:  z.string().max(30).optional(),
  avatar:      safeAvatarSchema.optional(),
});

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validation = updateProfileSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, errors: validation.error.issues });
      return;
    }
    const allowed: Record<string, unknown> = { ...validation.data };
    // Prevent students from self-modifying institutional enrollment/identity attributes used by strict & invite checks
    if (req.user!.role === 'student') {
      delete allowed.department;
      delete allowed.year;
      delete allowed.section;
      delete allowed.rollNumber;
    }
    const user = await User.findByIdAndUpdate(
      req.user!.userId,
      { $set: allowed },
      { new: true }
    ).select('-passwordHash -refreshToken -passwordResetToken -passwordResetExpires');
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    await createAuditLog(req.user!.userId, 'UPDATE_PROFILE', 'User', req.user!.userId, {}, getClientIp(req));
    res.json({ success: true, message: 'Profile updated', data: { user } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

// ── CHANGE PASSWORD ──────────────────────────────────────────
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || typeof newPassword !== 'string') {
      res.status(400).json({ success: false, message: 'currentPassword and newPassword required' });
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 100) {
      res.status(400).json({ success: false, message: 'New password must be 8-100 characters' });
      return;
    }
    const user = await User.findById(req.user!.userId);
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(400).json({ success: false, message: 'Current password is incorrect' });
      return;
    }
    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.refreshToken = undefined; // revoke existing refresh sessions
    await user.save();
    await createAuditLog(req.user!.userId, 'CHANGE_PASSWORD', 'User', req.user!.userId, {}, getClientIp(req));
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

// ── FORGOT PASSWORD ──────────────────────────────────────────
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ success: false, message: 'Email required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim(), isActive: true });
    if (!user) {
      res.json({ success: true, message: 'If that email exists, a reset code has been sent.' });
      return;
    }

    const resetCode = crypto.randomInt(100000, 999999).toString();
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await User.findByIdAndUpdate(user._id, {
      passwordResetToken: hashSha256(resetCode),
      passwordResetExpires: resetTokenExpiry,
      passwordResetAttempts: 0,
    });

    const emailSent = await sendPasswordResetEmail(user.email, user.name, resetCode);
    const isDev = process.env.NODE_ENV === 'development';

    res.json({
      success: true,
      message: emailSent
        ? 'A reset code has been sent to your email.'
        : 'If that email exists, a reset code has been sent.',
      ...(isDev && !emailSent && { devResetCode: resetCode }),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Password reset request failed' });
  }
};

// ── RESET PASSWORD ──────────────────────────────────────────
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, resetCode, newPassword } = req.body;
    if (!email || !resetCode || !newPassword || typeof resetCode !== 'string' || typeof newPassword !== 'string') {
      res.status(400).json({ success: false, message: 'email, resetCode, and newPassword required' });
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 100) {
      res.status(400).json({ success: false, message: 'New password must be 8-100 characters' });
      return;
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim(), isActive: true });
    if (!user || !user.passwordResetToken || !user.passwordResetExpires) {
      res.status(400).json({ success: false, message: 'Invalid or expired reset code' });
      return;
    }

    if (user.passwordResetExpires <= new Date() || (user.passwordResetAttempts ?? 0) >= 5) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.passwordResetAttempts = 0;
      await user.save();
      res.status(400).json({ success: false, message: 'Invalid or expired reset code' });
      return;
    }

    const incomingHash = hashSha256(resetCode.trim());
    const isValid = safeEqualHex(user.passwordResetToken, incomingHash);

    if (!isValid) {
      user.passwordResetAttempts = (user.passwordResetAttempts ?? 0) + 1;
      if (user.passwordResetAttempts >= 5) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
      }
      await user.save();
      res.status(400).json({ success: false, message: 'Invalid or expired reset code' });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordResetAttempts = 0;
    user.refreshToken = undefined; // invalidate existing refresh sessions
    await user.save();

    await createAuditLog(user._id.toString(), 'RESET_PASSWORD', 'User', user._id.toString(), {}, getClientIp(req));
    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Password reset failed' });
  }
};

// ── DELETE MY ACCOUNT (Check 12.3) ──────────────────────────
export const deleteMyAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { password } = req.body;
    if (!password || typeof password !== 'string') {
      res.status(400).json({ success: false, message: 'Password confirmation is required' });
      return;
    }

    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Incorrect password' });
      return;
    }

    if (user.avatar && user.avatar.startsWith('/uploads/avatars/')) {
      const oldPath = path.join(process.cwd(), user.avatar);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const userId = user._id;
    const { AttendanceRecord } = await import('../models/AttendanceRecord.model');
    const { AssessmentResult } = await import('../models/AssessmentResult.model');
    const { RiskAssessment } = await import('../models/RiskAssessment.model');
    const { Notification } = await import('../models/Notification.model');

    await Promise.all([
      AttendanceRecord.deleteMany({ studentId: userId }),
      AssessmentResult.deleteMany({ studentId: userId }),
      RiskAssessment.deleteMany({ studentId: userId }),
      Notification.deleteMany({ userId }),
      User.findByIdAndDelete(userId),
    ]);

    res.json({
      success: true,
      message: 'Your account and associated personal data have been deleted.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Account deletion failed' });
  }
};

// ── EMAIL VERIFICATION ─────────────────────────────────────────
export const sendEmailVerification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    if (user.isEmailVerified) {
      res.json({ success: true, message: 'Email is already verified.' });
      return;
    }

    const verifyCode = crypto.randomInt(100000, 999999).toString();
    user.emailVerifyToken = hashSha256(verifyCode);
    user.emailVerifyExpires = new Date(Date.now() + 15 * 60 * 1000);
    user.emailVerifyAttempts = 0;
    await user.save();

    const emailSent = await sendEmailVerificationCode(user.email, user.name, verifyCode);
    const isDev = process.env.NODE_ENV === 'development';

    res.json({
      success: true,
      message: emailSent ? 'Verification code sent to your email.' : 'Verification code generated.',
      ...(isDev && !emailSent && { devVerifyCode: verifyCode }),
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to send verification code' });
  }
};

export const verifyEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      res.status(400).json({ success: false, message: 'Verification code required' });
      return;
    }

    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    if (user.isEmailVerified) {
      res.json({ success: true, message: 'Email already verified.' });
      return;
    }
    if (!user.emailVerifyToken || !user.emailVerifyExpires || user.emailVerifyExpires <= new Date() || (user.emailVerifyAttempts ?? 0) >= 5) {
      user.emailVerifyToken = undefined;
      user.emailVerifyExpires = undefined;
      user.emailVerifyAttempts = 0;
      await user.save();
      res.status(400).json({ success: false, message: 'Verification code is invalid or expired.' });
      return;
    }

    const isValid = safeEqualHex(user.emailVerifyToken, hashSha256(code.trim()));
    if (!isValid) {
      user.emailVerifyAttempts = (user.emailVerifyAttempts ?? 0) + 1;
      await user.save();
      res.status(400).json({ success: false, message: 'Invalid verification code.' });
      return;
    }

    user.isEmailVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    user.emailVerifyAttempts = 0;
    await user.save();

    await createAuditLog(user._id.toString(), 'VERIFY_EMAIL', 'User', user._id.toString(), {}, getClientIp(req));
    res.json({ success: true, message: 'Email verified successfully.' });
  } catch {
    res.status(500).json({ success: false, message: 'Email verification failed' });
  }
};
