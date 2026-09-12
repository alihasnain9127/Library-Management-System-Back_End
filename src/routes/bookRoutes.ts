import express from 'express';
import { getBooks, getBookById, addBook, updateBook, deleteBook, bulkImportBooks } from '../controllers/bookController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { upload, uploadCsv } from '../middleware/upload.js';
import { fileUploadLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.route('/')
  .get(getBooks)
  .post(authenticate, authorize('admin'), fileUploadLimiter, upload.single('bookImage'), addBook);

router.post('/bulk-import', authenticate, authorize('admin'), fileUploadLimiter, uploadCsv.single('file'), bulkImportBooks);

router.route('/:id')
  .get(getBookById)
  .put(authenticate, authorize('admin'), fileUploadLimiter, upload.single('bookImage'), updateBook)
  .delete(authenticate, authorize('admin'), deleteBook);

export default router;
