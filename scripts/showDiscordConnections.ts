import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { DiscordConnection } from '../src/models/DiscordConnection.js';
import { User } from '../src/models/User.js';
import { Lead } from '../src/models/Lead.js';

dotenv.config();

async function showConnections() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    const connections = await DiscordConnection.find({}).lean();
    const users = await User.find({}).lean();
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    console.log('🔌 Discord Connections:\n');

    for (const conn of connections) {
      const user = userMap.get(conn.userId.toString());
      console.log(`Connection ${conn._id}:`);
      console.log(`   User: ${user?.email || conn.userId}`);
      console.log(`   Company: ${conn.whopCompanyId || 'none'}`);
      console.log(`   Discord User: ${conn.discordUsername} (${conn.discordUserId})`);
      console.log(`   Guild: ${conn.discordGuildName} (${conn.discordGuildId})`);
      console.log(`   Active: ${conn.isActive}`);
      console.log(`   Connected: ${conn.connectedAt}`);
      console.log(`   Synced Members: ${conn.syncedMembersCount || 0}`);

      // Check leads for this connection
      const leads = await Lead.find({
        userId: conn.userId,
      }).lean();

      console.log(`   Leads: ${leads.length}`);
      leads.forEach((lead, idx) => {
        console.log(`      ${idx + 1}. ${lead.name} (${lead.discordUserId})`);
      });

      console.log();
    }

    console.log(`\n📊 Total: ${connections.length} connections\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

showConnections();
