import crypto from 'crypto';
import mongoose from 'mongoose';
import { Request } from 'express';

const WEAK_SECRETS = new Set([
  'secret',
  'refresh-secret',
  'change-this-in-production',
  'change-this-refresh-in-production',
]);

export function validateSecurityEnv(): void {
  const isProd = process.env.NODE_ENV === 'production';
  const jwtSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!jwtSecret || WEAK_SECRETS.has(jwtSecret) || (isProd && jwtSecret.length < 32)) {
    throw new Error('FATAL: JWT_SECRET must be set to a strong random string (>= 32 chars in production).');
  }
  if (!refreshSecret || WEAK_SECRETS.has(refreshSecret) || (isProd && refreshSecret.length < 32)) {
    throw new Error('FATAL: JWT_REFRESH_SECRET must be set to a strong random string (>= 32 chars in production).');
  }
  if (isProd && !process.env.MONGODB_URI) {
    throw new Error('FATAL: MONGODB_URI must be set in production.');
  }
}

export function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || WEAK_SECRETS.has(s)) {
    throw new Error('JWT_SECRET is not securely configured.');
  }
  return s;
}

export function getJwtRefreshSecret(): string {
  const s = process.env.JWT_REFRESH_SECRET;
  if (!s || WEAK_SECRETS.has(s)) {
    throw new Error('JWT_REFRESH_SECRET is not securely configured.');
  }
  return s;
}

export function getAllowedOrigins(): string[] {
  const raw = [process.env.ALLOWED_ORIGINS || '', process.env.FRONTEND_URL || '']
    .filter(Boolean)
    .join(',');
  const parsed = raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (parsed.length > 0) return Array.from(new Set(parsed));
  return process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173'];
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isValidObjectId(id: string | undefined | null): boolean {
  return !!id && mongoose.Types.ObjectId.isValid(id);
}

export function clampPagination(
  pageRaw: unknown,
  limitRaw: unknown,
  defaultLimit = 20,
  maxLimit = 100
): { page: number; limit: number; skip: number } {
  const parsedPage = Number(pageRaw);
  const parsedLimit = Number(limitRaw);
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1;
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit >= 1
      ? Math.min(Math.floor(parsedLimit), maxLimit)
      : defaultLimit;
  return { page, limit, skip: (page - 1) * limit };
}

export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeCsvCell(val: unknown): string {
  let str = val === null || val === undefined ? '' : String(val);
  // Neutralize CSV formula injection (Excel / Sheets)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export function hashSha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function getTrustedClientIp(req: Request): string {
  // Rely on Express `trust proxy` configuration rather than spoofing-prone raw X-Forwarded-For[0]
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function checkGeoFence(
  geoFence: { latitude?: number; longitude?: number; radiusMeters?: number } | null | undefined,
  latitude: unknown,
  longitude: unknown
): { allowed: boolean; distanceMeters?: number; message?: string } {
  if (!geoFence || typeof geoFence.latitude !== 'number' || typeof geoFence.longitude !== 'number') {
    return { allowed: true };
  }
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return {
      allowed: false,
      message: 'Location permission is required to mark attendance for this classroom session.',
    };
  }
  const radius = geoFence.radiusMeters && geoFence.radiusMeters > 0 ? geoFence.radiusMeters : 150;
  const dist = calculateDistanceMeters(geoFence.latitude, geoFence.longitude, lat, lng);
  if (dist > radius) {
    return {
      allowed: false,
      distanceMeters: Math.round(dist),
      message: `Outside classroom geofence (${Math.round(dist)}m away; limit ${radius}m).`,
    };
  }
  return { allowed: true, distanceMeters: Math.round(dist) };
}
