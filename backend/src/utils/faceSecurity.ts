import crypto from 'crypto';
import { hashSha256 } from './security';

export type LivenessAction = 'blink' | 'turn_left' | 'turn_right' | 'open_mouth';

export interface LivenessFrameTelemetry {
  phase: 'baseline' | LivenessAction;
  ear: number;
  mar: number;
  yawRatio: number;
  timestampMs: number;
  descriptor: number[];
  snapshotBase64: string;
}

export interface LivenessProof {
  frames: LivenessFrameTelemetry[];
  totalDurationMs: number;
}

export const ALL_LIVENESS_ACTIONS: LivenessAction[] = ['blink', 'turn_left', 'turn_right', 'open_mouth'];

/**
 * Pick 2 randomized liveness challenges: 1 facial expression + 1 head turn, in shuffled order.
 */
export function pickLivenessActions(): LivenessAction[] {
  const expressionActions: LivenessAction[] = ['blink', 'open_mouth'];
  const poseActions: LivenessAction[] = ['turn_left', 'turn_right'];

  const expr = expressionActions[crypto.randomInt(0, expressionActions.length)];
  const pose = poseActions[crypto.randomInt(0, poseActions.length)];

  return crypto.randomInt(0, 2) === 0 ? [expr, pose] : [pose, expr];
}

export function isValidDescriptor(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === 128 &&
    value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
  );
}

export function calculateEuclideanDistance(d1: number[], d2: number[]): number {
  if (d1.length !== d2.length) {
    throw new Error('Descriptors must have the same length');
  }
  let sumSq = 0;
  for (let i = 0; i < d1.length; i++) {
    const diff = d1[i] - d2[i];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq);
}

export function descriptorHash(descriptor: number[]): string {
  const quantized = descriptor.map((v) => v.toFixed(4)).join(',');
  return hashSha256(quantized);
}

export function validateJpegDataUrl(dataUrl: string): { valid: boolean; sha256?: string; reason?: string } {
  if (typeof dataUrl !== 'string') {
    return { valid: false, reason: 'Snapshot must be a base64 data URL' };
  }
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) {
    return { valid: false, reason: 'Snapshot must be a valid JPEG data URL' };
  }
  const buf = Buffer.from(match[1], 'base64');
  if (buf.length < 500 || buf.length > 400 * 1024) {
    return { valid: false, reason: 'Snapshot size out of allowed bounds' };
  }
  if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
    return { valid: false, reason: 'Invalid JPEG file signature' };
  }
  return { valid: true, sha256: crypto.createHash('sha256').update(buf).digest('hex') };
}

