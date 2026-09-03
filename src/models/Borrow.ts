import mongoose, { Document, Schema } from 'mongoose';

export interface IBorrow extends Document {
  userId: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  borrowDate: Date;
  returnDate: Date;
  actualReturnDate?: Date | null;
  fine: number;
  fineCalculated: boolean;
  finePaid: boolean;
  status: 'borrowed' | 'returned' | 'lost' | 'damaged';
  remarks?: string;
  isOverdue: boolean;
  daysOverdue: number;
  returnedBy?: mongoose.Types.ObjectId;
  returnedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const borrowSchema = new Schema<IBorrow>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  borrowDate: { type: Date, default: Date.now, required: true },
  returnDate: { type: Date, required: true },
  actualReturnDate: { type: Date, default: null },
  fine: { type: Number, default: 0 },
  fineCalculated: { type: Boolean, default: false },
  finePaid: { type: Boolean, default: false },
  status: { 
    type: String, 
    enum: ['borrowed', 'returned', 'lost', 'damaged'], 
    default: 'borrowed', 
    index: true 
  },
  remarks: { type: String },
  isOverdue: { type: Boolean, default: false, index: true },
  daysOverdue: { type: Number, default: 0 },
  returnedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  returnedAt: { type: Date }
}, {
  timestamps: true
});

// Create compound indices
borrowSchema.index({ userId: 1, status: 1 });
borrowSchema.index({ bookId: 1, status: 1 });
borrowSchema.index({ returnDate: 1, status: 1 });

export const Borrow = mongoose.model<IBorrow>('Borrow', borrowSchema);
