import { Request, Response, NextFunction } from 'express';
import { Borrow } from '../models/Borrow.js';
import { Book } from '../models/Book.js';
import { User } from '../models/User.js';
import { Fine } from '../models/Fine.js';
import { AuthRequest } from '../middleware/authenticate.js';

// User-initiated book borrowing (without admin authorization)
export const userBorrowBook = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { bookId, returnDate } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User authentication required' });
      return;
    }

    // Validate the target book exists and is active
    const book = await Book.findById(bookId);
    if (!book || !book.isActive) {
      res.status(404).json({ success: false, message: 'Book not found or inactive' });
      return;
    }

    const user = await User.findById(userId);
    if (!user || !user.isActive || user.isSuspended) {
      res.status(400).json({ success: false, message: 'User account is not valid for borrowing books' });
      return;
    }

    // Guardrail: cap simultaneous active loans to prevent abuse
    const MAX_ACTIVE_LOANS = 5;
    const activeLoanCount = await Borrow.countDocuments({ userId, status: 'borrowed' });
    if (activeLoanCount >= MAX_ACTIVE_LOANS) {
      res.status(400).json({
        success: false,
        message: `You have reached the maximum active loan limit (${MAX_ACTIVE_LOANS}). Return a book to borrow more.`
      });
      return;
    }

    // Guardrail: prevent the same user from holding the same book twice
    const existingBorrow = await Borrow.findOne({ userId, bookId, status: 'borrowed' });
    if (existingBorrow) {
      res.status(400).json({ success: false, message: 'You already have this book borrowed' });
      return;
    }

    // Calculate return date (default 14 days from now)
    const calculatedReturnDate = returnDate ? new Date(returnDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(calculatedReturnDate.getTime())) {
      res.status(400).json({ success: false, message: 'Invalid return date' });
      return;
    }

    if (calculatedReturnDate.getTime() <= Date.now()) {
      res.status(400).json({ success: false, message: 'Return date must be in the future' });
      return;
    }

    // Atomic stock decrement — prevents race conditions
    const decrementedBook = await Book.findOneAndUpdate(
      { _id: bookId, isActive: true, available: { $gt: 0 } },
      { $inc: { available: -1, currentlyIssued: 1, totalIssued: 1 } },
      { new: true }
    );

    if (!decrementedBook) {
      res.status(400).json({ success: false, message: 'Book is currently out of stock' });
      return;
    }

    let createdBorrow;
    try {
      createdBorrow = await Borrow.create({
        userId,
        bookId,
        borrowDate: new Date(),
        returnDate: calculatedReturnDate,
        status: 'borrowed'
      });

      await User.findByIdAndUpdate(userId, { $inc: { totalBooksIssued: 1 } });
    } catch (err) {
      // Compensating action: roll back the stock decrement if creation failed
      await Book.findByIdAndUpdate(bookId, { $inc: { available: 1, currentlyIssued: -1, totalIssued: -1 } });
      throw err;
    }

    const populatedBorrow = await Borrow.findById(createdBorrow._id)
      .populate('bookId', 'title author isbn bookImage')
      .populate('userId', 'name email');

    res.status(201).json({
      success: true,
      message: 'Book borrowed successfully',
      data: populatedBorrow
    });
  } catch (error: any) {
    next(error);
  }
};

// Admin-initiated book issuing
export const issueBook = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId, bookId, returnDate } = req.body;

    const book = await Book.findById(bookId);
    if (!book || !book.isActive) {
      res.status(404).json({ success: false, message: 'Book not found or inactive' });
      return;
    }

    if (book.available < 1) {
      res.status(400).json({ success: false, message: 'Book is currently out of stock' });
      return;
    }

    const user = await User.findById(userId);
    if (!user || !user.isActive || user.isSuspended) {
      res.status(400).json({ success: false, message: 'User not valid for borrowing books' });
      return;
    }

    const existingBorrow = await Borrow.findOne({ userId, bookId, status: 'borrowed' });
    if (existingBorrow) {
      res.status(400).json({ success: false, message: 'User already has this book borrowed' });
      return;
    }

    const calculatedReturnDate = returnDate ? new Date(returnDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const borrow = await Borrow.create({
      userId,
      bookId,
      borrowDate: new Date(),
      returnDate: calculatedReturnDate,
      status: 'borrowed'
    });

    book.available -= 1;
    book.currentlyIssued += 1;
    book.totalIssued += 1;
    await book.save();

    user.totalBooksIssued += 1;
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Book issued successfully',
      data: borrow
    });
  } catch (error: any) {
    next(error);
  }
};

export const returnBook = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;
    const adminId = req.user?._id;

    const borrow = await Borrow.findById(id).populate('bookId');
    if (!borrow) {
      res.status(404).json({ success: false, message: 'Borrow record not found' });
      return;
    }

    if (borrow.status !== 'borrowed') {
      res.status(400).json({ success: false, message: 'Book already returned or marked otherwise' });
      return;
    }

    const returnDate = new Date();
    borrow.actualReturnDate = returnDate;
    borrow.status = 'returned';
    borrow.remarks = remarks;
    borrow.returnedBy = adminId as any;
    borrow.returnedAt = returnDate;

    let fineAmount = 0;
    if (returnDate > borrow.returnDate) {
      const diffTime = Math.abs(returnDate.getTime() - borrow.returnDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      borrow.isOverdue = true;
      borrow.daysOverdue = diffDays;
      fineAmount = diffDays * 20;
      borrow.fine = fineAmount;
      borrow.fineCalculated = true;

      await Fine.create({
        userId: borrow.userId,
        borrowId: borrow._id,
        bookId: borrow.bookId,
        amount: fineAmount,
        daysOverdue: diffDays,
        finePerDay: 20
      });

      await User.findByIdAndUpdate(borrow.userId, {
        $inc: { totalFinesGenerated: fineAmount }
      });
    }

    await borrow.save();

    const book = await Book.findById(borrow.bookId);
    if (book) {
      book.available += 1;
      book.currentlyIssued -= 1;
      await book.save();
    }

    await User.findByIdAndUpdate(borrow.userId, {
      $inc: { totalBooksReturned: 1 }
    });

    res.json({
      success: true,
      message: 'Book returned successfully',
      data: borrow,
      fine: fineAmount > 0 ? { amount: fineAmount, daysOverdue: borrow.daysOverdue } : null
    });
  } catch (error: any) {
    next(error);
  }
};

export const getUserHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const borrows = await Borrow.find({ userId: req.user?._id })
      .populate('bookId', 'title author bookImage')
      .sort({ borrowDate: -1 });

    res.json({
      success: true,
      data: borrows
    });
  } catch (error: any) {
    next(error);
  }
};

export const getAllBorrows = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const borrows = await Borrow.find({})
      .populate('bookId', 'title author')
      .populate('userId', 'name email')
      .sort({ borrowDate: -1 });

    res.json({
      success: true,
      data: borrows
    });
  } catch (error: any) {
    next(error);
  }
};

export const payFine = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const borrow = await Borrow.findById(id);
    if (!borrow) {
      res.status(404).json({ success: false, message: 'Borrow record not found' });
      return;
    }

    if (borrow.fine === 0 || borrow.finePaid) {
      res.status(400).json({ success: false, message: 'No pending fine for this record' });
      return;
    }

    borrow.finePaid = true;
    await borrow.save();

    await Fine.findOneAndUpdate({ borrowId: borrow._id }, { status: 'paid', paymentDate: new Date() });

    res.json({
      success: true,
      message: 'Fine cleared successfully',
      data: borrow
    });
  } catch (error: any) {
    next(error);
  }
};
