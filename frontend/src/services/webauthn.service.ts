import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';
import api from '@/lib/axios';

export const webauthnService = {
  /** Check if this browser + device supports biometrics */
  isSupported: () => browserSupportsWebAuthn(),

  /** Check if a platform authenticator (Touch ID / Face ID / Windows Hello) is available */
  isPlatformAvailable: () => platformAuthenticatorIsAvailable(),

  /** Check whether the current user has any credentials registered */
  getStatus: async () => {
    const res = await api.get('/auth/webauthn/status');
    return res.data.data as { registered: boolean; count: number; devices: { credentialId: string; deviceType: string; registeredAt: string }[] };
  },

  /** Register this device's biometric with the server */
  registerDevice: async (): Promise<void> => {
    // 1. Get challenge from server
    const beginRes = await api.post('/auth/webauthn/register/begin');
    const options = beginRes.data.data;

    // 2. Trigger the browser biometric prompt
    const credential = await startRegistration(options);

    // 3. Send response to server to complete registration
    await api.post('/auth/webauthn/register/complete', credential);
  },

  /** Get an authentication challenge from the server */
  beginAuthentication: async () => {
    const res = await api.post('/auth/webauthn/authenticate/begin');
    return res.data.data;
  },

  /** Verify attendance using biometric (replaces password) */
  verifyAttendanceWithBiometric: async (params: {
    sessionId:   string;
    subjectId:   string;
    secureToken: string;
  }) => {
    // 1. Get a challenge tied to this student
    const options = await webauthnService.beginAuthentication();

    // 2. Trigger Touch ID / Face ID — throws if user cancels or fails
    const assertion = await startAuthentication(options);

    // 3. Send assertion + session data to server
    const res = await api.post('/auth/webauthn/attendance/verify', {
      ...params,
      assertion,
    });
    return res.data;
  },

  /** Remove a registered biometric credential */
  removeCredential: async (credentialId: string) => {
    await api.delete(`/auth/webauthn/credential/${credentialId}`);
  },
};
