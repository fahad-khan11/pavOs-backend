import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Lead } from '../src/models/Lead.js';
import { DiscordConnection } from '../src/models/DiscordConnection.js';
import { DiscordMessage } from '../src/models/DiscordMessage.js';
import { User } from '../src/models/User.js';

dotenv.config();

async function cleanupCrossUserLeads() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    // Get all Discord connections
    const connections = await DiscordConnection.find({ isActive: true }).lean();
    const connectedDiscordUserIds = new Set(
      connections.map(c => c.discordUserId)
    );

    console.log(`🔌 Found ${connections.length} active Discord connections:`);
    for (const conn of connections) {
      const user = await User.findById(conn.userId);
      console.log(`   ${conn.discordUsername} (${conn.discordUserId}) → ${user?.email}`);
    }

    console.log('\n🔍 Searching for leads that are ALSO app users...\n');

    // Find leads where the Discord user is ALSO a connected user
    const leads = await Lead.find({
      discordUserId: { $in: Array.from(connectedDiscordUserIds) }
    }).lean();

    console.log(`Found ${leads.length} leads that are also app users:\n`);

    let deletedCount = 0;

    for (const lead of leads) {
      // Find the connection for this Discord user
      const userConnection = connections.find(c => c.discordUserId === lead.discordUserId);
      
      if (!userConnection) continue;

      // Check if the lead belongs to the SAME user as the connection
      const isSameUser = lead.userId.toString() === userConnection.userId.toString();

      const ownerUser = await User.findById(lead.userId);
      const connectedUser = await User.findById(userConnection.userId);

      console.log(`Lead: ${lead.name} (${lead.discordUserId})`);
      console.log(`   Lead Owner: ${ownerUser?.email} (${lead.userId})`);
      console.log(`   Discord Connection Owner: ${connectedUser?.email} (${userConnection.userId})`);
      console.log(`   Same User: ${isSameUser ? '✅ YES' : '❌ NO - CROSS-USER LEAD!'}`);

      if (!isSameUser) {
        console.log(`   🗑️  DELETING - This is a cross-user lead (app user listed as lead for different user)`);
        
        // Delete associated messages
        const messageCount = await DiscordMessage.countDocuments({
          leadId: lead._id.toString()
        });
        
        if (messageCount > 0) {
          await DiscordMessage.deleteMany({ leadId: lead._id.toString() });
          console.log(`      Deleted ${messageCount} associated messages`);
        }

        // Delete the lead
        await Lead.deleteOne({ _id: lead._id });
        deletedCount++;
      } else {
        console.log(`   ✅ KEEPING - This is the user's own Discord connection`);
      }

      console.log();
    }

    console.log(`\n✅ Cleanup complete!`);
    console.log(`   Deleted: ${deletedCount} cross-user leads`);
    console.log(`   Kept: ${leads.length - deletedCount} valid leads\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

cleanupCrossUserLeads();
