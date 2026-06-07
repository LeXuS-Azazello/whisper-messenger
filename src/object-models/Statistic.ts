import mongoose, { Schema, Document } from 'mongoose';

export interface IStatistic extends Document {
  userId: string;
  platform: string; // telegram, whatsapp, facebook, line, instagram
  action: string; // e.g., 'transcription', 'translation'
  inputLanguage?: string;
  outputLanguage?: string;
  charactersCount?: number;
  durationSeconds?: number;
  createdAt: Date;
}

const StatisticSchema: Schema = new Schema({
  userId: { type: String, required: true, index: true },
  platform: { type: String, required: true },
  action: { type: String, required: true },
  inputLanguage: { type: String },
  outputLanguage: { type: String },
  charactersCount: { type: Number, default: 0 },
  durationSeconds: { type: Number, default: 0 },
}, { timestamps: true });

StatisticSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IStatistic>('Statistic', StatisticSchema);
