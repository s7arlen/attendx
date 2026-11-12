import mongoose, { Document, Schema } from 'mongoose';

export interface IVisitorEvent extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  eventDate: Date;
  startTime: string;   // HH:MM
  endTime: string;     // HH:MM
  venue: string;
  organizer: mongoose.Types.ObjectId;  // ref: User
  maxVisitors?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VisitorEventSchema = new Schema<IVisitorEvent>(
  {
    name:           { type: String, required: true, trim: true },
    description:    { type: String, trim: true },
    eventDate:      { type: Date, required: true },
    startTime:      { type: String, required: true },
    endTime:        { type: String, required: true },
    venue:          { type: String, required: true, trim: true },
    organizer:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    maxVisitors:    { type: Number },
    isActive:       { type: Boolean, default: true },
  },
  { timestamps: true }
);

VisitorEventSchema.index({ eventDate: 1 });

export const VisitorEvent = mongoose.model<IVisitorEvent>('VisitorEvent', VisitorEventSchema);
