import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models/User.model';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { createAuditLog, getClientIp } from '../utils/auditLogger';
import { sendPasswordResetEmail } from '../utils/mailer';
import { AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(['teacher', 'student']),
  department: z.string().min(2).max(100),
  year: z.number().int().min(1).max(4).optional(),
  section: z.string().optional(),
  rollNumber: z.string()
    .optional()
    .refine(v => !v || /^4CB\d{2}(CS|AI|IS|CG|EC|ME|CV|EE)\d{3}$/i.test(v), {
      message: 'USN must be in format 4CB25CS001',
    }),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, message: 'Validation error', errors: validation.error.errors });
      return;
    }

    const { name, email, password, role, department, year, section, rollNumber, phone } = validation.data;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({ success: false, message: 'Email already registered' });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name, email, passwordHash, role, department, year, section, rollNumber, phone,
    });

    const accessToken = generateAccessToken({ userId: user._id.toString(), role: user.role, email: user.email });
    const refreshToken = generateRefreshToken({ userId: user._id.toString(), role: user.role, email: user.email });

    await User.findByIdAndUpdate(user._id, { refreshToken });

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
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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

    const user = await User.findOne({ email, isActive: true });
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

    await User.findByIdAndUpdate(user._id, { refreshToken });

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
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      res.status(401).json({ success: false, message: 'Refresh token required' });
      return;
    }

    const decoded = verifyRefreshToken(token);
    const user = await User.findOne({ _id: decoded.userId, refreshToken: token, isActive: true });

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }

    const accessToken = generateAccessToken({ userId: user._id.toString(), role: user.role, email: user.email });
    const newRefreshToken = generateRefreshToken({ userId: user._id.toString(), role: user.role, email: user.email });

    await User.findByIdAndUpdate(user._id, { refreshToken: newRefreshToken });

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
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.userId).select('-passwordHash -refreshToken');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.json({ success: true, data: { user } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── UPDATE PROFILE ──────────────────────────────────────────
const updateProfileSchema = z.object({
  name:        z.string().min(2).max(100).optional(),
  phone:       z.string().optional(),
  department:  z.string().min(2).optional(),
  year:        z.number().int().min(1).max(4).optional(),
  section:     z.string().optional(),
  rollNumber:  z.string().optional(),
  avatar:      z.string().optional(),
});

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validation = updateProfileSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, errors: validation.error.errors });
      return;
    }
    const allowed = validation.data;
    const user = await User.findByIdAndUpdate(
      req.user!.userId,
      { $set: allowed },
      { new: true }
    ).select('-passwordHash -refreshToken');
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    await createAuditLog(req.user!.userId, 'UPDATE_PROFILE', 'User', req.user!.userId, {}, getClientIp(req));
    res.json({ success: true, message: 'Profile updated', data: { user } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── CHANGE PASSWORD ──────────────────────────────────────────
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, message: 'currentPassword and newPassword required' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
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
    await user.save();
    await createAuditLog(req.user!.userId, 'CHANGE_PASSWORD', 'User', req.user!.userId, {}, getClientIp(req));
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── FORGOT PASSWORD (stub — email not configured) ──────────────────────────
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) { res.status(400).json({ success: false, message: 'Email required' }); return; }

    const user = await User.findOne({ email, isActive: true });
    // Always respond with 200 to prevent user enumeration
    if (!user) {
      res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
      return;
    }

    // Generate a secure reset token
    const resetCode = crypto.randomInt(100000, 999999).toString();
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await User.findByIdAndUpdate(user._id, {
      passwordResetToken: resetCode,
      passwordResetExpires: resetTokenExpiry,
    });

    // Try to send email — falls back to dev console log if SMTP not configured
    const emailSent = await sendPasswordResetEmail(user.email, user.name, resetCode);
    const isDev = process.env.NODE_ENV !== 'production';

    res.json({
      success: true,
      message: emailSent
        ? 'A reset code has been sent to your email.'
        : 'If that email exists, a reset link has been sent.',
      ...(isDev && !emailSent && { devResetCode: resetCode }),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── RESET PASSWORD ──────────────────────────────────────────
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, resetCode, newPassword } = req.body;
    if (!email || !resetCode || !newPassword) {
      res.status(400).json({ success: false, message: 'email, resetCode, and newPassword required' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
      return;
    }

    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      res.status(400).json({ success: false, message: 'Invalid or expired reset code' });
      return;
    }

    let isValid = false;
    if (user.passwordResetToken && user.passwordResetExpires) {
      isValid = user.passwordResetToken === resetCode && user.passwordResetExpires > new Date();
    } else if (user.webauthnChallenge?.startsWith('reset:')) {
      const parts = user.webauthnChallenge.split(':');
      const storedCode = parts[1];
      const expiryMs = parseInt(parts[2]);
      isValid = storedCode === resetCode && Date.now() <= expiryMs;
    }

    if (!isValid) {
      res.status(400).json({ success: false, message: 'Invalid or expired reset code' });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.webauthnChallenge = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
