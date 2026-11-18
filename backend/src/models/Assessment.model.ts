import mongoose, { Document, Schema } from 'mongoose';

export type AssessmentType =
  | 'internal_exam'
  | 'unit_test'
  | 'quiz'
  | 'assignment'
  | 'practical'
  | 'project'
  | 'other';

export interface IAssessment extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  type: AssessmentType;
  subjectId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  department: string;
  year: number;
  section: string;
  maxMarks: number;
  assessmentDate: Date;
  dueDate?: Date;           // for assignments
  description?: string;
  isPublished: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentSchema = new Schema<IAssessment>(
  {
    title:          { type: String, required: true, trim: true },
    type:           { type: String, enum: ['internal_exam','unit_test','quiz','assignment','practical','project','other'], required: true },
    subjectId:      { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
    teacherId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    department:     { type: String, required: true, trim: true },
    year:           { type: Number, required: true, min: 1, max: 4 },
    section:        { type: String, required: true, trim: true },
    maxMarks:       { type: Number, required: true, min: 1 },
    assessmentDate: { type: Date, required: true },
    dueDate:        { type: Date },
    description:    { type: String, trim: true },
    isPublished:    { type: Boolean, default: false },
    isActive:       { type: Boolean, default: true },
  },
  { timestamps: true }
);

AssessmentSchema.index({ subjectId: 1, type: 1 });
AssessmentSchema.index({ department: 1, year: 1, section: 1 });

export const Assessment = mongoose.model<IAssessment>('Assessment', AssessmentSchema);
