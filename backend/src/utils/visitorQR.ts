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

/** Short human-readable pass code, e.g. VIS-A3B9 */
export const generatePassCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `VIS-${code}`;
};

interface VisitorQRPayload {
  passCode: string;   // only the pass code is embedded — no personal data
  ts: number;         // creation timestamp
}

/** Generate a QR code image (base64 PNG) encoding only the passCode */
export const generateVisitorQRCode = async (passCode: string): Promise<string> => {
  const payload: VisitorQRPayload = { passCode, ts: Date.now() };
  return QRCode.toDataURL(JSON.stringify(payload), {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    width: 400,
    margin: 2,
    color: { dark: '#1e1b4b', light: '#ffffff' },
  });
};
