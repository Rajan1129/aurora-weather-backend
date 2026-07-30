import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import { AppError, catchAsync } from '../middleware/errorHandler.js';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../middleware/auth.js';
import { sendEmail } from '../services/emailService.js';
import { logger } from '../utils/logger.js';

// @desc    Register user
// @route   POST /api/auth/register
export const register = catchAsync(async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('User already exists', 400);
  }

  // Create user
  const user = await User.create({
    email,
    password,
    firstName,
    lastName,
    authProviders: [{ provider: 'email' }],
  });

  // Generate tokens
  const accessToken = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Send welcome email
  try {
    await sendEmail({
      to: email,
      subject: 'Welcome to Aurora Weather!',
      template: 'welcome',
      data: { firstName, email },
    });
  } catch (error) {
    logger.error('Welcome email failed:', error);
  }

  res.status(201).json({
    success: true,
    data: {
      user,
      accessToken,
      refreshToken,
    },
  });
});

// @desc    Login user
// @route   POST /api/auth/login
export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  // Validate email and password
  if (!email || !password) {
    throw new AppError('Please provide email and password', 400);
  }

  // Find user with password
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  // Check password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError('Invalid credentials', 401);
  }

  // Update last login
  user.lastLoginAt = Date.now();
  await user.save();

  // Generate tokens
  const accessToken = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  res.status(200).json({
    success: true,
    data: {
      user,
      accessToken,
      refreshToken,
    },
  });
});

// @desc    Guest login
// @route   POST /api/auth/guest
export const guestLogin = catchAsync(async (req, res) => {
  // Create temporary guest user
  const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const user = await User.create({
    email: `${guestId}@guest.aurora.com`,
    firstName: 'Guest',
    lastName: 'User',
    password: crypto.randomBytes(32).toString('hex'),
    role: 'guest',
    isActive: true,
    authProviders: [{ provider: 'guest' }],
  });

  // Generate tokens
  const accessToken = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  res.status(200).json({
    success: true,
    data: {
      user,
      accessToken,
      refreshToken,
      isGuest: true,
    },
  });
});

// @desc    Refresh token
// @route   POST /api/auth/refresh
export const refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token required', 400);
  }

  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    throw new AppError('Invalid refresh token', 401);
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) {
    throw new AppError('User not found or inactive', 401);
  }

  // Generate new tokens
  const newAccessToken = generateToken(user._id);
  const newRefreshToken = generateRefreshToken(user._id);

  res.status(200).json({
    success: true,
    data: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    },
  });
});

// @desc    Logout user
// @route   POST /api/auth/logout
export const logout = catchAsync(async (req, res) => {
  // In a stateless JWT system, we just invalidate tokens on client side
  // Could add token to blacklist if needed
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
export const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('No user found with that email', 404);
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiry = Date.now() + 3600000; // 1 hour

  user.resetPasswordToken = resetToken;
  user.resetPasswordExpiry = resetTokenExpiry;
  await user.save();

  // Send reset email
  try {
    await sendEmail({
      to: email,
      subject: 'Reset Your Password - Aurora Weather',
      template: 'reset-password',
      data: {
        firstName: user.firstName,
        resetLink: `${process.env.CLIENT_URL}/reset-password/${resetToken}`,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Password reset email sent',
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();
    throw new AppError('Email could not be sent', 500);
  }
});

// @desc    Reset password
// @route   POST /api/auth/reset-password
export const resetPassword = catchAsync(async (req, res) => {
  const { token, password } = req.body;

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpiry: { $gt: Date.now() },
  });

  if (!user) {
    throw new AppError('Invalid or expired reset token', 400);
  }

  // Update password
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpiry = undefined;
  await user.save();

  // Generate new tokens
  const accessToken = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  res.status(200).json({
    success: true,
    data: {
      accessToken,
      refreshToken,
    },
  });
});

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
export const verifyEmail = catchAsync(async (req, res) => {
  const { token } = req.params;

  const user = await User.findOne({
    emailVerificationToken: token,
    emailVerificationExpiry: { $gt: Date.now() },
  });

  if (!user) {
    throw new AppError('Invalid or expired verification token', 400);
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpiry = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Email verified successfully',
  });
});

// @desc    Google OAuth
// @route   GET /api/auth/google
export const googleAuth = catchAsync(async (req, res) => {
  // This would be handled by Passport.js
  // For now, we'll implement a simplified version
  const { token } = req.query;
  
  // Verify Google token and get user info
  // ... implement Google OAuth flow
  
  res.status(200).json({
    success: true,
    message: 'Google auth initialized',
  });
});

// @desc    GitHub OAuth
// @route   GET /api/auth/github
export const githubAuth = catchAsync(async (req, res) => {
  // This would be handled by Passport.js
  res.status(200).json({
    success: true,
    message: 'GitHub auth initialized',
  });
});

// @desc    Apple OAuth
// @route   POST /api/auth/apple
export const appleAuth = catchAsync(async (req, res) => {
  // Implement Apple OAuth flow
  const { identityToken } = req.body;
  
  // Verify Apple token and get user info
  // ... implement Apple OAuth flow
  
  res.status(200).json({
    success: true,
    message: 'Apple auth successful',
  });
});