import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  beginRegistration,
  completeRegistration,
  beginAuthentication,
  verifyAttendanceWithBiometric,
  getBiometricStatus,
  removeCredential,
} from '../controllers/webauthn.controller';

const router = Router();
router.use(authenticate);

// Registration (students + teachers can register their device)
router.post('/register/begin',    beginRegistration);
router.post('/register/complete', completeRegistration);

// Authentication challenge (must call before verifying attendance)
router.post('/authenticate/begin', authorize('student'), beginAuthentication);

// Attendance verification via biometric
router.post('/attendance/verify', authorize('student'), verifyAttendanceWithBiometric);

// Status + management
router.get('/status',                   getBiometricStatus);
router.delete('/credential/:credentialId', removeCredential);

export default router;
