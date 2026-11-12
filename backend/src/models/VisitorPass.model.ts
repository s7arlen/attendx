import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';

export type PassStatus = 'active' | 'used-entry' | 'used-exit' | 'expired' | 'revoked';

export interface IVisitorPass extends Document {
  _id: mongoose.Types.ObjectId;
  visitId: mongoose.Types.ObjectId;         // ref: VisitorVisit
  visitorId: mongoose.Types.ObjectId;       // ref: Visitor (denormalized for quick lookup)
  tokenHash: string;                         // SHA-256 of the raw token — stored here
  qrCodeData: string;                        // base64 PNG QR image
  passCode: string;                          // short human-readable fallback code
  status: PassStatus;
  validFrom: Date;
  validUntil: Date;
  revokedBy?: mongoose.Types.ObjectId;       // ref: User
  revokedAt?: Date;
  revocationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VisitorPassSchema = new Schema<IVisitorPass>(
  {
    visitId:            { type: Schema.Types.ObjectId, ref: 'VisitorVisit', required: true },
    visitorId:          { type: Schema.Types.ObjectId, ref: 'Visitor', required: true },
    tokenHash:          { type: String, required: true, unique: true },
    qrCodeData:         { type: String, required: true },
    passCode:           { type: String, required: true, unique: true },
    status:             { type: String, enum: ['active','used-entry','used-exit','expired','revoked'], default: 'active' },
    validFrom:          { type: Date, required: true },
    validUntil:         { type: Date, required: true },
    revokedBy:          { type: Schema.Types.ObjectId, ref: 'User' },
    revokedAt:          { type: Date },
    revocationReason:   { type: String },
  },
  { timestamps: true }
);

// Auto-expire passes via MongoDB TTL (expire 1 day after validUntil)
VisitorPassSchema.index({ validUntil: 1 }, { expireAfterSeconds: 86400 });
VisitorPassSchema.index({ visitId: 1 });
VisitorPassSchema.index({ passCode: 1 });

export const VisitorPass = mongoose.model<IVisitorPass>('VisitorPass', VisitorPassSchema);
