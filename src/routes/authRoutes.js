import express from 'express';
import { 
  register, 
  login, 
  guestLogin,
  refreshToken, 
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  googleAuth,
  githubAuth,
  appleAuth,
} from '../controllers/authController.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/guest', authRateLimiter, guestLogin);
router.post('/refresh', refreshToken);
router.post('/forgot-password', authRateLimiter, forgotPassword);
router.post('/reset-password', authRateLimiter, resetPassword);
router.get('/verify-email/:token', verifyEmail);

// OAuth routes
router.get('/google', googleAuth);
router.get('/github', githubAuth);
router.post('/apple', appleAuth);

// Protected routes
router.post('/logout', protect, logout);

export default router;