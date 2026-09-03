import { Request, Response } from 'express';
import { Fine } from '../models/Fine.js';
import { Borrow } from '../models/Borrow.js';
import { User } from '../models/User.js';

export const getUserFines = async (req: any, res: Response) => {
  const fines = await Fine.find({ userId: req.user._id })
    .populate('bookId', 'title')
    .sort({ generatedDate: -1 });

  res.json({
    success: true,
    data: fines
  });
};

export const payFine = async (req: any, res: Response) => {
  const { id } = req.params;
  const { paymentMethod, paymentReference } = req.body;

  const fine = await Fine.findById(id);
  if (!fine) {
    res.status(404);
    throw new Error('Fine not found');
  }

  if (fine.status === 'paid') {
    res.status(400);
    throw new Error('Fine is already paid');
  }

  fine.status = 'paid';
  fine.paymentDate = new Date();
  fine.paymentMethod = paymentMethod || 'cash';
  fine.paymentReference = paymentReference;

  await fine.save();

  // Update associated borrow record
  await Borrow.findByIdAndUpdate(fine.borrowId, { finePaid: true });

  // Update user stats
  await User.findByIdAndUpdate(fine.userId, {
    $inc: { totalFinesPaid: fine.amount }
  });

  res.json({
    success: true,
    message: 'Fine paid successfully',
    data: fine
  });
};
