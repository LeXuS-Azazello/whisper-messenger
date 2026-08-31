import mongoose from 'mongoose';

const MessengerSessionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  platform: { 
    type: String, 
    required: true, 
    enum: ['telegram', 'instagram', 'whatsapp', 'facebook'] 
  },
  identifier: { type: String, required: true },
  sessionData: { type: mongoose.Schema.Types.Mixed, required: true },
  isActive: { type: Boolean, default: true },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

MessengerSessionSchema.index({ userId: 1, platform: 1, identifier: 1 }, { unique: true });

export default mongoose.models.MessengerSession || mongoose.model('MessengerSession', MessengerSessionSchema);
