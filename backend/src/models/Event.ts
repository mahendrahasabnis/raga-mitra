import mongoose, { Document, Schema } from 'mongoose';

export interface IEvent extends Document {
  name: string;
  eventTag: string;
  description: string;
  trackUrls: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  eventTag: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  trackUrls: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export default mongoose.model<IEvent>('Event', EventSchema);
