import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  phone?: string;
  address?: string;
  role: 'user' | 'admin';
  profileImage?: {
    url: string;
    uploadedAt: Date;
  };
  isActive: boolean;
  isSuspended: boolean;
  suspensionReasons: string[];
  suspensionDate?: Date;
  suspensionEndDate?: Date | null;
  totalBooksIssued: number;
  totalBooksReturned: number;
  totalFinesGenerated: number;
  totalFinesPaid: number;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  isVerified: boolean;
  verificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
  name: { type: String, required: true, trim: true, maxlength: 50 },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  profileImage: {
    url: { type: String },
    uploadedAt: { type: Date }
  },
  isActive: { type: Boolean, default: true },
  isSuspended: { type: Boolean, default: false },
  suspensionReasons: { type: [String], default: [] },
  suspensionDate: { type: Date },
  suspensionEndDate: { type: Date, default: null },
  totalBooksIssued: { type: Number, default: 0 },
  totalBooksReturned: { type: Number, default: 0 },
  totalFinesGenerated: { type: Number, default: 0 },
  totalFinesPaid: { type: Number, default: 0 },
  lastLogin: { type: Date },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date }
}, {
  timestamps: true
});

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password as string, salt);
});

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>('User', userSchema);
