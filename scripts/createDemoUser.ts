import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/paveos';

const createDemoUser = async () => {
  try {
    console.log('🌱 Creating demo user...');

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if demo user already exists
    let demoUser = await User.findOne({ email: 'demo@paveos.com' });

    if (demoUser) {
      console.log('ℹ️  Demo user already exists');
      console.log('📧 Email: demo@paveos.com');
      console.log('🔑 Password: demo123');
    } else {
      // Create demo user
      demoUser = await User.create({
        name: 'Demo User',
        email: 'demo@paveos.com',
        password: 'demo123',
        role: 'creator',
        subscriptionPlan: 'Pro',
      });
      console.log('✅ Demo user created successfully!');
      console.log('\n💡 Use these credentials to login:');
      console.log('   📧 Email: demo@paveos.com');
      console.log('   🔑 Password: demo123\n');
    }

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error creating demo user:', error);
    process.exit(1);
  }
};

createDemoUser();
