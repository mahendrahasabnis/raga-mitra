import mongoose, { Document, Schema } from 'mongoose';

export interface ITrackRating {
  userId: string;
  rating: number;
  createdAt: Date;
}

export interface ITrack extends Document {
  raga: string;
  artist: string;
  title: string;
  url: string;
  duration: string; // Formatted duration like "1:23:45"
  durationSeconds: number; // Duration in seconds for sorting
  likes: number;
  isCurated: boolean;
  ratings: ITrackRating[];
  thumbnail: string;
  searchKey: string; // raga + artist for caching
  createdAt: Date;
  updatedAt: Date;
}

const TrackRatingSchema = new Schema<ITrackRating>({
  userId: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  }
}, {
  timestamps: true
});

const TrackSchema = new Schema<ITrack>({
  raga: {
    type: String,
    required: true,
    trim: true
  },
  artist: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  duration: {
    type: String,
    required: true
  },
  durationSeconds: {
    type: Number,
    required: true
  },
  likes: {
    type: Number,
    default: 0
  },
  isCurated: {
    type: Boolean,
    default: false
  },
  ratings: [TrackRatingSchema],
  thumbnail: {
    type: String,
    trim: true
  },
  searchKey: {
    type: String,
    required: true,
    unique: true,
    trim: true
  }
}, {
  timestamps: true
});

// Index for efficient searching
TrackSchema.index({ searchKey: 1 });
TrackSchema.index({ raga: 1, artist: 1 });
TrackSchema.index({ isCurated: 1 });

export default mongoose.model<ITrack>('Track', TrackSchema);
