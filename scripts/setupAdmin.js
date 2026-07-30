import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

dotenv.config();

const setupAdmin = async () => {
  try {
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aurora-weather');
    console.log('✅ Connected to MongoDB');

    // Delete existing admin
    const deleted = await User.deleteOne({ email: 'admin@auroraweather.com' });
    if (deleted.deletedCount > 0) {
      console.log('🗑️ Removed existing admin user');
    }

    // Hash the password
    console.log('🔑 Hashing password...');
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    console.log('✅ Password hashed');

    // Create admin user
    console.log('📝 Creating admin user...');
    const admin = new User({
      email: 'admin@auroraweather.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      isActive: true,
      authProviders: [{ provider: 'email' }],
      preferences: {
        units: 'metric',
        theme: 'auto',
        language: 'en',
        notifications: {
          weatherAlerts: true,
          dailySummary: true,
          aiRecommendations: true,
          marketing: false,
        }
      },
      subscription: {
        plan: 'free',
        status: 'active'
      }
    });

    await admin.save();
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin@auroraweather.com');
    console.log('🔑 Password: admin123');
    console.log('📌 Role: admin');

    // Verify the user was created
    console.log('🔍 Verifying admin user...');
    const verify = await User.findOne({ email: 'admin@auroraweather.com' });
    console.log('🔍 Verification - User found:', verify ? 'Yes' : 'No');
    console.log('🔍 Verification - Role:', verify?.role);
    console.log('🔍 Verification - Has password:', verify?.password ? 'Yes' : 'No');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    console.log('\n🎉 Admin setup complete!');
    console.log('Login with:');
    console.log('  📧 Email: admin@auroraweather.com');
    console.log('  🔑 Password: admin123');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

setupAdmin();