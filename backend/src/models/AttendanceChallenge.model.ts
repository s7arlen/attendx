import mongoose, { Document, Schema } from 'mongoose';
import type { LivenessAction } from '../utils/faceSecurity';

export interface IAttendanceChallenge extends Document {
  _id: mongoose.Types.ObjectId;
  tokenHash: string;
  studentId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  livenessActions: LivenessAction[];
  deviceId?: string | null;
  failedAttempts: number;
  used: boolean;
  expiresAt: Date;
  createdAt: Date;
}

const AttendanceChallengeSchema = new Schema<IAttendanceChallenge>(
  {
    tokenHash: { type: String, required: true, unique: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'AttendanceSession', required: true },
    livenessActions: [{ type: String, enum: ['blink', 'turn_left', 'turn_right', 'open_mouth'], required: true }],
    deviceId: { type: String, default: null },
    failedAttempts: { type: Number, default: 0 },
    used: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

AttendanceChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AttendanceChallengeSchema.index({ studentId: 1, sessionId: 1 });

export const AttendanceChallenge = mongoose.model<IAttendanceChallenge>(
  'AttendanceChallenge',
  AttendanceChallengeSchema
);
