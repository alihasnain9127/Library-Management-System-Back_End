import express from 'express';
import { getDashboardStats } from '../controllers/reportController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
const router = express.Router();

router.get('/dashboard-stats', authenticate, authorize('admin'), getDashboardStats);

export default router;
