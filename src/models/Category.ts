import mongoose, { Document, Schema } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  isStandard: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const STANDARD_CATEGORIES = [
  'Biography',
  'Business',
  'Classic',
  'Fantasy',
  'Fiction',
  'Finance',
  'History',
  'Memoir',
  'Mystery',
  'Non-Fiction',
  'Philosophy',
  'Psychology',
  'Science',
  'Science Fiction',
  'Self-Help',
  'Technology',
  'Thriller',
  'Other',
] as const;

export type StandardCategory = (typeof STANDARD_CATEGORIES)[number];

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Category name must be at least 2 characters long'],
      maxlength: [50, 'Category name cannot exceed 50 characters'],
    },
    isStandard: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
categorySchema.index({ name: 1 }, { unique: true });

export const Category = mongoose.model<ICategory>('Category', categorySchema);