export function verifyLivenessProof(
  expectedActions: LivenessAction[],
  proof: LivenessProof
): {
  valid: boolean;
  reason?: string;
  primaryDescriptor?: number[];
  snapshotHashes?: string[];
} {
  if (!proof || !Array.isArray(proof.frames)) {
    return { valid: false, reason: 'Missing liveness frames' };
  }
  if (!Number.isFinite(proof.totalDurationMs) || proof.totalDurationMs < 600 || proof.totalDurationMs > 90_000) {
    return { valid: false, reason: 'Liveness capture duration outside valid human bounds' };
  }
  if (proof.frames.length !== expectedActions.length + 1) {
    return { valid: false, reason: 'Incomplete liveness challenge sequence' };
  }

  const baseline = proof.frames[0];
  if (!baseline || baseline.phase !== 'baseline') {
    return { valid: false, reason: 'Missing baseline neutral frame' };
  }

  const snapshotHashes: string[] = [];
  for (let i = 0; i < proof.frames.length; i++) {
    const frame = proof.frames[i];
    const expectedPhase = i === 0 ? 'baseline' : expectedActions[i - 1];
    if (frame.phase !== expectedPhase) {
      return { valid: false, reason: `Expected liveness step "${expectedPhase}", got "${frame.phase}"` };
    }
    if (!isValidDescriptor(frame.descriptor)) {
      return { valid: false, reason: 'Invalid face descriptor in liveness frame' };
    }
    if (
      !Number.isFinite(frame.ear) ||
      !Number.isFinite(frame.mar) ||
      !Number.isFinite(frame.yawRatio) ||
      !Number.isFinite(frame.timestampMs)
    ) {
      return { valid: false, reason: 'Invalid facial landmark telemetry' };
    }
    if (i > 0 && frame.timestampMs - proof.frames[i - 1].timestampMs < 150) {
      return { valid: false, reason: 'Liveness frames captured too rapidly' };
    }
    const snap = validateJpegDataUrl(frame.snapshotBase64);
    if (!snap.valid || !snap.sha256) {
      return { valid: false, reason: snap.reason || 'Invalid snapshot frame' };
    }
    snapshotHashes.push(snap.sha256);

    if (i > 0) {
      const stepDistPrev = calculateEuclideanDistance(frame.descriptor, proof.frames[i - 1].descriptor);
      if (stepDistPrev < 0.004) {
        return { valid: false, reason: 'Static image or replayed descriptor detected between frames' };
      }
      const distFromBaseline = calculateEuclideanDistance(frame.descriptor, baseline.descriptor);
      if (distFromBaseline > 0.48) {
        return { valid: false, reason: 'Face mismatch detected across liveness challenge steps' };
      }
    }
  }

  if (new Set(snapshotHashes).size !== snapshotHashes.length) {
    return { valid: false, reason: 'Duplicate image frames detected during liveness check' };
  }

  // Verify kinematics of each challenge step against baseline
  for (let i = 1; i < proof.frames.length; i++) {
    const frame = proof.frames[i];
    switch (frame.phase) {
      case 'blink': {
        const earDrop = baseline.ear - frame.ear;
        if (!(frame.ear <= 0.21 && (earDrop >= 0.03 || frame.ear <= 0.17))) {
          return { valid: false, reason: 'Blink challenge not satisfied' };
        }
        break;
      }
      case 'open_mouth': {
        const marRise = frame.mar - baseline.mar;
        if (!(frame.mar >= 0.36 && marRise >= 0.10)) {
          return { valid: false, reason: 'Mouth-open challenge not satisfied' };
        }
        break;
      }
      case 'turn_left': {
        if (frame.yawRatio - baseline.yawRatio < 0.07) {
          return { valid: false, reason: 'Turn-left head movement not satisfied' };
        }
        break;
      }
      case 'turn_right': {
        if (baseline.yawRatio - frame.yawRatio < 0.07) {
          return { valid: false, reason: 'Turn-right head movement not satisfied' };
        }
        break;
      }
      default:
        return { valid: false, reason: 'Unsupported liveness action' };
    }
  }

  return {
    valid: true,
    primaryDescriptor: baseline.descriptor,
    snapshotHashes,
  };
}

export function evaluateFaceMatch(
  liveDescriptor: number[],
  storedDescriptor: number[],
  recentHashes: string[] = []
): {
  matched: boolean;
  distance: number;
  similarity: number;
  isReplay: boolean;
  liveHash: string;
} {
  const distance = calculateEuclideanDistance(liveDescriptor, storedDescriptor);
  const liveHash = descriptorHash(liveDescriptor);
  const isReplay = distance < 0.004 || recentHashes.includes(liveHash);

  const threshold = parseFloat(process.env.FACE_SIMILARITY_THRESHOLD || '0.65');
  // Calibrated on 128-D ResNet embeddings: 0.65 similarity corresponds to distance <= 0.42 (capped at 0.48)
  const similarity = Math.max(0, Math.min(1, 1 - distance / 1.2));
  const maxAllowedDistance = parseFloat(process.env.FACE_MAX_DISTANCE || '0.45');

  const matched = !isReplay && similarity >= threshold && distance <= maxAllowedDistance;
  return { matched, distance, similarity, isReplay, liveHash };
}
