import mongoose, { Document, Schema } from 'mongoose';
import { STANDARD_CATEGORIES, StandardCategory } from './Category.js';

export const VALID_CATEGORIES = STANDARD_CATEGORIES;
export type BookCategory = StandardCategory | string;

export interface IBook extends Document {
  title: string;
  author: string;
  category: BookCategory;
  categories: BookCategory[];
  isbn?: string;
  publisher?: string;
  publishYear?: number;
  description?: string;
  quantity: number;
  available: number;
  imageUrl?: string;
  bookImage?: {
    url: string;
    uploadedAt: Date;
    path: string;
  };
  isActive: boolean;
  totalIssued: number;
  currentlyIssued: number;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

const bookSchema = new Schema<IBook>({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  author: { type: String, required: true, trim: true, maxlength: 100 },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    maxlength: [50, 'Category cannot exceed 50 characters'],
    default: 'Other',
    validate: {
      validator: (val: string) => typeof val === 'string' && val.trim().length > 0 && val.trim().length <= 50,
      message: 'Category must be a non-empty string up to 50 characters',
    },
  },
  categories: {
    type: [String],
    required: true,
    default: ['Other'],
    validate: {
      validator: (cats: string[]) =>
        Array.isArray(cats) &&
        cats.length > 0 &&
        cats.every((c) => typeof c === 'string' && c.trim().length > 0 && c.trim().length <= 50),
      message: 'Categories must contain at least one valid category name',
    },
  },
  isbn: {
    type: String,
    unique: true,
    sparse: true,
    match: /^[0-9]{10}([0-9]{3})?$/
  },
  publisher: { type: String, trim: true },
  publishYear: {
    type: Number,
    min: 1000,
    max: new Date().getFullYear()
  },
  description: { type: String, maxlength: 1000 },
  quantity: { type: Number, required: true, min: 0, default: 1 },
  available: { type: Number, required: true, min: 0 },
  imageUrl: {
    type: String,
    trim: true,
    validate: {
      validator: (value: string) => {
        if (!value) return true;
        try {
          const url = new URL(value);
          const protocolOk = url.protocol === 'http:' || url.protocol === 'https:';
          if (!protocolOk) return false;
          if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true;
          return url.protocol === 'https:';
        } catch {
          return false;
        }
      },
      message: 'imageUrl must be a valid HTTPS URL (or HTTP on localhost)'
    }
  },
  bookImage: {
    url: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now },
    path: { type: String, trim: true }
  },
  isActive: { type: Boolean, default: true },
  totalIssued: { type: Number, default: 0 },
  currentlyIssued: { type: Number, default: 0 },
  rating: { type: Number, min: 0, max: 5, default: 0 }
}, {
  timestamps: true
});

bookSchema.pre('save', function preSaveSyncImageFields() {
  const book = this as any;
  if (book.categories && Array.isArray(book.categories) && book.categories.length > 0) {
    const cleaned = Array.from(
      new Set(
        book.categories
          .map((c: any) => (typeof c === 'string' ? c.trim() : ''))
          .filter(Boolean)
      )
    );
    book.categories = cleaned.length > 0 ? cleaned : ['Other'];

    const primaryCategory = book.categories.find((c: string) =>
      STANDARD_CATEGORIES.some((sc) => sc.toLowerCase() === c.toLowerCase())
    );

    if (primaryCategory && (!book.category || book.category === 'Other')) {
      book.category = primaryCategory;
    } else if (!book.category) {
      book.category = book.categories[0] || 'Other';
    }
  } else if (book.category) {
    const trimmed = String(book.category).trim();
    book.category = trimmed || 'Other';
    book.categories = [book.category];
  } else {
    book.categories = ['Other'];
    book.category = 'Other';
  }

  if (book.imageUrl) {
    if (!book.bookImage || book.bookImage.url !== book.imageUrl) {
      book.bookImage = {
        url: book.imageUrl,
        uploadedAt: book.bookImage?.uploadedAt || new Date(),
        path: book.bookImage?.path || book.imageUrl,
      };
    } else {
      if (!book.bookImage.uploadedAt) book.bookImage.uploadedAt = new Date();
      if (!book.bookImage.path) book.bookImage.path = book.imageUrl;
    }
  } else if (book.bookImage && book.bookImage.url) {
    book.imageUrl = book.bookImage.url;
    if (!book.bookImage.uploadedAt) book.bookImage.uploadedAt = new Date();
    if (!book.bookImage.path) book.bookImage.path = book.bookImage.url;
  }
});

bookSchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.bookImage?.url && !ret.imageUrl) {
      ret.imageUrl = ret.bookImage.url;
    } else if (ret.imageUrl && !ret.bookImage?.url) {
      ret.bookImage = {
        url: ret.imageUrl,
        uploadedAt: ret.updatedAt || new Date(),
        path: ret.imageUrl,
      };
    }
    return ret;
  },
});

export const Book = mongoose.model<IBook>('Book', bookSchema);
