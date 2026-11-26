/**
 * Validation schemas for facial recognition endpoints
 */

import { z } from 'zod';

export const registerFaceSchema = z.object({
  faceDescriptor: z
    .array(z.number().finite())
    .length(128, 'Face descriptor must contain exactly 128 finite numbers'),
});

export const verifyAttendanceWithFaceSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  secureToken: z.string().min(1, 'Secure token is required'),
  faceDescriptor: z
    .array(z.number().finite())
    .length(128, 'Face descriptor must contain exactly 128 finite numbers'),
  subjectId: z.string().optional(),
});

export type RegisterFaceInput = z.infer<typeof registerFaceSchema>;
export type VerifyAttendanceWithFaceInput = z.infer<typeof verifyAttendanceWithFaceSchema>;
