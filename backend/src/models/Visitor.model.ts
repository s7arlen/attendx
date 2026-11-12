import mongoose, { Document, Schema } from 'mongoose';

export type VisitorCategory = 'guest' | 'vendor' | 'parent' | 'official' | 'delivery' | 'interview' | 'contractor' | 'other';
export type VisitorType = 'pre-registered' | 'walk-in';

export interface IVisitor extends Document {
  _id: mongoose.Types.ObjectId;
  fullName: string;
  phone: string;
  email?: string;
  category: VisitorCategory;
  photo?: string;           // URL (Cloudinary or local)
  idProof?: string;         // optional document scan URL
  nationalId?: string;      // ID card / passport number
  address?: string;
  company?: string;
  notes?: string;
  isBlacklisted: boolean;
  blacklistReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VisitorSchema = new Schema<IVisitor>(
  {
    fullName:         { type: String, required: true, trim: true },
    phone:            { type: String, required: true, trim: true },
    email:            { type: String, trim: true, lowercase: true },
    category:         { type: String, enum: ['guest','vendor','parent','official','delivery','interview','contractor','other'], required: true },
    photo:            { type: String },
    idProof:          { type: String },
    nationalId:       { type: String, trim: true },
    address:          { type: String, trim: true },
    company:          { type: String, trim: true },
    notes:            { type: String, trim: true },
    isBlacklisted:    { type: Boolean, default: false },
    blacklistReason:  { type: String },
  },
  { timestamps: true }
);

VisitorSchema.index({ phone: 1 });
VisitorSchema.index({ fullName: 'text', email: 'text', nationalId: 'text' });

export const Visitor = mongoose.model<IVisitor>('Visitor', VisitorSchema);
