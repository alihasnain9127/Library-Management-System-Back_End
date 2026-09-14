import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Book } from '../models/Book.js';
import { Borrow } from '../models/Borrow.js';
import { User } from '../models/User.js';
import { Fine } from '../models/Fine.js';

interface CacheEntry {
  timestamp: number;
  data: any;
}

let statsCache: CacheEntry | null = null;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds TTL

export const getDashboardStats = async (req: Request, res: Response) => {
  const forceRefresh = req.query.refresh === 'true' || req.query.refresh === '1';
  const nowTime = Date.now();

  // Return cached result if still within TTL and force refresh wasn't requested
  if (!forceRefresh && statsCache && nowTime - statsCache.timestamp < CACHE_TTL_MS) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    return res.json({
      success: true,
      data: statsCache.data,
      cachedAt: new Date(statsCache.timestamp).toISOString(),
      isCached: true,
    });
  }

  const nowDate = new Date();
  const startOfMonth = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // 1. Members metrics
  const totalUsers = await User.countDocuments({ role: 'user' });
  const newMembersThisMonth = await User.countDocuments({
    role: 'user',
    createdAt: { $gte: startOfMonth },
  });

  // 2. Book catalog metrics
  const totalUniqueBooks = await Book.countDocuments({ isActive: true });
  const totalStockAgg = await Book.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: null, totalQuantity: { $sum: '$quantity' }, totalAvailable: { $sum: '$available' } } },
  ]);
  const totalStock = totalStockAgg[0]?.totalQuantity || 0;
  const totalAvailable = totalStockAgg[0]?.totalAvailable || 0;
  const newBooksThisMonth = await Book.countDocuments({
    isActive: true,
    createdAt: { $gte: startOfMonth },
  });

  // 3. Circulation & loan metrics
  const activeIssues = await Borrow.countDocuments({ status: 'borrowed' });
  const utilizationRate = totalStock > 0 ? Math.round((activeIssues / totalStock) * 100) : 0;

  // 4. Overdue counts
  const overdueCount = await Borrow.countDocuments({
    status: 'borrowed',
    returnDate: { $lt: nowDate },
  });

  // 5. Fines calculations
  const finesResult = await Fine.aggregate([
    { $match: { status: 'pending' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const pendingFines = finesResult.length > 0 ? finesResult[0].total : 0;

  const collectedTodayAgg = await Fine.aggregate([
    { $match: { status: 'paid', paymentDate: { $gte: startOfToday } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const collectedToday = collectedTodayAgg[0]?.total || 0;

  // 6. System health
  const isDbConnected = mongoose.connection.readyState === 1;
  const systemHealthScore = isDbConnected ? '100%' : 'Degraded';

  // 7. Circulation Trends: past 14 days aggregation
  const daysToTrack = 14;
  const daysList: { dateStr: string; label: string }[] = [];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (daysToTrack - 1));
  cutoffDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < daysToTrack; i++) {
    const d = new Date(cutoffDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
    daysList.push({ dateStr, label });
  }

  const issuedAgg = await Borrow.aggregate([
    { $match: { borrowDate: { $gte: cutoffDate } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$borrowDate' } },
        count: { $sum: 1 },
      },
    },
  ]);

  const returnedAgg = await Borrow.aggregate([
    { $match: { status: 'returned', actualReturnDate: { $gte: cutoffDate } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$actualReturnDate' } },
        count: { $sum: 1 },
      },
    },
  ]);

  const issuedMap = new Map(issuedAgg.map((item) => [item._id, item.count]));
  const returnedMap = new Map(returnedAgg.map((item) => [item._id, item.count]));

  const monthlyCirculation = daysList.map((item) => ({
    day: item.label,
    issued: issuedMap.get(item.dateStr) || 0,
    returned: returnedMap.get(item.dateStr) || 0,
  }));

  // 8. Top Books
  const topBooksDocs = await Book.find({ isActive: true })
    .sort({ totalIssued: -1, currentlyIssued: -1 })
    .limit(5)
    .select('title totalIssued');

  const palette = ['#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#ef4444'];
  const topBooks = topBooksDocs.map((b, idx) => ({
    name: b.title,
    borrows: b.totalIssued || 0,
    color: palette[idx % palette.length],
  }));

  // 9. Critical Overdue Accounts
  const overdueBorrows = await Borrow.find({
    status: 'borrowed',
    returnDate: { $lt: nowDate },
  })
    .populate('bookId', 'title')
    .populate('userId', 'name')
    .sort({ returnDate: 1 })
    .limit(5);

  const overdueAlerts = overdueBorrows.map((rec) => {
    const bookTitle = (rec.bookId as any)?.title || 'Academic Title';
    const userName = (rec.userId as any)?.name || 'Library Member';
    const diffMs = Math.max(0, nowDate.getTime() - new Date(rec.returnDate).getTime());
    const daysLate = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const fineAmount = daysLate * 20;

    return {
      _id: rec._id,
      book: bookTitle,
      user: userName,
      days: daysLate,
      fine: fineAmount,
    };
  });

  // 10. Depleted Stock Watchlist
  const depletedDocs = await Book.find({
    isActive: true,
    available: { $lte: 2 },
  })
    .sort({ available: 1 })
    .limit(5)
    .select('title category available quantity');

  const depletedStock = depletedDocs.map((b) => ({
    _id: b._id,
    book: b.title,
    category: b.category || 'General',
    remaining: b.available,
    total: b.quantity,
  }));

  // 11. Formatted KPI metric tiles
  const metrics = [
    {
      id: 'members',
      title: 'Total Members',
      value: totalUsers.toLocaleString(),
      change: `+${newMembersThisMonth}`,
      changeLabel: 'this month',
      trend: 'up',
      type: 'info',
    },
    {
      id: 'catalog',
      title: 'Book Catalog',
      value: totalUniqueBooks.toLocaleString(),
      change: `+${newBooksThisMonth}`,
      changeLabel: 'new entries',
      trend: 'up',
      type: 'info',
    },
    {
      id: 'issued',
      title: 'Currently Issued',
      value: activeIssues.toLocaleString(),
      change: `${utilizationRate}%`,
      changeLabel: 'active utilization',
      trend: 'up',
      type: 'success',
    },
    {
      id: 'overdue',
      title: 'Overdue Rotations',
      value: overdueCount.toLocaleString(),
      change: overdueCount > 0 ? `${overdueCount} Items` : 'Clean',
      changeLabel: overdueCount > 0 ? 'action required' : 'on schedule',
      trend: overdueCount > 0 ? 'down' : 'up',
      type: overdueCount > 0 ? 'danger' : 'success',
    },
    {
      id: 'fines',
      title: 'Pending Fines',
      value: `Rs. ${pendingFines.toLocaleString()}`,
      change: `Rs. ${collectedToday.toLocaleString()}`,
      changeLabel: 'collected today',
      trend: 'up',
      type: 'warning',
    },
    {
      id: 'health',
      title: 'System Health',
      value: systemHealthScore,
      change: 'All APIs',
      changeLabel: 'operational',
      trend: 'up',
      type: 'success',
    },
  ];

  const responsePayload = {
    raw: {
      totalBooks: totalUniqueBooks,
      totalStock,
      totalAvailable,
      totalUsers,
      activeIssues,
      overdueCount,
      pendingFines,
      collectedToday,
    },
    metrics,
    monthlyCirculation,
    topBooks,
    overdueAlerts,
    depletedStock,
    lastUpdated: new Date().toISOString(),
  };

  // Cache response in memory
  statsCache = {
    timestamp: nowTime,
    data: responsePayload,
  };

  res.setHeader('X-Cache', 'MISS');
  res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');

  res.json({
    success: true,
    data: responsePayload,
    cachedAt: new Date(nowTime).toISOString(),
    isCached: false,
  });
};

