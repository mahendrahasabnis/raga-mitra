import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  phone: string;
  pinHash: string;
  credits: number;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  pinHash: {
    type: String,
    required: true
  },
  credits: {
    type: Number,
    default: 5,
    min: 0
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  }
}, {
  timestamps: true
});

export default mongoose.model<IUser>('User', UserSchema);
