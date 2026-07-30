import express from 'express';
import { protect } from '../middleware/auth.js';
import User from '../models/User.js';
import cloudinary from 'cloudinary';
import multer from 'multer';
import { Readable } from 'stream';

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Upload avatar - Modified to handle guest users
router.post('/upload-avatar', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided',
      });
    }

    // Check if user exists in database
    let user = await User.findById(req.userId);
    
    // If user not found (guest), create a temporary user record
    if (!user) {
      // For guest users, we'll just return the uploaded URL without saving to DB
      // The frontend will store it in localStorage
      const uploadStream = cloudinary.uploader.upload_stream({
        folder: 'aurora-weather/temp-avatars',
        width: 300,
        height: 300,
        crop: 'fill',
        transformation: [
          { gravity: 'face', height: 300, width: 300, crop: 'thumb' },
          { radius: 'max' },
        ],
      }, async (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return res.status(500).json({
            success: false,
            error: 'Failed to upload image',
          });
        }

        // Return success with the URL for guest users
        return res.json({
          success: true,
          data: {
            url: result.secure_url,
            publicId: result.public_id,
            isGuest: true,
            message: 'Avatar uploaded successfully (guest mode)',
          },
        });
      });

      const bufferStream = new Readable();
      bufferStream.push(req.file.buffer);
      bufferStream.push(null);
      bufferStream.pipe(uploadStream);
      return;
    }

    // For registered users, save to database
    const uploadStream = cloudinary.uploader.upload_stream({
      folder: 'aurora-weather/avatars',
      width: 300,
      height: 300,
      crop: 'fill',
      transformation: [
        { gravity: 'face', height: 300, width: 300, crop: 'thumb' },
        { radius: 'max' },
      ],
    }, async (error, result) => {
      if (error) {
        console.error('Cloudinary upload error:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to upload image',
        });
      }

      // Update user avatar
      user.avatar = result.secure_url;
      await user.save();

      res.json({
        success: true,
        data: {
          url: result.secure_url,
          publicId: result.public_id,
          isGuest: false,
        },
      });
    });

    const bufferStream = new Readable();
    bufferStream.push(req.file.buffer);
    bufferStream.push(null);
    bufferStream.pipe(uploadStream);
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload avatar',
    });
  }
});

// Remove avatar
router.delete('/avatar', protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.json({
        success: true,
        message: 'Guest user avatar removed locally',
      });
    }

    if (user.avatar) {
      const publicId = user.avatar.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`aurora-weather/avatars/${publicId}`);
      user.avatar = null;
      await user.save();
    }

    res.json({
      success: true,
      message: 'Avatar removed successfully',
    });
  } catch (error) {
    console.error('Avatar removal error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove avatar',
    });
  }
});

export default router;