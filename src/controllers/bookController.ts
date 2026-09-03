import { Request, Response } from 'express';
import { Book } from '../models/Book.js';

export const getBooks = async (req: Request, res: Response) => {
  const { search, category, available, page, limit, sort } = req.query as {
    search?: string;
    category?: 'All' | 'Fiction' | 'Non-Fiction' | 'Science' | 'History' | 'Technology' | 'Other';
    available?: boolean;
    page?: number;
    limit?: number;
    sort?: 'createdAt' | 'title' | 'author' | 'popular';
  };

  const skip = ((page || 1) - 1) * (limit || 10);

  const query: any = { isActive: true };

  if (search) {
    const textSearch: any = {
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { isbn: { $regex: search, $options: 'i' } }
      ],
    };
    Object.assign(query, textSearch);
  }

  if (category && category !== 'All') {
    const categoryFilter: any = {};
    categoryFilter.$or = [
      { category: category },
      { categories: { $in: [category] } },
    ];
    if (query.$or) {
      query.$and = [{ $or: query.$or }, categoryFilter];
      delete query.$or;
    } else {
      Object.assign(query, categoryFilter);
    }
  }

  if (available !== undefined) {
    query.available = available ? { $gt: 0 } : 0;
  }

  let sortCriteria: any = {};
  if (sort === 'title') {
    sortCriteria = { title: 1 };
  } else if (sort === 'author') {
    sortCriteria = { author: 1 };
  } else if (sort === 'popular') {
    sortCriteria = { totalIssued: -1 };
  } else {
    sortCriteria = { createdAt: -1 };
  }

  const books = await Book.find(query)
    .sort(sortCriteria)
    .skip(skip)
    .limit(Number(limit || 10));

  const total = await Book.countDocuments(query);

  res.json({
    success: true,
    data: {
      books,
      pagination: {
        currentPage: Number(page || 1),
        totalPages: Math.ceil(total / Number(limit || 10)),
        totalBooks: total,
        limit: Number(limit || 10)
      }
    }
  });
};

export const getBookById = async (req: Request, res: Response) => {
  const book = await Book.findById(req.params.id);

  if (book) {
    res.json({
      success: true,
      data: book
    });
  } else {
    res.status(404);
    throw new Error('Book not found');
  }
};

export const addBook = async (req: Request, res: Response) => {
  const { title, author, category, categories, isbn, publisher, publishYear, description, quantity, imageUrl, bookImage } = req.body;

  let bookImageResult = undefined;

  if (bookImage && typeof bookImage === 'object' && bookImage.url) {
    bookImageResult = {
      url: bookImage.url,
      uploadedAt: bookImage.uploadedAt ? new Date(bookImage.uploadedAt) : new Date(),
      path: bookImage.path || bookImage.url,
    };
  } else if (imageUrl && typeof imageUrl === 'string') {
    try {
      const urlObj = new URL(imageUrl);
      const protocolOk = urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
      if (!protocolOk) {
        res.status(400);
        throw new Error('imageUrl must be an HTTP or HTTPS URL');
      }
      const requiresHttps = urlObj.hostname !== 'localhost' && urlObj.hostname !== '127.0.0.1';
      if (requiresHttps && urlObj.protocol !== 'https:') {
        res.status(400);
        throw new Error('imageUrl must use HTTPS unless the host is localhost');
      }
      bookImageResult = {
        url: imageUrl,
        uploadedAt: new Date(),
        path: imageUrl,
      };
    } catch (err: any) {
      if (err.message === 'imageUrl must be an HTTP or HTTPS URL' || err.message === 'imageUrl must use HTTPS unless the host is localhost') throw err;
      res.status(400);
      throw new Error('Invalid imageUrl format');
    }
  } else if ((req as any).file) {
    bookImageResult = {
      url: `/uploads/${(req as any).file.filename}`,
      uploadedAt: new Date(),
      path: (req as any).file.path
    };
  }

  const payload: any = {
    title,
    author,
    category,
    categories: Array.isArray(categories) && categories.length > 0 ? categories : (category ? [category] : undefined),
    isbn,
    publisher,
    publishYear,
    description,
    quantity,
    available: quantity,
  };

  if (bookImageResult) {
    payload.bookImage = bookImageResult;
    payload.imageUrl = bookImageResult.url;
  }

  const book = await Book.create(payload);

  res.status(201).json({
    success: true,
    message: 'Book added successfully',
    data: book
  });
};

