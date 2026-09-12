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

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(content: string): string[][] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows: string[][] = [];
  let currentRow = '';

  for (const line of lines) {
    if (!line.trim() && !currentRow) continue;
    if (currentRow) {
      currentRow += '\n' + line;
    } else {
      currentRow = line;
    }

    let quoteCount = 0;
    for (let i = 0; i < currentRow.length; i++) {
      if (currentRow[i] === '"') quoteCount++;
    }
    if (quoteCount % 2 === 0) {
      rows.push(parseCsvLine(currentRow));
      currentRow = '';
    }
  }
  return rows;
}

export const bulkImportBooks = async (req: Request, res: Response) => {
  const file = (req as any).file;
  if (!file || !file.buffer) {
    res.status(400);
    throw new Error('No CSV file provided. Please upload a valid CSV file.');
  }

  const csvContent = file.buffer.toString('utf-8');
  const rows = parseCsv(csvContent);

  if (rows.length < 2) {
    res.status(400);
    throw new Error('CSV file must contain a header row and at least one data row.');
  }

  const headers = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const titleIdx = headers.findIndex((h) => h === 'title');
  const authorIdx = headers.findIndex((h) => h === 'author');
  const categoryIdx = headers.findIndex((h) => h === 'category' || h === 'categories');
  const isbnIdx = headers.findIndex((h) => h === 'isbn');
  const publisherIdx = headers.findIndex((h) => h === 'publisher');
  const publishYearIdx = headers.findIndex((h) => h === 'publishyear' || h === 'year');
  const descIdx = headers.findIndex((h) => h === 'description' || h === 'desc');
  const quantityIdx = headers.findIndex((h) => h === 'quantity' || h === 'qty' || h === 'stock');
  const imageIdx = headers.findIndex((h) => h === 'imageurl' || h === 'image' || h === 'cover');

  if (titleIdx === -1 || authorIdx === -1) {
    res.status(400);
    throw new Error("CSV file must have at least 'title' and 'author' column headers.");
  }

  const VALID_CATEGORIES = ['Fiction', 'Non-Fiction', 'Science', 'History', 'Technology', 'Other'];
  const booksToCreate = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const title = row[titleIdx]?.trim();
    const author = row[authorIdx]?.trim();

    if (!title || !author) continue;

    const rawCategory = categoryIdx !== -1 ? row[categoryIdx]?.trim() : '';
    const matchedCategory = VALID_CATEGORIES.find(
      (c) => c.toLowerCase() === rawCategory?.toLowerCase()
    ) as any || 'Other';

    const rawIsbn = isbnIdx !== -1 ? row[isbnIdx]?.replace(/[-\s]/g, '').trim() : '';
    const isbn = rawIsbn && /^[0-9]{10}([0-9]{3})?$/.test(rawIsbn) ? rawIsbn : undefined;

    const publisher = publisherIdx !== -1 ? row[publisherIdx]?.trim() : undefined;
    const rawYear = publishYearIdx !== -1 ? parseInt(row[publishYearIdx], 10) : NaN;
    const publishYear = !isNaN(rawYear) && rawYear >= 1000 && rawYear <= new Date().getFullYear() ? rawYear : undefined;
    const description = descIdx !== -1 ? row[descIdx]?.trim() : undefined;

    const rawQty = quantityIdx !== -1 ? parseInt(row[quantityIdx], 10) : NaN;
    const quantity = !isNaN(rawQty) && rawQty > 0 ? rawQty : 1;

    const rawImg = imageIdx !== -1 ? row[imageIdx]?.trim() : '';
    const imageUrl = rawImg && (rawImg.startsWith('http://') || rawImg.startsWith('https://')) ? rawImg : undefined;

    booksToCreate.push({
      title,
      author,
      category: matchedCategory,
      categories: [matchedCategory],
      isbn,
      publisher,
      publishYear,
      description,
      quantity,
      available: quantity,
      imageUrl,
      bookImage: imageUrl ? { url: imageUrl, uploadedAt: new Date(), path: imageUrl } : undefined,
      isActive: true,
    });
  }

  if (booksToCreate.length === 0) {
    res.status(400);
    throw new Error('No valid book records could be extracted from the CSV file.');
  }

  // Create books in DB
  const createdBooks = await Book.create(booksToCreate);

  res.status(201).json({
    success: true,
    message: `Successfully imported ${createdBooks.length} books into the catalog`,
    data: createdBooks
  });
};

