import mongoose, { Document, Schema } from 'mongoose';

export interface IBook extends Document {
  title: string;
  author: string;
  category: 'Fiction' | 'Non-Fiction' | 'Science' | 'History' | 'Technology' | 'Other';
  categories: Array<'Fiction' | 'Non-Fiction' | 'Science' | 'History' | 'Technology' | 'Other'>;
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

const VALID_CATEGORIES = ['Fiction', 'Non-Fiction', 'Science', 'History', 'Technology', 'Other'] as const;

const bookSchema = new Schema<IBook>({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  author: { type: String, required: true, trim: true, maxlength: 100 },
  category: {
    type: String,
    required: true,
    enum: VALID_CATEGORIES,
    default: 'Other',
  },
  categories: {
    type: [String],
    required: true,
    enum: VALID_CATEGORIES,
    default: ['Other'],
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
    const primaryCategory = book.categories.find((c: string) => (VALID_CATEGORIES as readonly string[]).includes(c));
    if (primaryCategory && (!book.category || book.category === 'Other')) {
      book.category = primaryCategory;
    }
    book.categories = Array.from(new Set(book.categories));
  } else if (book.category) {
    book.categories = [book.category as string | undefined];
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
