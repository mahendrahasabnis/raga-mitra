import mongoose, { Document, Schema } from 'mongoose';

export interface IRaga extends Document {
  name: string;
  tags: string[];
  idealHours: number[];
  description: string;
  isRecommended: boolean;
  isActive: boolean;
  seasons: string[];
  marathiSeasons: string[];
  popularity: 'highly listened' | 'moderately listened' | 'sparingly listened' | 'rarely listened';
  createdAt: Date;
  updatedAt: Date;
}

const RagaSchema = new Schema<IRaga>({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  idealHours: [{
    type: Number,
    min: 0,
    max: 23
  }],
  description: {
    type: String,
    trim: true
  },
  isRecommended: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  seasons: [{
    type: String,
    enum: ['Grishma', 'Varsha', 'Sharad', 'Hemant', 'Shishir', 'Vasant'],
    trim: true
  }],
  marathiSeasons: [{
    type: String,
    enum: ['ग्रीष्म', 'वर्षा', 'शरद', 'हेमंत', 'शिशिर', 'वसंत'],
    trim: true
  }],
  popularity: {
    type: String,
    enum: ['highly listened', 'moderately listened', 'sparingly listened', 'rarely listened'],
    default: 'moderately listened'
  }
}, {
  timestamps: true
});

export default mongoose.model<IRaga>('Raga', RagaSchema);
