import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aurora-weather');
    console.log('✅ Connected to MongoDB');

    // Delete existing
    await mongoose.connection.db.collection('users').deleteOne({ email: 'admin@auroraweather.com' });
    console.log('🗑️ Removed existing admin');

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    // Insert admin
    await mongoose.connection.db.collection('users').insertOne({
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
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ Admin created successfully!');
    console.log('📧 Email: admin@auroraweather.com');
    console.log('🔑 Password: admin123');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

createAdmin();