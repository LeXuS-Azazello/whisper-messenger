import mongoose, { Schema, Document } from 'mongoose';

export interface IMessengerSession extends Document {
  userId: string;
  platform: 'telegram' | 'instagram' | 'whatsapp' | 'facebook';
  identifier: string; // e.g. phone number or account name
  sessionData: any; // Opaque object containing tokens, session strings, etc.
  isActive: boolean;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const MessengerSessionSchema: Schema = new Schema({
  userId: { type: String, required: true },
  platform: { 
    type: String, 
    required: true, 
    enum: ['telegram', 'instagram', 'whatsapp', 'facebook', 'line'] 
  },
  identifier: { type: String, required: true },
  sessionData: { type: Schema.Types.Mixed, required: true },
  isActive: { type: Boolean, default: true },
  metadata: { type: Schema.Types.Mixed }
}, { timestamps: true });

// Ensure unique session per user per platform per identifier
MessengerSessionSchema.index({ userId: 1, platform: 1, identifier: 1 }, { unique: true });

export default mongoose.model<IMessengerSession>('MessengerSession', MessengerSessionSchema);
