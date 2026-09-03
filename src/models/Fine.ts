import mongoose, { Document, Schema } from 'mongoose';

export interface IFine extends Document {
  userId: mongoose.Types.ObjectId;
  borrowId: mongoose.Types.ObjectId;
  bookId?: mongoose.Types.ObjectId;
  amount: number;
  daysOverdue: number;
  finePerDay: number;
  generatedDate: Date;
  status: 'pending' | 'paid' | 'waived';
  paymentDate?: Date;
  paymentMethod?: 'cash' | 'online' | 'check' | 'other';
  paymentReference?: string;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const fineSchema = new Schema<IFine>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  borrowId: { type: Schema.Types.ObjectId, ref: 'Borrow', required: true },
  bookId: { type: Schema.Types.ObjectId, ref: 'Book' },
  amount: { type: Number, required: true, min: 0 },
  daysOverdue: { type: Number, required: true },
  finePerDay: { type: Number, default: 20 },
  generatedDate: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['pending', 'paid', 'waived'], 
    default: 'pending', 
    index: true 
  },
  paymentDate: { type: Date },
  paymentMethod: { type: String, enum: ['cash', 'online', 'check', 'other'] },
  paymentReference: { type: String },
  remarks: { type: String }
}, {
  timestamps: true
});

export const Fine = mongoose.model<IFine>('Fine', fineSchema);
