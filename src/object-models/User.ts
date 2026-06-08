import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  userId: string; // Internal or platform-specific ID (e.g. Telegram ID)
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  passwordHash?: string;
  emailVerified?: boolean;
  isActive?: boolean;
  role: 'user' | 'admin';
  transcriptionCount?: number;
  tgTranscriptionCount?: number;
  waTranscriptionCount?: number;
  fbTranscriptionCount?: number;
  lineTranscriptionCount?: number;
  instaTranscriptionCount?: number;
  wordsCount?: number;
  clonedMessagesCount?: number;
  balance?: number;
  currentPlan?: string;
  lastActiveAt?: Date;
  threadsToken?: string;
  threadsUserId?: string;
  metaToken?: string;
  whatsappToken?: string;
  whatsappPhoneId?: string;
  lineToken?: string;
  lineSecret?: string;
  preferredTranslationLanguage?: string; // e.g. 'rus_Cyrl', 'tha_Thai', 'heb_Hebr', 'zho_Hans'
  createdAt: Date;

  updatedAt: Date;
}

const UserSchema: Schema = new Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  email: { type: String },
  passwordHash: { type: String },
  emailVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  transcriptionCount: { type: Number, default: 0 },
  tgTranscriptionCount: { type: Number, default: 0 },
  waTranscriptionCount: { type: Number, default: 0 },
  fbTranscriptionCount: { type: Number, default: 0 },
  lineTranscriptionCount: { type: Number, default: 0 },
  instaTranscriptionCount: { type: Number, default: 0 },
  wordsCount: { type: Number, default: 0 },
  clonedMessagesCount: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  currentPlan: { type: String, default: "Pay-As-You-Go" },
  lastActiveAt: { type: Date },
  threadsToken: { type: String },
  threadsUserId: { type: String },
  metaToken: { type: String },
  whatsappToken: { type: String },
  whatsappPhoneId: { type: String },
  lineToken: { type: String },
  lineSecret: { type: String },
  preferredTranslationLanguage: { type: String, default: null }
}, { timestamps: true });


export default mongoose.model<IUser>('User', UserSchema);
