import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI!;

async function checkUsers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not established');
    
    const usersCollection = db.collection('users');
    const users = await usersCollection.find({}).toArray();

    console.log(`\n📋 Found ${users.length} users:\n`);
    users.forEach((user: any) => {
      console.log(`👤 User ID: ${user._id}`);
      console.log(`   Name: ${user.name || 'N/A'}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   Whop ID: ${user.whopId || 'N/A'}`);
      console.log(`   Whop User ID: ${user.whopUserId || 'N/A'}`);
      console.log(`   Whop Company ID: ${user.whopCompanyId || 'N/A'}`);
      console.log('');
    });

    // Check Discord connections
    const discordCollection = db.collection('discordconnections');
    const connections = await discordCollection.find({}).toArray();
    
    console.log(`\n📡 Found ${connections.length} Discord connections:\n`);
    connections.forEach((conn: any) => {
      console.log(`🔗 User ID: ${conn.userId}`);
      console.log(`   Guild: ${conn.discordGuildName || 'N/A'}`);
      console.log(`   Active: ${conn.isActive}`);
      console.log(`   Username: ${conn.discordUsername || 'N/A'}`);
      console.log('');
    });

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUsers();
