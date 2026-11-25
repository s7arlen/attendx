import mongoose, { Document, Schema } from 'mongoose';

export type VerificationStatus = 'verified' | 'pending' | 'rejected';
export type VerificationMethod = 'qr' | 'password' | 'biometric' | 'offline_sync' | 'manual';

export interface IAttendanceRecord extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  timestamp: Date;
  verificationStatus: VerificationStatus;
  verificationMethod: VerificationMethod;
  isLate: boolean;
  ipAddress?: string;
  deviceInfo?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceRecordSchema = new Schema<IAttendanceRecord>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'AttendanceSession', required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    verificationStatus: {
      type: String,
      enum: ['verified', 'pending', 'rejected'],
      default: 'verified',
    },
    verificationMethod: {
      type: String,
      enum: ['qr', 'password', 'biometric', 'offline_sync', 'manual'],
      default: 'password',
    },
    isLate: { type: Boolean, default: false },
    ipAddress: { type: String },
    deviceInfo: { type: String },
  },
  { timestamps: true }
);

// Prevent duplicate attendance per session
AttendanceRecordSchema.index({ studentId: 1, sessionId: 1 }, { unique: true });

export const AttendanceRecord = mongoose.model<IAttendanceRecord>('AttendanceRecord', AttendanceRecordSchema);
