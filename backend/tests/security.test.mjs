import test from 'node:test';
import assert from 'node:assert/strict';

import securityMod from '../dist/utils/security.js';
import jwtMod from '../dist/utils/jwt.js';
import faceValidatorMod from '../dist/validators/facialRecognition.validators.js';
import authRoutesMod from '../dist/routes/auth.routes.js';
import adminRoutesMod from '../dist/routes/admin.routes.js';
import qrSessionMod from '../dist/utils/qrSession.js';
import qrGenMod from '../dist/utils/qrGenerator.js';
import faceSecMod from '../dist/utils/faceSecurity.js';

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

const {
  isValidSessionQrToken,
  getSecondsUntilNextRefresh,
  resolveQrRefreshSeconds,
  evaluateSessionWindow,
  isValidDynamicClassroomCode,
  QR_HANDOFF_GRACE_MS,
} = qrSessionMod;

const {
  generateDynamicCode,
  generateProjectorSecret,
} = qrGenMod;

const {
  verifyLivenessProof,
  evaluateFaceMatch,
} = faceSecMod;

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

test('facial recognition validators check liveness proof structure and optional geo bounds', () => {
  const validDesc = Array.from({ length: 128 }, (_, i) => i * 0.01);
  const fakeJpeg = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(600, 1)]).toString('base64');
  const validProof = {
    totalDurationMs: 2500,
    frames: [
      { phase: 'baseline', ear: 0.3, mar: 0.2, yawRatio: 0.5, timestampMs: 1000, descriptor: validDesc, snapshotBase64: fakeJpeg },
      { phase: 'blink', ear: 0.14, mar: 0.2, yawRatio: 0.51, timestampMs: 2000, descriptor: validDesc.map((v, i) => i === 0 ? v + 0.05 : v), snapshotBase64: fakeJpeg },
    ],
  };
  assert.equal(registerFaceSchema.safeParse({ livenessProof: validProof }).success, true);
  assert.equal(registerFaceSchema.safeParse({ livenessProof: { frames: [], totalDurationMs: 100 } }).success, false);
  assert.equal(
    verifyAttendanceWithFaceSchema.safeParse({
      sessionId: '507f1f77bcf86cd799439011',
      challengeToken: 'c'.repeat(32),
      livenessProof: validProof,
      latitude: 12.97,
      longitude: 77.59,
    }).success,
    true
  );
  assert.equal(
    verifyAttendanceWithFaceSchema.safeParse({
      sessionId: '507f1f77bcf86cd799439011',
      challengeToken: 'c'.repeat(32),
      livenessProof: validProof,
      latitude: 120,
    }).success,
    false
  );
});

test('auth routes wire email verification endpoints', () => {
  const router = authRoutesMod.default;
  const paths = router.stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route.methods)[0]?.toUpperCase()} ${layer.route.path}`);

  assert.ok(paths.includes('POST /send-verification'));
  assert.ok(paths.includes('POST /verify-email'));
});

test('admin routes wire QR settings endpoints', () => {
  const router = adminRoutesMod.default;
  const paths = router.stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route.methods)[0]?.toUpperCase()} ${layer.route.path}`);

  assert.ok(paths.includes('GET /settings'));
  assert.ok(paths.includes('PUT /settings'));
});

test('isValidSessionQrToken enforces strict initial scan and 45s handoff grace for verification', () => {
  const now = 1_700_000_000_000;
  const session = {
    qrToken: 'new-token',
    previousQrToken: 'old-token',
    qrTokenRotatedAt: new Date(now - 20_000),
  };

  // Current token always passes
  assert.equal(isValidSessionQrToken(session, 'new-token', false, now), true);
  assert.equal(isValidSessionQrToken(session, 'new-token', true, now), true);

  // Previous token rejected on initial QR scan (allowPrevious = false)
  assert.equal(isValidSessionQrToken(session, 'old-token', false, now), false);

  // Previous token accepted within grace window during in-progress biometric/face verification
  assert.equal(isValidSessionQrToken(session, 'old-token', true, now), true);

  // Previous token expired after grace window
  assert.equal(
    isValidSessionQrToken(session, 'old-token', true, now + QR_HANDOFF_GRACE_MS + 1000),
    false
  );
  assert.equal(isValidSessionQrToken(session, 'wrong-token', true, now), false);
});

test('QR refresh defaults to 15s and computes remaining countdown', () => {
  assert.equal(resolveQrRefreshSeconds(undefined), 15);
  assert.equal(resolveQrRefreshSeconds(15), 15);
  assert.equal(resolveQrRefreshSeconds(30), 30);

  const now = 1_700_000_010_000;
  assert.equal(
    getSecondsUntilNextRefresh({ qrRefreshSeconds: 15, qrLastRefreshedAt: new Date(now - 4_000) }, now),
    11
  );
});

