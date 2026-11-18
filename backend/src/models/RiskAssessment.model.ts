import mongoose, { Document, Schema } from 'mongoose';

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH';
export type AssessmentMethod = 'RULE_BASED' | 'ML_MODEL';

export interface IContributingFactor {
  factor: string;
  value: number | string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface IRiskAssessment extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  riskLevel: RiskLevel;
  assessmentMethod: AssessmentMethod;
  riskScore: number;              // 0-100
  contributingFactors: IContributingFactor[];
  recommendations: string[];
  attendancePercentage?: number;
  internalMarksAverage?: number;
  assignmentCompletionRate?: number;
  quizAverage?: number;
  modelVersion: string;
  dataWarnings: string[];         // e.g. "Insufficient quiz data"
  previousRiskLevel?: RiskLevel;
  createdAt: Date;
  updatedAt: Date;
}

const RiskAssessmentSchema = new Schema<IRiskAssessment>(
  {
    studentId:                { type: Schema.Types.ObjectId, ref: 'User', required: true },
    riskLevel:                { type: String, enum: ['LOW','MODERATE','HIGH'], required: true },
    assessmentMethod:         { type: String, enum: ['RULE_BASED','ML_MODEL'], default: 'RULE_BASED' },
    riskScore:                { type: Number, required: true, min: 0, max: 100 },
    contributingFactors:      [{ factor: String, value: Schema.Types.Mixed, impact: String }],
    recommendations:          [{ type: String }],
    attendancePercentage:     { type: Number },
    internalMarksAverage:     { type: Number },
    assignmentCompletionRate: { type: Number },
    quizAverage:              { type: Number },
    modelVersion:             { type: String, default: '1.0-rule-based' },
    dataWarnings:             [{ type: String }],
    previousRiskLevel:        { type: String, enum: ['LOW','MODERATE','HIGH'] },
  },
  { timestamps: true }
);

RiskAssessmentSchema.index({ studentId: 1, createdAt: -1 });

export const RiskAssessment = mongoose.model<IRiskAssessment>('RiskAssessment', RiskAssessmentSchema);
