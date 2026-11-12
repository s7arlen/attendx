import mongoose, { Document, Schema } from 'mongoose';

export type LogAction = 'entry' | 'exit' | 'denied' | 'duplicate';

export interface IVisitorLog extends Document {
  _id: mongoose.Types.ObjectId;
  visitId: mongoose.Types.ObjectId;         // ref: VisitorVisit
  visitorId: mongoose.Types.ObjectId;       // ref: Visitor
  passId?: mongoose.Types.ObjectId;         // ref: VisitorPass
  action: LogAction;
  timestamp: Date;
  gateOperatorId: mongoose.Types.ObjectId;  // ref: User (security/admin who scanned)
  scanMethod: 'qr' | 'manual';
  ipAddress?: string;
  deviceInfo?: string;
  notes?: string;
  denied_reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VisitorLogSchema = new Schema<IVisitorLog>(
  {
    visitId:        { type: Schema.Types.ObjectId, ref: 'VisitorVisit', required: true },
    visitorId:      { type: Schema.Types.ObjectId, ref: 'Visitor', required: true },
    passId:         { type: Schema.Types.ObjectId, ref: 'VisitorPass' },
    action:         { type: String, enum: ['entry', 'exit', 'denied', 'duplicate'], required: true },
    timestamp:      { type: Date, required: true, default: Date.now },
    gateOperatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    scanMethod:     { type: String, enum: ['qr', 'manual'], required: true },
    ipAddress:      { type: String },
    deviceInfo:     { type: String },
    notes:          { type: String },
    denied_reason:  { type: String },
  },
  { timestamps: true }
);

// TTL — keep logs for 1 year
VisitorLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });
VisitorLogSchema.index({ visitId: 1, action: 1 });
VisitorLogSchema.index({ timestamp: -1 });
VisitorLogSchema.index({ visitorId: 1 });

export const VisitorLog = mongoose.model<IVisitorLog>('VisitorLog', VisitorLogSchema);
