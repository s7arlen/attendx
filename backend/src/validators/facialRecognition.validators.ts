/**
 * Validation schemas for facial recognition endpoints
 */

import { z } from 'zod';

const descriptorSchema = z
  .array(z.number().finite())
  .length(128, 'Face descriptor must contain exactly 128 finite numbers');

const livenessActionSchema = z.enum(['blink', 'turn_left', 'turn_right', 'open_mouth']);

export const livenessFrameSchema = z.object({
  phase: z.union([z.literal('baseline'), livenessActionSchema]),
  ear: z.number().finite().min(0).max(2),
  mar: z.number().finite().min(0).max(3),
  yawRatio: z.number().finite().min(-2).max(3),
  timestampMs: z.number().finite(),
  descriptor: descriptorSchema,
  snapshotBase64: z.string().min(100).max(600_000),
});

export const livenessProofSchema = z.object({
  frames: z.array(livenessFrameSchema).min(2).max(5),
  totalDurationMs: z.number().finite().min(0).max(120_000),
});

export const registerFaceSchema = z.object({
  faceDescriptor: descriptorSchema.optional(),
  livenessProof: livenessProofSchema,
});

export const verifyAttendanceWithFaceSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  challengeToken: z.string().min(16, 'Challenge token is required'),
  livenessProof: livenessProofSchema,
  subjectId: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  deviceId: z.string().max(128).optional(),
});

export const retryFaceChallengeSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  challengeToken: z.string().min(16, 'Challenge token is required'),
});

export type RegisterFaceInput = z.infer<typeof registerFaceSchema>;
export type VerifyAttendanceWithFaceInput = z.infer<typeof verifyAttendanceWithFaceSchema>;
