import rateLimit from 'express-rate-limit';
import { AppError } from './errorHandler.js';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    throw new AppError('Too many requests, please try again later.', 429);
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit each IP to 10 auth requests per 5 minutes
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per minute
  message: {
    success: false,
    error: 'API rate limit exceeded, please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const premiumRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // premium users get higher limit
  message: {
    success: false,
    error: 'Rate limit exceeded.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for premium users
    return req.user?.subscription?.status === 'active' && 
           req.user?.subscription?.plan !== 'free';
  },
});