import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const fixUser = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aurora-weather');
    console.log('✅ Connected to MongoDB');

    const email = 'demo@example.com';
    const plainTextPassword = 'password123';

    // Hash password properly
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(plainTextPassword, salt);

    // Update user
    const result = await mongoose.connection.db.collection('users').updateOne(
      { email: email },
      { 
        $set: { 
          password: hashedPassword,
          role: 'admin' // making sure they have admin role as they wanted
        } 
      }
    );

    if (result.matchedCount > 0) {
      console.log(`✅ User ${email} updated successfully!`);
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 New Password: ${plainTextPassword}`);
    } else {
      console.log(`❌ User ${email} not found in database.`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixUser();
