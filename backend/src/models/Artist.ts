import mongoose, { Document, Schema } from 'mongoose';

export interface IArtist extends Document {
  name: string;
  yearBorn: number;
  specialty: string;
  gharana?: string;
  knownRagas: string[];
  bio: string;
  imgUrl: string;
  rating: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ArtistSchema = new Schema<IArtist>({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  yearBorn: {
    type: Number,
    required: true,
    min: 1800,
    max: new Date().getFullYear()
  },
  specialty: {
    type: String,
    required: true,
    trim: true
  },
  gharana: {
    type: String,
    required: false,
    trim: true
  },
  knownRagas: [{
    type: String,
    trim: true
  }],
  bio: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200 // 20 words * 10 chars per word average
  },
  imgUrl: {
    type: String,
    trim: true
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export default mongoose.model<IArtist>('Artist', ArtistSchema);