export const updateBook = async (req: Request, res: Response) => {
  const { title, author, category, categories, isbn, publisher, publishYear, description, quantity, imageUrl, bookImage } = req.body;

  const book = await Book.findById(req.params.id);

  if (!book) {
    res.status(404);
    throw new Error('Book not found');
  }

  if (quantity !== undefined) {
    const diff = quantity - book.quantity;
    book.quantity = quantity;
    book.available += diff;
    if (book.available < 0) {
      res.status(400);
      throw new Error('Cannot reduce quantity below currently issued books');
    }
  }

  book.title = title !== undefined ? title : book.title;
  book.author = author !== undefined ? author : book.author;
  book.category = category !== undefined ? category : book.category;
  if (categories !== undefined) {
    (book as any).categories = Array.isArray(categories) && categories.length > 0
      ? categories
      : (category ? [category] : book.categories);
  }
  book.isbn = isbn !== undefined ? isbn : book.isbn;
  book.publisher = publisher !== undefined ? publisher : book.publisher;
  book.publishYear = publishYear !== undefined ? publishYear : book.publishYear;
  book.description = description !== undefined ? description : book.description;

  if (bookImage !== undefined) {
    if (bookImage === null) {
      (book as any).imageUrl = undefined;
      book.bookImage = undefined;
    } else if (typeof bookImage === 'object' && bookImage.url) {
      book.bookImage = {
        url: bookImage.url,
        uploadedAt: bookImage.uploadedAt ? new Date(bookImage.uploadedAt) : new Date(),
        path: bookImage.path || bookImage.url,
      };
      book.imageUrl = bookImage.url;
    }
  } else if (imageUrl !== undefined) {
    if (imageUrl === null || imageUrl === '') {
      (book as any).imageUrl = undefined;
      book.bookImage = undefined;
    } else {
      try {
        const urlObj = new URL(imageUrl);
        const protocolOk = urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        if (!protocolOk) {
          res.status(400);
          throw new Error('imageUrl must be an HTTP or HTTPS URL');
        }
        const requiresHttps = urlObj.hostname !== 'localhost' && urlObj.hostname !== '127.0.0.1';
        if (requiresHttps && urlObj.protocol !== 'https:') {
          res.status(400);
          throw new Error('imageUrl must use HTTPS unless the host is localhost');
        }
        (book as any).imageUrl = imageUrl;
        book.bookImage = {
          url: imageUrl,
          uploadedAt: new Date(),
          path: imageUrl,
        };
      } catch (err: any) {
        if (err.message === 'imageUrl must be an HTTP or HTTPS URL' || err.message === 'imageUrl must use HTTPS unless the host is localhost') throw err;
        res.status(400);
        throw new Error('Invalid imageUrl format');
      }
    }
  } else if ((req as any).file) {
    const fileUrl = `/uploads/${(req as any).file.filename}`;
    (book as any).imageUrl = fileUrl;
    book.bookImage = {
      url: fileUrl,
      uploadedAt: new Date(),
      path: (req as any).file.path
    };
  }

  const updatedBook = await book.save();
  res.json({
    success: true,
    message: 'Book updated successfully',
    data: updatedBook
  });
};

export const deleteBook = async (req: Request, res: Response) => {
  const book = await Book.findById(req.params.id);

  if (!book) {
    res.status(404);
    throw new Error('Book not found');
  }

  // Check if book is currently issued
  if (book.currentlyIssued > 0) {
    res.status(400);
    throw new Error('Cannot delete book with active issues');
  }

  book.isActive = false;
  await book.save();

  res.json({
    success: true,
    message: 'Book removed successfully'
  });
};