test('evaluateSessionWindow strictly enforces active status and grace period', () => {
  const now = 1_700_000_000_000;
  const active = { status: 'active', expiryTime: new Date(now + 60_000), gracePeriodMinutes: 5 };
  assert.deepEqual(evaluateSessionWindow(active, now).valid, true);
  assert.deepEqual(evaluateSessionWindow(active, now).isLate, false);

  // Grace period window
  const grace = evaluateSessionWindow(active, now + 120_000);
  assert.equal(grace.valid, true);
  assert.equal(grace.isLate, true);

  // Ended early by teacher MUST be rejected even before expiryTime
  const endedEarly = { status: 'ended', expiryTime: new Date(now + 60_000), gracePeriodMinutes: 5 };
  assert.equal(evaluateSessionWindow(endedEarly, now).valid, false);

  // Expired past grace period MUST be rejected even if status cron has not run yet
  assert.equal(evaluateSessionWindow(active, now + 400_000).valid, false);
});

test('dynamic classroom code and projector secret generation + strict matching', () => {
  const code = generateDynamicCode();
  const secret = generateProjectorSecret();
  assert.equal(code.length, 6);
  assert.equal(secret.length, 48);
  assert.equal(isValidDynamicClassroomCode({ dynamicCode: code }, code.toLowerCase()), true);
  assert.equal(isValidDynamicClassroomCode({ dynamicCode: code }, 'WRONG1'), false);
});

test('verifyLivenessProof accepts genuine blink+turn sequence and rejects replays, duplicates, and static photos', () => {
  const mkJpeg = (fillByte) =>
    'data:image/jpeg;base64,' +
    Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(700, fillByte)]).toString('base64');

  const baseDesc = Array.from({ length: 128 }, (_, i) => (i % 7) * 0.03);
  const blinkDesc = baseDesc.map((v, i) => (i === 0 ? v + 0.06 : v));
  const turnDesc = baseDesc.map((v, i) => (i === 1 ? v + 0.08 : v));

  const validProof = {
    totalDurationMs: 2800,
    frames: [
      { phase: 'baseline', ear: 0.30, mar: 0.18, yawRatio: 0.50, timestampMs: 1000, descriptor: baseDesc, snapshotBase64: mkJpeg(1) },
      { phase: 'blink', ear: 0.14, mar: 0.19, yawRatio: 0.51, timestampMs: 2100, descriptor: blinkDesc, snapshotBase64: mkJpeg(2) },
      { phase: 'turn_left', ear: 0.29, mar: 0.18, yawRatio: 0.62, timestampMs: 3200, descriptor: turnDesc, snapshotBase64: mkJpeg(3) },
    ],
  };

  const ok = verifyLivenessProof(['blink', 'turn_left'], validProof);
  assert.equal(ok.valid, true);
  assert.ok(ok.primaryDescriptor);

  // Reject identical descriptor replay (static photo/API replay)
  const staticReplay = {
    ...validProof,
    frames: [
      validProof.frames[0],
      { ...validProof.frames[1], descriptor: baseDesc },
      validProof.frames[2],
    ],
  };
  assert.equal(verifyLivenessProof(['blink', 'turn_left'], staticReplay).valid, false);

  // Reject identical JPEG bytes
  const duplicateImage = {
    ...validProof,
    frames: [
      validProof.frames[0],
      { ...validProof.frames[1], snapshotBase64: validProof.frames[0].snapshotBase64 },
      validProof.frames[2],
    ],
  };
  assert.equal(verifyLivenessProof(['blink', 'turn_left'], duplicateImage).valid, false);

  // Reject wrong head turn direction
  const wrongTurn = {
    ...validProof,
    frames: [
      validProof.frames[0],
      validProof.frames[1],
      { ...validProof.frames[2], yawRatio: 0.35 },
    ],
  };
  assert.equal(verifyLivenessProof(['blink', 'turn_left'], wrongTurn).valid, false);
});

test('evaluateFaceMatch enforces similarity threshold and rejects replayed vectors', () => {
  const enrolled = Array.from({ length: 128 }, () => 0.1);
  const genuineLive = enrolled.map((v, i) => (i < 4 ? v + 0.1 : v)); // dist = 0.2
  const imposter = enrolled.map((v, i) => (i < 36 ? v + 0.15 : v)); // dist = 0.9

  const liveMatch = evaluateFaceMatch(genuineLive, enrolled, []);
  assert.equal(liveMatch.matched, true);
  assert.equal(liveMatch.isReplay, false);

  // Replaying exact same live vector again must be blocked
  const replay = evaluateFaceMatch(genuineLive, enrolled, [liveMatch.liveHash]);
  assert.equal(replay.matched, false);
  assert.equal(replay.isReplay, true);

  // Replaying exact enrolled vector must be blocked
  const enrolledReplay = evaluateFaceMatch(enrolled, enrolled, []);
  assert.equal(enrolledReplay.matched, false);
  assert.equal(enrolledReplay.isReplay, true);

  // Different face must fail
  const diff = evaluateFaceMatch(imposter, enrolled, []);
  assert.equal(diff.matched, false);
});
