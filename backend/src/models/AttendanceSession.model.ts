import mongoose, { Document, Schema } from 'mongoose';

export type SessionStatus = 'active' | 'ended' | 'expired';
export type SessionType = 'class' | 'seminar' | 'workshop' | 'event' | 'lab';
export type VerificationMode = 'strict' | 'open' | 'invite';

export interface IAttendanceSession extends Document {
  _id: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  sessionCode: string;
  passwordCode?: string;
  qrToken: string;
  qrCodeData: string;
  startTime: Date;
  expiryTime: Date;
  status: SessionStatus;
  duration: number;
  totalPresent: number;
  autoCreated: boolean;
  sessionType: SessionType;
  capacity: number | null;
  verificationMode: VerificationMode;
  gracePeriodMinutes: number;
  qrRefreshSeconds: number;
  qrLastRefreshedAt: Date;
  previousQrToken?: string | null;
  qrTokenRotatedAt?: Date | null;
  coHosts: mongoose.Types.ObjectId[];
  title: string | null;
  venue: string | null;
  inviteList: string[];
  geoFence?: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSessionSchema = new Schema<IAttendanceSession>(
  {
    subjectId:    { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
    teacherId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sessionCode:  { type: String, required: true, unique: true },
    passwordCode: { type: String, default: null },
    qrToken:      { type: String, required: true, unique: true },
    qrCodeData:   { type: String, required: true },
    startTime:    { type: Date, required: true, default: Date.now },
    expiryTime:   { type: Date, required: true },
    status:       { type: String, enum: ['active', 'ended', 'expired'], default: 'active' },
    duration:     { type: Number, default: 15 },
    totalPresent: { type: Number, default: 0 },
    autoCreated:  { type: Boolean, default: false },
    sessionType: {
      type: String,
      enum: ['class', 'seminar', 'workshop', 'event', 'lab'],
      default: 'class',
    },
    capacity:           { type: Number, default: null },
    verificationMode:   { type: String, enum: ['strict', 'open', 'invite'], default: 'strict' },
    gracePeriodMinutes: { type: Number, default: 0 },
    qrRefreshSeconds:   { type: Number, default: 15 },
    qrLastRefreshedAt:  { type: Date, default: Date.now },
    previousQrToken:    { type: String, default: null },
    qrTokenRotatedAt:   { type: Date, default: null },
    coHosts:            [{ type: Schema.Types.ObjectId, ref: 'User' }],
    title:              { type: String, default: null },
    venue:              { type: String, default: null },
    inviteList:         [{ type: String }],
    geoFence: {
      latitude:     { type: Number, min: -90, max: 90 },
      longitude:    { type: Number, min: -180, max: 180 },
      radiusMeters: { type: Number, min: 10, max: 5000, default: 150 },
    },
  },
  { timestamps: true }
);

AttendanceSessionSchema.index({ subjectId: 1, teacherId: 1, status: 1 });
AttendanceSessionSchema.index({ sessionCode: 1 });

export const AttendanceSession = mongoose.model<IAttendanceSession>('AttendanceSession', AttendanceSessionSchema);
