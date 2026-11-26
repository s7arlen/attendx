import test from 'node:test';
import assert from 'node:assert/strict';

import securityMod from '../dist/utils/security.js';
import jwtMod from '../dist/utils/jwt.js';
import faceValidatorMod from '../dist/validators/facialRecognition.validators.js';

const {
  validateSecurityEnv,
  getJwtSecret,
  getJwtRefreshSecret,
  getAllowedOrigins,
  escapeRegex,
  isValidObjectId,
  clampPagination,
  escapeHtml,
  sanitizeCsvCell,
  hashSha256,
  safeEqualHex,
  calculateDistanceMeters,
  checkGeoFence,
} = securityMod;

const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = jwtMod;

const {
  registerFaceSchema,
  verifyAttendanceWithFaceSchema,
} = faceValidatorMod;

test('validateSecurityEnv fails closed with weak or missing secrets', () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevJwt = process.env.JWT_SECRET;
  const prevRefresh = process.env.JWT_REFRESH_SECRET;
  try {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'secret';
    process.env.JWT_REFRESH_SECRET = 'a'.repeat(40);
    assert.throws(() => validateSecurityEnv(), /JWT_SECRET/);

    process.env.JWT_SECRET = 'x'.repeat(40);
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';
    assert.throws(() => validateSecurityEnv(), /JWT_REFRESH_SECRET/);
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    process.env.JWT_SECRET = prevJwt;
    process.env.JWT_REFRESH_SECRET = prevRefresh;
  }
});

test('getAllowedOrigins parses comma-separated origins without trailing slashes', () => {
  const prevAllowed = process.env.ALLOWED_ORIGINS;
  const prevFrontend = process.env.FRONTEND_URL;
  try {
    process.env.ALLOWED_ORIGINS = 'https://attendxxxx.vercel.app/, https://preview.example.com';
    process.env.FRONTEND_URL = 'https://attendxxxx.vercel.app';
    assert.deepEqual(getAllowedOrigins(), [
      'https://attendxxxx.vercel.app',
      'https://preview.example.com',
    ]);
  } finally {
    process.env.ALLOWED_ORIGINS = prevAllowed;
    process.env.FRONTEND_URL = prevFrontend;
  }
});

test('escapeRegex and isValidObjectId guard database queries', () => {
  assert.equal(escapeRegex('cs.*(101)+?'), 'cs\\.\\*\\(101\\)\\+\\?');
  assert.equal(isValidObjectId('507f1f77bcf86cd799439011'), true);
  assert.equal(isValidObjectId('not-an-id'), false);
  assert.equal(isValidObjectId(''), false);
});

test('clampPagination bounds page and limit cleanly', () => {
  assert.deepEqual(clampPagination('-5', '9999'), { page: 1, limit: 100, skip: 0 });
  assert.deepEqual(clampPagination('3', '25'), { page: 3, limit: 25, skip: 50 });
});

test('escapeHtml and sanitizeCsvCell prevent XSS and CSV formula injection', () => {
  assert.equal(escapeHtml('<script>"test" & \'x\'</script>'), '&lt;script&gt;&quot;test&quot; &amp; &#39;x&#39;&lt;/script&gt;');
  assert.equal(sanitizeCsvCell('=CMD("calc")'), `"'=CMD(""calc"")"`);
  assert.equal(sanitizeCsvCell('+1+2'), `"'` + `+1+2"`);
  assert.equal(sanitizeCsvCell('Alice'), '"Alice"');
});

test('hashSha256 and safeEqualHex verify fixed-length hashes in constant time', () => {
  const digest = hashSha256('123456');
  assert.equal(digest.length, 64);
  assert.equal(safeEqualHex(digest, hashSha256('123456')), true);
  assert.equal(safeEqualHex(digest, hashSha256('654321')), false);
});

test('checkGeoFence enforces radius when configured and allows when unset', () => {
  assert.deepEqual(checkGeoFence(null, undefined, undefined), { allowed: true });

  const classroom = { latitude: 12.9716, longitude: 77.5946, radiusMeters: 150 };
  const missing = checkGeoFence(classroom, undefined, undefined);
  assert.equal(missing.allowed, false);

  const nearby = checkGeoFence(classroom, 12.9717, 77.5947);
  assert.equal(nearby.allowed, true);
  assert.ok((nearby.distanceMeters ?? 999) < 30);

  const far = checkGeoFence(classroom, 13.05, 77.7);
  assert.equal(far.allowed, false);
  assert.ok(calculateDistanceMeters(12.9716, 77.5946, 13.05, 77.7) > 10000);
});

test('JWT signing and verification reject unset secrets', () => {
  const prevJwt = process.env.JWT_SECRET;
  const prevRefresh = process.env.JWT_REFRESH_SECRET;
  try {
    process.env.JWT_SECRET = 'test_jwt_secret_minimum_thirty_two_chars_long';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_minimum_thirty_two_chars';
    assert.equal(getJwtSecret().length >= 32, true);
    assert.equal(getJwtRefreshSecret().length >= 32, true);

    const access = generateAccessToken({ userId: 'u1', role: 'student', email: 's@attendx.edu' });
    assert.ok(access.split('.').length === 3);
    const refresh = generateRefreshToken({ userId: 'u1', role: 'student', email: 's@attendx.edu' });
    const decoded = verifyRefreshToken(refresh);
    assert.equal(decoded.userId, 'u1');
    assert.equal(decoded.role, 'student');
    assert.throws(() => verifyRefreshToken(`${refresh}tampered`));
  } finally {
    process.env.JWT_SECRET = prevJwt;
    process.env.JWT_REFRESH_SECRET = prevRefresh;
  }
});

test('facial recognition validators check 128 finite floats and optional geo bounds', () => {
  const validDesc = Array.from({ length: 128 }, (_, i) => i * 0.01);
  assert.equal(registerFaceSchema.safeParse({ faceDescriptor: validDesc }).success, true);
  assert.equal(registerFaceSchema.safeParse({ faceDescriptor: [1, 2, 3] }).success, false);
  assert.equal(
    verifyAttendanceWithFaceSchema.safeParse({
      sessionId: '507f1f77bcf86cd799439011',
      secureToken: 'tok',
      faceDescriptor: validDesc,
      latitude: 12.97,
      longitude: 77.59,
    }).success,
    true
  );
  assert.equal(
    verifyAttendanceWithFaceSchema.safeParse({
      sessionId: '507f1f77bcf86cd799439011',
      secureToken: 'tok',
      faceDescriptor: validDesc,
      latitude: 120,
    }).success,
    false
  );
});
