import { v2 as cloudinaryV2 } from 'cloudinary';
import { config } from './environment.js';

export const cloudinary = cloudinaryV2;

const isCloudinaryConfigured = Boolean(
  config.cloudinary.cloudName &&
  config.cloudinary.apiKey &&
  config.cloudinary.apiSecret
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
} else if (config.env !== 'test') {
  console.warn(
    '[cloudinary] Warning: Cloudinary configuration is incomplete. ' +
    'Set CLOUD_NAME, API_KEY, and API_SECRET in .env to enable image uploads.'
  );
}

export const CLOUDINARY_ALLOWED_FORMATS = ['png', 'jpg', 'jpeg', 'webp'] as const;
export type CloudinaryAllowedFormat = typeof CLOUDINARY_ALLOWED_FORMATS[number];

export const CLOUDINARY_BOOK_COVER_MAX_BYTES = 4 * 1024 * 1024;
export const CLOUDINARY_SIGNATURE_TTL_SECONDS = 3600;

export function generateCloudinaryUploadSignature(params?: {
  folder?: string;
  uploadPreset?: string;
  timestamp?: number;
}) {
  if (!isCloudinaryConfigured) {
    throw new Error('Cloudinary is not configured on the server');
  }

  const timestamp = params?.timestamp ?? Math.floor(Date.now() / 1000);
  const folder = params?.folder || config.cloudinary.folder || '';
  const uploadPreset = params?.uploadPreset || config.cloudinary.uploadPreset || '';

  const paramsToSign: Record<string, any> = {
    timestamp,
  };
  if (folder) paramsToSign.folder = folder;
  if (uploadPreset) paramsToSign.upload_preset = uploadPreset;
  paramsToSign.allowed_formats = CLOUDINARY_ALLOWED_FORMATS.join(',');

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    config.cloudinary.apiSecret
  );

  return {
    signature,
    timestamp,
    folder: folder || undefined,
    uploadPreset: uploadPreset || undefined,
    cloudName: config.cloudinary.cloudName,
    apiKey: config.cloudinary.apiSecret ? config.cloudinary.apiKey : '',
    allowedFormats: CLOUDINARY_ALLOWED_FORMATS,
    maxBytes: CLOUDINARY_BOOK_COVER_MAX_BYTES,
    expiresAt: new Date((timestamp + CLOUDINARY_SIGNATURE_TTL_SECONDS) * 1000).toISOString(),
  };
}

export function isValidCloudinaryUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length === 0) return false;
  try {
    const u = new URL(url);
    if (!u.protocol.startsWith('http')) return false;
    if (!u.hostname.endsWith('cloudinary.com') && !u.hostname.includes('res.cloudinary')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function parseCloudinaryBookImagePayload(payload: unknown): {
  url: string;
  path: string;
  uploadedAt: Date;
} | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as any;

  if (typeof p.imageUrl === 'string' && isValidCloudinaryUrl(p.imageUrl)) {
    return {
      url: p.imageUrl,
      path: p.cloudinaryPath || p.imageUrl,
      uploadedAt: new Date(),
    };
  }

  if (typeof p.bookImage?.url === 'string' && isValidCloudinaryUrl(p.bookImage.url)) {
    return {
      url: p.bookImage.url,
      path: p.bookImage.path || p.bookImage.url,
      uploadedAt: p.bookImage.uploadedAt ? new Date(p.bookImage.uploadedAt) : new Date(),
    };
  }

  if (typeof p.bookImage === 'string' && isValidCloudinaryUrl(p.bookImage)) {
    return {
      url: p.bookImage,
      path: p.bookImage,
      uploadedAt: new Date(),
    };
  }

  return null;
}

export { isCloudinaryConfigured };
