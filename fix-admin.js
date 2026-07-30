import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const fixAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');

    const email = 'admin@auroraweather.com';
    const plainTextPassword = 'admin123';

    // Hash password properly
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(plainTextPassword, salt);

    // Update user
    const result = await mongoose.connection.db.collection('users').updateOne(
      { email: email },
      { 
        $set: { 
          password: hashedPassword,
          role: 'admin'
        } 
      }
    );

    if (result.matchedCount > 0) {
      console.log(`✅ User ${email} updated successfully!`);
      console.log(`🔑 New Password: ${plainTextPassword}`);
    } else {
      console.log(`❌ User ${email} not found.`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixAdmin();
