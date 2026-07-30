import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const checkAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to Atlas');
    
    const adminUser = await mongoose.connection.db.collection('users').findOne({ email: 'admin@auroraweather.com' });
    if (!adminUser) {
      console.log('admin@auroraweather.com not found');
    } else {
      console.log('admin found, password hash:', adminUser.password);
      const isMatch = await bcrypt.compare('admin123', adminUser.password);
      console.log('admin123 matches?', isMatch);
    }

    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
checkAdmin();
