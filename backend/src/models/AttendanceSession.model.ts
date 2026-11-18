import mongoose, { Document, Schema } from 'mongoose';

export type SessionStatus = 'active' | 'ended' | 'expired';

export interface IAttendanceSession extends Document {
  _id: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  sessionCode: string;
  qrToken: string;
  qrCodeData: string;
  passwordCode: string;
  startTime: Date;
  expiryTime: Date;
  status: SessionStatus;
  duration: number;
  totalPresent: number;
  autoCreated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSessionSchema = new Schema<IAttendanceSession>(
  {
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sessionCode: { type: String, required: true, unique: true },
    qrToken: { type: String, required: true, unique: true },
    qrCodeData: { type: String, required: true },
    passwordCode: { type: String, required: true },
    startTime: { type: Date, required: true, default: Date.now },
    expiryTime: { type: Date, required: true },
    status: { type: String, enum: ['active', 'ended', 'expired'], default: 'active' },
    duration: { type: Number, default: 15 },
    totalPresent: { type: Number, default: 0 },
    autoCreated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Index for fast query by status and teacher/subject
AttendanceSessionSchema.index({ subjectId: 1, teacherId: 1, status: 1 });

export const AttendanceSession = mongoose.model<IAttendanceSession>('AttendanceSession', AttendanceSessionSchema);
