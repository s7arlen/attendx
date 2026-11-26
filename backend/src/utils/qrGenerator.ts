import QRCode from 'qrcode';
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
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomPart = '';
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return `${subjectCode}-${randomPart}`;
};

export const generateQRCode = async (payload: QRPayload): Promise<string> => {
  const qrData = JSON.stringify(payload);
  return QRCode.toDataURL(qrData, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    width: 400,
    margin: 2,
    color: {
      dark: '#1e1b4b',
      light: '#ffffff',
    },
  });
};

export const generateSessionAssets = async (
  sessionId: string,
  subjectId: string,
  subjectCode: string
) => {
  const secureToken = generateSecureToken();
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
    sessionCode,
    qrCodeData,
    qrPayload,
  };
};

/**
 * Regenerate only the secure token + QR image for an existing session.
 * Called every N seconds to invalidate old QR screenshots.
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
