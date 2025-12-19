import mongoose from 'mongoose';
import { config } from 'dotenv';
import { DiscordConnection } from '../src/models/DiscordConnection.js';
import { User } from '../src/models/User.js';

// Load environment variables
config();

const MONGODB_URI = process.env.MONGODB_URI || '';

async function checkAllConnections() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find ALL Discord connections
    const connections = await DiscordConnection.find({}).sort({ connectedAt: -1 });

    console.log(`📊 Found ${connections.length} Discord connection(s):\n`);

    for (const conn of connections) {
      // Get user info
      const user = await User.findById(conn.userId);
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📋 Connection ID: ${conn._id}`);
      console.log(`   User ID: ${conn.userId}`);
      console.log(`   User Email: ${user?.email || 'USER NOT FOUND!'}`);
      console.log(`   Discord User ID: ${conn.discordUserId || 'NOT SET'}`);
      console.log(`   Discord Username: ${conn.discordUsername || 'NOT SET'}`);
      console.log(`   Guild ID: ${conn.discordGuildId || 'NOT SET'}`);
      console.log(`   Guild Name: ${conn.discordGuildName || 'NOT SET'}`);
      console.log(`   Is Active: ${conn.isActive}`);
      console.log(`   Connected At: ${conn.connectedAt}`);
      console.log(`   Last Sync: ${conn.lastSyncAt || 'Never'}`);
      console.log(`   Synced Members: ${conn.syncedMembersCount || 0}`);
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (connections.length === 0) {
      console.log('ℹ️  No Discord connections found.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

checkAllConnections();
