import mongoose, { Document, Schema } from 'mongoose';

export const DEFAULT_QR_REFRESH_SECONDS = 10;
export const MIN_QR_REFRESH_SECONDS = 5;
export const MAX_QR_REFRESH_SECONDS = 300;

export interface ISystemSettings extends Document {
  key: string;
  qrRefreshSeconds: number;
  updatedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const SystemSettingsSchema = new Schema<ISystemSettings>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    qrRefreshSeconds: {
      type: Number,
      required: true,
      default: DEFAULT_QR_REFRESH_SECONDS,
      min: MIN_QR_REFRESH_SECONDS,
      max: MAX_QR_REFRESH_SECONDS,
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const SystemSettings = mongoose.model<ISystemSettings>('SystemSettings', SystemSettingsSchema);

export async function getSystemSettings(): Promise<ISystemSettings> {
  const existing = await SystemSettings.findOne({ key: 'global' });
  if (existing) {
    // Upgrade untouched auto-seeded 15s default to 10s without overriding explicit admin saves
    if (existing.updatedBy == null && existing.qrRefreshSeconds === 15) {
      existing.qrRefreshSeconds = DEFAULT_QR_REFRESH_SECONDS;
      await existing.save();
    }
    return existing;
  }

  const created = await SystemSettings.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: { key: 'global', qrRefreshSeconds: DEFAULT_QR_REFRESH_SECONDS } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return created!;
}
