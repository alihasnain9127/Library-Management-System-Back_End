import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import {
  generateCloudinaryUploadSignature,
  CLOUDINARY_BOOK_COVER_MAX_BYTES,
  CLOUDINARY_ALLOWED_FORMATS,
  isCloudinaryConfigured,
  isValidCloudinaryUrl,
} from '../config/cloudinary.js';

const router = express.Router();

router.get(
  '/cloudinary-signature',
  authenticate,
  authorize('admin'),
  (_req, res) => {
    if (!isCloudinaryConfigured) {
      return res.status(503).json({
        status: 'error',
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Cloudinary credentials are not configured on the server',
        code: 'CLOUDINARY_NOT_CONFIGURED',
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const signature = generateCloudinaryUploadSignature();
      return res.status(200).json({
        status: 'success',
        statusCode: 200,
        data: signature,
        message: 'Cloudinary upload signature generated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(500).json({
        status: 'error',
        statusCode: 500,
        error: 'Internal Server Error',
        message: err.message || 'Failed to generate Cloudinary signature',
        code: 'SIGNATURE_GENERATION_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

router.post(
  '/validate-image-url',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const { imageUrl } = req.body;

      if (!imageUrl || typeof imageUrl !== 'string') {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          error: 'Bad Request',
          message: 'imageUrl is required in the request body',
          code: 'MISSING_IMAGE_URL',
          timestamp: new Date().toISOString(),
        });
      }

      const url = new URL(imageUrl);
      if (!url.protocol.startsWith('http')) {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          error: 'Bad Request',
          message: 'imageUrl must start with http:// or https://',
          code: 'INVALID_PROTOCOL',
          timestamp: new Date().toISOString(),
        });
      }

      const isCloudinary = isValidCloudinaryUrl(imageUrl);

      return res.status(200).json({
        status: 'success',
        statusCode: 200,
        data: {
          valid: true,
          isCloudinary,
          host: url.hostname,
        },
        message: 'Image URL validated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        error: 'Bad Request',
        message: err.message || 'Invalid imageUrl format',
        code: 'INVALID_URL_FORMAT',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

router.get('/limits', authenticate, (_req, res) => {
  res.status(200).json({
    status: 'success',
    statusCode: 200,
    data: {
      maxFileSizeBytes: CLOUDINARY_BOOK_COVER_MAX_BYTES,
      maxFileSizeMB: CLOUDINARY_BOOK_COVER_MAX_BYTES / (1024 * 1024),
      allowedFormats: CLOUDINARY_ALLOWED_FORMATS,
      allowedMimeTypes: [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/webp',
      ],
      cloudinaryConfigured: isCloudinaryConfigured,
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
