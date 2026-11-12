import mongoose, { Document, Schema } from 'mongoose';

export interface ISubject extends Document {
  _id: mongoose.Types.ObjectId;
  subjectName: string;
  subjectCode: string;
  assignedTeacher: mongoose.Types.ObjectId;
  department: string;
  year: number;
  section: string;
  credits: number;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubjectSchema = new Schema<ISubject>(
  {
    subjectName: { type: String, required: true, trim: true },
    subjectCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    assignedTeacher: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    department: { type: String, required: true, trim: true },
    year: { type: Number, required: true, min: 1, max: 4 },
    section: { type: String, required: true, trim: true },
    credits: { type: Number, default: 3, min: 1, max: 6 },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Subject = mongoose.model<ISubject>('Subject', SubjectSchema);
