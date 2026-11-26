import { Router } from 'express';
import {
  register, login, refreshToken, logout, getMe,
  updateProfile, changePassword, forgotPassword, resetPassword,
  deleteMyAccount,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimiter';
import { verifyTurnstile } from '../utils/turnstile';

const router = Router();

router.post('/register', authLimiter, verifyTurnstile, register);
router.post('/login', authLimiter, login);
router.post('/refresh', authLimiter, refreshToken);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);

// Profile & password
router.put('/profile', authenticate, updateProfile);
router.post('/change-password', authenticate, changePassword);
router.delete('/account', authenticate, deleteMyAccount);
router.post('/forgot-password', authLimiter, verifyTurnstile, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

export default router;
