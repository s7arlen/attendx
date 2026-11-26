import QRCode from 'qrcode';
import crypto from 'crypto';

/** Generate a cryptographically random raw token (64 hex chars) */
export const generateVisitorToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/** SHA-256 hash of the raw token — stored in DB, never the raw token */
export const hashToken = (rawToken: string): string => {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

/** Short human-readable pass code, e.g. VIS-A3B9K2 */
export const generatePassCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return `VIS-${code}`;
};

interface VisitorQRPayload {
  passCode: string;
  token: string;
  ts: number;
}

/** Generate a QR code image (base64 PNG) encoding passCode + cryptographic token */
export const generateVisitorQRCode = async (passCode: string, rawToken: string): Promise<string> => {
  const payload: VisitorQRPayload = { passCode, token: rawToken, ts: Date.now() };
  return QRCode.toDataURL(JSON.stringify(payload), {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    width: 400,
    margin: 2,
    color: { dark: '#1e1b4b', light: '#ffffff' },
  });
};
