import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

interface QRPayload {
  sessionId: string;
  subjectId: string;
  timestamp: number;
  secureToken: string;
}

export const generateSecureToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const generateSessionCode = (subjectCode: string): string => {
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${subjectCode}-${randomPart}`;
};

export const generatePasswordCode = (subjectCode: string): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let password = '';
  for (let i = 0; i < 4; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${subjectCode}-${password}`;
};

export const generateQRCode = async (payload: QRPayload): Promise<string> => {
  const qrData = JSON.stringify(payload);
  const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    width: 400,
    margin: 2,
    color: {
      dark: '#1e1b4b',
      light: '#ffffff',
    },
  });
  return qrCodeDataUrl;
};

export const generateSessionAssets = async (
  sessionId: string,
  subjectId: string,
  subjectCode: string
) => {
  const secureToken = generateSecureToken();
  const passwordCode = generatePasswordCode(subjectCode);
  const sessionCode = generateSessionCode(subjectCode);

  const qrPayload: QRPayload = {
    sessionId,
    subjectId,
    timestamp: Date.now(),
    secureToken,
  };

  const qrCodeData = await generateQRCode(qrPayload);

  return {
    secureToken,
    passwordCode,
    sessionCode,
    qrCodeData,
    qrPayload,
  };
};

/**
 * Regenerate only the secure token + QR image for an existing session.
 * Called every 20 seconds to invalidate old QR screenshots.
 */
export const generateFreshQR = async (
  sessionId: string,
  subjectId: string
): Promise<{ secureToken: string; qrCodeData: string }> => {
  const secureToken = generateSecureToken();

  const qrPayload: QRPayload = {
    sessionId,
    subjectId,
    timestamp: Date.now(),
    secureToken,
  };

  const qrCodeData = await generateQRCode(qrPayload);
  return { secureToken, qrCodeData };
};
