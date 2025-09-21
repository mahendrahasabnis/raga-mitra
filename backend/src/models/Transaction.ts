import mongoose, { Document, Schema } from 'mongoose';

export interface ITransaction extends Document {
  phone: string;
  razorpayPaymentId: string;
  razorpayOrderId?: string;
  amount: number;
  credits: number;
  paymentMode: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  transactionDate: Date;
  user?: mongoose.Types.ObjectId;
  packageId?: number;
  gstAmount?: number;
  totalAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>({
  phone: {
    type: String,
    required: true,
    index: true
  },
  razorpayPaymentId: {
    type: String,
    required: true,
    unique: true
  },
  razorpayOrderId: {
    type: String
  },
  amount: {
    type: Number,
    required: true
  },
  credits: {
    type: Number,
    required: true
  },
  paymentMode: {
    type: String,
    required: true,
    default: 'razorpay'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  transactionDate: {
    type: Date,
    default: Date.now
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  packageId: {
    type: Number
  },
  gstAmount: {
    type: Number
  },
  totalAmount: {
    type: Number
  }
}, {
  timestamps: true
});

// Index for efficient queries
TransactionSchema.index({ phone: 1, transactionDate: -1 });
TransactionSchema.index({ razorpayPaymentId: 1 });

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
