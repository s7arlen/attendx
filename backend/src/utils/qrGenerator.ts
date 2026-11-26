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

export const generateDynamicCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return code;
};

export const generateProjectorSecret = (): string => {
  return crypto.randomBytes(24).toString('hex');
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
  const dynamicCode = generateDynamicCode();
  const projectorSecret = generateProjectorSecret();

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
    dynamicCode,
    projectorSecret,
    qrCodeData,
    qrPayload,
  };
};

/**
 * Regenerate only the secure token, rotating classroom code + QR image for an existing session.
 * Called every N seconds to invalidate old QR screenshots and shared codes.
 */
export const generateFreshQR = async (
  sessionId: string,
  subjectId: string
): Promise<{ secureToken: string; dynamicCode: string; qrCodeData: string }> => {
  const secureToken = generateSecureToken();
  const dynamicCode = generateDynamicCode();

  const qrPayload: QRPayload = {
    sessionId,
    subjectId,
    timestamp: Date.now(),
    secureToken,
  };

  const qrCodeData = await generateQRCode(qrPayload);
  return { secureToken, dynamicCode, qrCodeData };
};
