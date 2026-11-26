import { DEFAULT_QR_REFRESH_SECONDS } from '../models/SystemSettings.model';

export const QR_HANDOFF_GRACE_MS = 45_000;

export interface QrTokenState {
  qrToken: string;
  previousQrToken?: string | null;
  qrTokenRotatedAt?: Date | string | null;
}

export interface QrRefreshScheduleState {
  qrRefreshSeconds?: number | null;
  qrLastRefreshedAt?: Date | string | null;
  createdAt?: Date | string | null;
}

/**
 * Validates a scanned QR token against the session.
 * Initial scan validation should pass allowPrevious=false so expired screenshots are rejected;
 * in-progress verification (biometric/face) passes allowPrevious=true to survive rotation mid-flow.
 */
export function isValidSessionQrToken(
  session: QrTokenState,
  incomingToken: string,
  allowPrevious = false,
  nowMs = Date.now()
): boolean {
  if (!incomingToken || typeof incomingToken !== 'string') return false;
  if (incomingToken === session.qrToken) return true;
  if (!allowPrevious || !session.previousQrToken || !session.qrTokenRotatedAt) {
    return false;
  }
  if (incomingToken !== session.previousQrToken) return false;
  const rotatedAtMs = new Date(session.qrTokenRotatedAt).getTime();
  if (!Number.isFinite(rotatedAtMs)) return false;
  return nowMs - rotatedAtMs <= QR_HANDOFF_GRACE_MS;
}

export function resolveQrRefreshSeconds(value?: number | null): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 5
    ? value
    : DEFAULT_QR_REFRESH_SECONDS;
}

export function getSecondsUntilNextRefresh(
  session: QrRefreshScheduleState,
  nowMs = Date.now()
): number {
  const refreshSeconds = resolveQrRefreshSeconds(session.qrRefreshSeconds);
  const rawRef = session.qrLastRefreshedAt ?? session.createdAt;
  if (!rawRef) return refreshSeconds;
  const lastMs = new Date(rawRef).getTime();
  if (!Number.isFinite(lastMs)) return refreshSeconds;
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - lastMs) / 1000));
  return Math.max(1, refreshSeconds - elapsedSeconds);
}

export interface SessionWindowState {
  status: string;
  expiryTime: Date | string;
  gracePeriodMinutes?: number | null;
}

export function evaluateSessionWindow(
  session: SessionWindowState | null | undefined,
  nowMs = Date.now()
): { valid: boolean; isLate: boolean; effectiveExpiryMs: number; reason?: string } {
  if (!session) {
    return { valid: false, isLate: false, effectiveExpiryMs: 0, reason: 'Session not found' };
  }
  if (session.status !== 'active') {
    return {
      valid: false,
      isLate: false,
      effectiveExpiryMs: 0,
      reason: session.status === 'ended' ? 'Session was ended by teacher' : 'Session is not active',
    };
  }
  const expiryMs = new Date(session.expiryTime).getTime();
  const graceMs = Math.max(0, Number(session.gracePeriodMinutes || 0)) * 60_000;
  const effectiveExpiryMs = expiryMs + graceMs;
  if (!Number.isFinite(effectiveExpiryMs) || nowMs > effectiveExpiryMs) {
    return { valid: false, isLate: false, effectiveExpiryMs, reason: 'Session has expired' };
  }
  const isLate = nowMs > expiryMs;
  return { valid: true, isLate, effectiveExpiryMs };
}

export function isValidDynamicClassroomCode(
  session: { dynamicCode?: string | null },
  incomingCode: string
): boolean {
  if (!session.dynamicCode || !incomingCode || typeof incomingCode !== 'string') return false;
  return session.dynamicCode.trim().toUpperCase() === incomingCode.trim().toUpperCase();
}
