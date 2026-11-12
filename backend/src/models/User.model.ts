import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'admin' | 'teacher' | 'student' | 'security';

export interface IWebAuthnCredential {
  credentialId: string;       // base64url encoded
  publicKey: string;          // base64url encoded
  counter: number;
  deviceType: string;
  transports?: string[];
  createdAt: Date;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  department: string;
  year?: number;
  section?: string;
  rollNumber?: string;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  refreshToken?: string;
  webauthnChallenge?: string;  // temp challenge during registration/auth
  webauthnCredentials: IWebAuthnCredential[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'teacher', 'student', 'security'], required: true },
    department: { type: String, required: true, trim: true },
    year: { type: Number, min: 1, max: 4 },
    section: { type: String, trim: true },
    rollNumber: { type: String, trim: true, sparse: true },
    phone: { type: String, trim: true },
    avatar: { type: String },
    isActive: { type: Boolean, default: true },
    refreshToken: { type: String },
    webauthnChallenge: { type: String },
    webauthnCredentials: {
      type: [{
        credentialId: { type: String, required: true },
        publicKey:    { type: String, required: true },
        counter:      { type: Number, required: true, default: 0 },
        deviceType:   { type: String, default: 'platform' },
        transports:   [{ type: String }],
        createdAt:    { type: Date, default: Date.now },
      }],
      default: [],
    },
  },
  { timestamps: true }
);

UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

UserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  // passwordHash is already hashed before saving — handled in controller
  next();
});

// Remove sensitive fields from JSON output and remap _id → id
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  // Remap _id to id so frontend User.id works correctly
  obj.id = obj._id.toString();
  delete obj._id;
  delete obj.__v;
  delete obj.passwordHash;
  delete obj.refreshToken;
  delete obj.webauthnChallenge;
  // Replace webauthnCredentials with a simple boolean flag
  obj.hasWebAuthn = Array.isArray(obj.webauthnCredentials) && obj.webauthnCredentials.length > 0;
  delete obj.webauthnCredentials;
  return obj;
};

export const User = mongoose.model<IUser>('User', UserSchema);
