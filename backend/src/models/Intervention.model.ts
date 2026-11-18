import mongoose, { Document, Schema } from 'mongoose';

export type InterventionType =
  | 'counselling'
  | 'mentoring'
  | 'remedial_class'
  | 'subject_support'
  | 'assignment_help'
  | 'parent_meeting'
  | 'other';

export type InterventionStatus =
  | 'pending'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface IIntervention extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  facultyId: mongoose.Types.ObjectId;
  type: InterventionType;
  description: string;
  scheduledDate: Date;
  followUpDate?: Date;
  status: InterventionStatus;
  outcome?: string;
  notes?: string;
  riskLevelAtCreation?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InterventionSchema = new Schema<IIntervention>(
  {
    studentId:           { type: Schema.Types.ObjectId, ref: 'User', required: true },
    facultyId:           { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type:                { type: String, enum: ['counselling','mentoring','remedial_class','subject_support','assignment_help','parent_meeting','other'], required: true },
    description:         { type: String, required: true, trim: true },
    scheduledDate:       { type: Date, required: true },
    followUpDate:        { type: Date },
    status:              { type: String, enum: ['pending','scheduled','in_progress','completed','cancelled'], default: 'pending' },
    outcome:             { type: String, trim: true },
    notes:               { type: String, trim: true },
    riskLevelAtCreation: { type: String },
  },
  { timestamps: true }
);

InterventionSchema.index({ studentId: 1, createdAt: -1 });
InterventionSchema.index({ facultyId: 1, status: 1 });

export const Intervention = mongoose.model<IIntervention>('Intervention', InterventionSchema);
