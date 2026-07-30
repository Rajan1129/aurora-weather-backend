import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const checkUsers = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/aurora-weather');
    console.log('Connected to MongoDB');
    const users = await mongoose.connection.db.collection('users').find({}).toArray();
    console.log('Users:', users.map(u => ({ email: u.email, role: u.role, password: u.password })));
    
    // Also test comparing 'admin123'
    const adminUser = users.find(u => u.email === 'admin@auroraweather.com');
    if (adminUser) {
       const isMatch = await bcrypt.compare('admin123', adminUser.password);
       console.log('admin@auroraweather.com password "admin123" matches:', isMatch);
    }
    
    // Test demo
    const demoUser = users.find(u => u.email === 'demo@example.com');
    if (demoUser) {
       const isMatch = await bcrypt.compare('password123', demoUser.password);
       console.log('demo@example.com password "password123" matches:', isMatch);
    }

    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
checkUsers();
