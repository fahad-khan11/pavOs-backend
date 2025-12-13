import mongoose from 'mongoose';
import { config } from 'dotenv';
import { DiscordConnection } from '../src/models/DiscordConnection.js';

// Load environment variables
config();

const MONGODB_URI = process.env.MONGODB_URI || '';

async function cleanupInactiveConnections() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all inactive connections
    const inactiveConnections = await DiscordConnection.find({ isActive: false });

    console.log(`📊 Found ${inactiveConnections.length} inactive connection(s)\n`);

    for (const conn of inactiveConnections) {
      console.log(`🗑️  Deleting connection:`);
      console.log(`   Connection ID: ${conn._id}`);
      console.log(`   User ID: ${conn.userId}`);
      console.log(`   Guild: ${conn.discordGuildName || 'NOT SET'}`);
      console.log(`   Discord User: ${conn.discordUsername || 'NOT SET'}`);
      
      await DiscordConnection.deleteOne({ _id: conn._id });
      console.log(`   ✅ Deleted\n`);
    }

    console.log(`✅ Cleanup complete! Deleted ${inactiveConnections.length} inactive connection(s).`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

cleanupInactiveConnections();
