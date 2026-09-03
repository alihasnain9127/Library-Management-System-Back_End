import express from 'express';
import { getUserFines, payFine } from '../controllers/fineController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
const router = express.Router();

router.get('/my-fines', authenticate, getUserFines);
router.post('/pay/:id', authenticate, authorize('admin'), payFine);

export default router;
