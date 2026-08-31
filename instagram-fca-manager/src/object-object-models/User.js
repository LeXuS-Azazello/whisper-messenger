import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
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
  lastActiveAt: { type: Date },
  instagramId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);