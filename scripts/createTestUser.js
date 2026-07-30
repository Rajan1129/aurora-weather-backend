// scripts/createTestUser.js
import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../src/models/User.js';

dotenv.config();

const createTestUser = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aurora-weather';
    console.log(`🔗 Connecting to MongoDB: ${mongoURI}`);
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    // Test user data
    const testUsers = [
      {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
      },
      {
        email: 'admin@auroraweather.com',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
      },
      {
        email: 'demo@example.com',
        password: 'demo123',
        firstName: 'Demo',
        lastName: 'User',
        role: 'user',
      }
    ];

    for (const userData of testUsers) {
      // Check if user exists
      const existingUser = await User.findOne({ email: userData.email });
      
      // Hash password
      const salt = await bcryptjs.genSalt(12);
      const hashedPassword = await bcryptjs.hash(userData.password, salt);
      
      if (existingUser) {
        console.log(`⚠️ User ${userData.email} already exists, updating password...`);
        existingUser.password = hashedPassword;
        existingUser.isActive = true;
        existingUser.isEmailVerified = true;
        await existingUser.save();
        console.log(`✅ Password updated for ${userData.email}`);
      } else {
        console.log(`📝 Creating new user: ${userData.email}`);
        const user = new User({
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role || 'user',
          isActive: true,
          isEmailVerified: true,
          authProviders: [{ provider: 'email' }],
        });
        
        await user.save();
        console.log(`✅ User created: ${userData.email}`);
      }
    }

    console.log('\n📋 Test User Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    testUsers.forEach(user => {
      console.log(`📧 ${user.email}`);
      console.log(`🔑 ${user.password}`);
      console.log(`👤 Role: ${user.role || 'user'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

createTestUser();