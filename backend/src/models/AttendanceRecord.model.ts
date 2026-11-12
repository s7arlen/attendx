import mongoose, { Document, Schema } from 'mongoose';

export type VerificationStatus = 'verified' | 'pending' | 'rejected';

export interface IAttendanceRecord extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  timestamp: Date;
  verificationStatus: VerificationStatus;
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
    ipAddress: { type: String },
    deviceInfo: { type: String },
  },
  { timestamps: true }
);

// Prevent duplicate attendance per session
AttendanceRecordSchema.index({ studentId: 1, sessionId: 1 }, { unique: true });

export const AttendanceRecord = mongoose.model<IAttendanceRecord>('AttendanceRecord', AttendanceRecordSchema);
