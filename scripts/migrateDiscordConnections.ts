import mongoose from 'mongoose';
import { config } from 'dotenv';
import { DiscordConnection } from '../src/models/DiscordConnection.js';
import { User } from '../src/models/User.js';

// Load environment variables
config();

const MONGODB_URI = process.env.MONGODB_URI || '';

async function migrateConnections() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all Discord connections without whopCompanyId
    const connections = await DiscordConnection.find({
      $or: [
        { whopCompanyId: { $exists: false } },
        { whopCompanyId: null },
      ],
    });

    console.log(`📊 Found ${connections.length} connection(s) to migrate:\n`);

    let updated = 0;
    let skipped = 0;

    for (const conn of connections) {
      // Get user info
      const user = await User.findById(conn.userId);
      
      if (!user) {
        console.log(`⚠️  Connection ${conn._id}: User ${conn.userId} not found - SKIPPING`);
        skipped++;
        continue;
      }

      if (!user.whopCompanyId) {
        console.log(`ℹ️  Connection ${conn._id}: User ${user.email} has no whopCompanyId - setting to null`);
      }

      // Update connection with user's whopCompanyId
      conn.whopCompanyId = user.whopCompanyId;
      await conn.save();

      console.log(`✅ Connection ${conn._id}:`);
      console.log(`   User: ${user.email}`);
      console.log(`   Guild: ${conn.discordGuildName || 'NOT SET'}`);
      console.log(`   Company ID: ${user.whopCompanyId || 'NOT SET'}`);
      console.log('');
      
      updated++;
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Migration complete!`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${connections.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

migrateConnections();
