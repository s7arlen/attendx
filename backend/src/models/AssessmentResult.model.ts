import mongoose, { Document, Schema } from 'mongoose';

export interface IAssessmentResult extends Document {
  _id: mongoose.Types.ObjectId;
  assessmentId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  marksObtained: number;
  isAbsent: boolean;
  submittedLate?: boolean;    // for assignments
  feedback?: string;
  gradedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentResultSchema = new Schema<IAssessmentResult>(
  {
    assessmentId:  { type: Schema.Types.ObjectId, ref: 'Assessment', required: true },
    studentId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subjectId:     { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
    marksObtained: { type: Number, required: true, min: 0 },
    isAbsent:      { type: Boolean, default: false },
    submittedLate: { type: Boolean, default: false },
    feedback:      { type: String, trim: true },
    gradedBy:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Prevent duplicate result for same student + assessment
AssessmentResultSchema.index({ assessmentId: 1, studentId: 1 }, { unique: true });
AssessmentResultSchema.index({ studentId: 1, subjectId: 1 });

export const AssessmentResult = mongoose.model<IAssessmentResult>('AssessmentResult', AssessmentResultSchema);
