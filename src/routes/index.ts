import express from 'express';
import authRoutes from './authRoutes.js';
import bookRoutes from './bookRoutes.js';
import borrowRoutes from './borrowRoutes.js';
import userRoutes from './userRoutes.js';
import fineRoutes from './fineRoutes.js';
import reportRoutes from './reportRoutes.js';
import uploadRoutes from './uploadRoutes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/books', bookRoutes);
router.use('/borrow', borrowRoutes);
router.use('/circulation', borrowRoutes);
router.use('/users', userRoutes);
router.use('/fines', fineRoutes);
router.use('/reports', reportRoutes);
router.use('/upload', uploadRoutes);

export default router;
