import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX || '2000'), // Raised from 100 to support campus Wi-Fi NAT
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 100 : 20,
  message: { success: false, message: 'Too many authentication attempts, please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 60 : 15,
  message: { success: false, message: 'Too many requests, please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const attendanceLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60, // Raised from 5 to allow classroom-wide simultaneous scans
  message: { success: false, message: 'Too many attendance verification attempts, please try again in a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});
