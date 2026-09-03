import express from 'express';
import { getUsers, suspendUser, updateProfile } from '../controllers/userController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
const router = express.Router();

router.get('/', authenticate, authorize('admin'), getUsers);
router.put('/:id/suspend', authenticate, authorize('admin'), suspendUser);
router.put('/profile/update', authenticate, updateProfile);

export default router;
