import mongoose, { Document, Schema } from 'mongoose';

export type VisitStatus = 'pending' | 'approved' | 'rejected' | 'checked-in' | 'checked-out' | 'expired' | 'cancelled';

export interface IVisitorVisit extends Document {
  _id: mongoose.Types.ObjectId;
  visitorId: mongoose.Types.ObjectId;       // ref: Visitor
  hostId: mongoose.Types.ObjectId;           // ref: User (teacher/admin being visited)
  registeredBy: mongoose.Types.ObjectId;     // ref: User (admin or security who registered)
  visitType: 'pre-registered' | 'walk-in';

  // Visit details
  purpose: string;
  department: string;
  visitDate: Date;
  expectedArrival: string;    // HH:MM
  expectedDeparture: string;  // HH:MM
  accompanyingCount: number;

  // Status & approval
  status: VisitStatus;
  approvedBy?: mongoose.Types.ObjectId;      // ref: User
  approvedAt?: Date;
  rejectedBy?: mongoose.Types.ObjectId;      // ref: User
  rejectedAt?: Date;
  rejectionReason?: string;

  // Event link (optional)
  eventId?: mongoose.Types.ObjectId;         // ref: VisitorEvent

  // Check-in/out (populated by VisitorLog)
  checkedInAt?: Date;
  checkedOutAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const VisitorVisitSchema = new Schema<IVisitorVisit>(
  {
    visitorId:          { type: Schema.Types.ObjectId, ref: 'Visitor', required: true },
    hostId:             { type: Schema.Types.ObjectId, ref: 'User', required: true },
    registeredBy:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    visitType:          { type: String, enum: ['pre-registered', 'walk-in'], required: true },
    purpose:            { type: String, required: true, trim: true },
    department:         { type: String, required: true, trim: true },
    visitDate:          { type: Date, required: true },
    expectedArrival:    { type: String, required: true },
    expectedDeparture:  { type: String, required: true },
    accompanyingCount:  { type: Number, default: 0, min: 0 },
    status:             { type: String, enum: ['pending','approved','rejected','checked-in','checked-out','expired','cancelled'], default: 'pending' },
    approvedBy:         { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt:         { type: Date },
    rejectedBy:         { type: Schema.Types.ObjectId, ref: 'User' },
    rejectedAt:         { type: Date },
    rejectionReason:    { type: String },
    eventId:            { type: Schema.Types.ObjectId, ref: 'VisitorEvent' },
    checkedInAt:        { type: Date },
    checkedOutAt:       { type: Date },
  },
  { timestamps: true }
);

VisitorVisitSchema.index({ visitorId: 1 });
VisitorVisitSchema.index({ hostId: 1, status: 1 });
VisitorVisitSchema.index({ status: 1, visitDate: 1 });
VisitorVisitSchema.index({ visitDate: 1 });

export const VisitorVisit = mongoose.model<IVisitorVisit>('VisitorVisit', VisitorVisitSchema);
