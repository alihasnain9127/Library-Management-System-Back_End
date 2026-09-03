import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

const createRateLimitHandler = (humanMessage: string) => {
  return (_req: Request, res: Response, _next: any, options: any) => {
    const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
    res.setHeader('Retry-After', retryAfterSeconds.toString());
    res.setHeader('RateLimit-Limit', options.max.toString());
    res.setHeader('RateLimit-Remaining', '0');
    res.setHeader('RateLimit-Reset', retryAfterSeconds.toString());
    res.status(429).json({
      status: 'error',
      statusCode: 429,
      error: 'Too Many Requests',
      message: humanMessage,
      retryAfter: retryAfterSeconds,
      rateLimit: {
        limit: options.max,
        remaining: 0,
        resetInSeconds: retryAfterSeconds
      },
      timestamp: new Date().toISOString()
    });
  };
};

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many requests from this IP address. Please try again after 15 minutes.'
  )
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many authentication attempts from this IP address. Maximum 5 attempts allowed per 15 minutes. Please try again later.'
  )
});

export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many password reset requests from this IP address. Maximum 5 attempts allowed per 15 minutes. Please try again later.'
  )
});

export const tokenRefreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many token refresh requests from this IP address. Maximum 10 attempts allowed per 15 minutes. Please try again later.'
  )
});

export const strictAuthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many failed authentication attempts. Account access temporarily restricted. Please try again after 1 hour.'
  )
});

export const fileUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many file upload requests from this IP address. Maximum 50 uploads allowed per hour. Please try again later.'
  )
});
