import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminVar extends Document {
  key: string;
  value: any;
  description?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AdminVarSchema: Schema = new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed, required: true },
  description: { type: String },
  updatedBy: { type: String }
}, { timestamps: true });

export default mongoose.model<IAdminVar>('AdminVar', AdminVarSchema);
