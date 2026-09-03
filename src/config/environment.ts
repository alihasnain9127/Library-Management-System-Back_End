import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length > 0 && process.env.NODE_ENV !== 'test') {
  console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  mongoose: {
    url: process.env.MONGO_URI || 'mongodb://localhost:27017/library_management_system',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production_please_use_strong_secret',
    accessExpirationMinutes: parseInt(process.env.JWT_EXPIRES_IN_MINUTES || '60', 10),
    accessExpirationDays: process.env.JWT_EXPIRES_IN || '1d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_jwt_refresh_secret_change_in_production_please',
    refreshExpirationDays: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  rateLimit: {
    globalWindowMs: 15 * 60 * 1000,
    globalMaxRequests: 100,
    authWindowMs: 15 * 60 * 1000,
    authMaxRequests: 5,
  },
  upload: {
    maxFileSizeBytes: 50 * 1024 * 1024,
    maxGeneralPayloadBytes: 10 * 1024 * 1024,
    allowedMimeTypes: /jpeg|jpg|png|webp/,
    bookCoverMaxBytes: 4 * 1024 * 1024,
    bookCoverAllowedFormats: ['png', 'jpg', 'jpeg', 'webp'] as const,
  },
  cloudinary: {
    cloudName: process.env.CLOUD_NAME || '',
    apiKey: process.env.API_KEY || '',
    apiSecret: process.env.API_SECRET || '',
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || '',
    folder: process.env.CLOUDINARY_FOLDER || '',
  }
};
