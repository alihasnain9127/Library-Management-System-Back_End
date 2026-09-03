import { Request, Response } from 'express';
import { Book } from '../models/Book.js';
import { Borrow } from '../models/Borrow.js';
import { User } from '../models/User.js';
import { Fine } from '../models/Fine.js';

export const getDashboardStats = async (req: Request, res: Response) => {
  const totalBooks = await Book.countDocuments();
  const totalUsers = await User.countDocuments({ role: 'user' });
  const activeIssues = await Borrow.countDocuments({ status: 'borrowed' });
  
  const finesResult = await Fine.aggregate([
    { $match: { status: 'pending' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const pendingFines = finesResult.length > 0 ? finesResult[0].total : 0;

  res.json({
    success: true,
    data: {
      totalBooks,
      totalUsers,
      activeIssues,
      pendingFines
    }
  });
};
