import express from 'express';
import { issueBook, returnBook, getUserHistory, getAllBorrows, payFine, userBorrowBook } from '../controllers/borrowController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
const router = express.Router();

router.post('/issue', authenticate, authorize('admin'), issueBook);
router.post('/borrow', authenticate, userBorrowBook);
router.post('/return/:id', authenticate, authorize('admin'), returnBook);
router.get('/history', authenticate, getUserHistory);
router.get('/admin/all', authenticate, authorize('admin'), getAllBorrows);
router.put('/pay-fine/:id', authenticate, authorize('admin'), payFine);

export default router;
