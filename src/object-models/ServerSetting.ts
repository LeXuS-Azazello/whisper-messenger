import mongoose, { Schema, Document } from 'mongoose';

export interface IServerSetting extends Document {
  key: string;
  value: any;
  category?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ServerSettingSchema: Schema = new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed, required: true },
  category: { type: String, default: 'general' },
  description: { type: String }
}, { timestamps: true });

export default mongoose.model<IServerSetting>('ServerSetting', ServerSettingSchema);
