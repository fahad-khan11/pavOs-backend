import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Lead } from '../src/models/Lead.js';
import { DiscordMessage } from '../src/models/DiscordMessage.js';

dotenv.config();

interface LeadGroup {
  _id: string;
  leads: any[];
}

async function fixDuplicateLeads() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    // Find all Discord users that have multiple leads
    const duplicates = await Lead.aggregate([
      {
        $match: {
          discordUserId: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$discordUserId',
          leads: { $push: '$$ROOT' },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    console.log(`Found ${duplicates.length} Discord users with duplicate leads\n`);

    for (const duplicate of duplicates) {
      const discordUserId = duplicate._id;
      const leads = duplicate.leads;

      console.log(`\n🔍 Discord User: ${leads[0].name} (${discordUserId})`);
      console.log(`   Found ${leads.length} duplicate leads:`);

      // Sort leads by creation date (oldest first)
      leads.sort((a: any, b: any) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // Keep the OLDEST lead (first one created)
      const keepLead = leads[0];
      const removeLeads = leads.slice(1);

      console.log(`   ✅ Keeping: ${keepLead._id} (userId: ${keepLead.userId}, created: ${keepLead.createdAt})`);

      for (const removeLead of removeLeads) {
        console.log(`   ❌ Removing: ${removeLead._id} (userId: ${removeLead.userId}, created: ${removeLead.createdAt})`);

        // Reassign any messages from the duplicate lead to the kept lead
        const messageCount = await DiscordMessage.countDocuments({
          leadId: removeLead._id.toString()
        });

        if (messageCount > 0) {
          await DiscordMessage.updateMany(
            { leadId: removeLead._id.toString() },
            { $set: { leadId: keepLead._id.toString() } }
          );
          console.log(`      → Reassigned ${messageCount} messages to kept lead`);
        }

        // Delete the duplicate lead
        await Lead.deleteOne({ _id: removeLead._id });
      }
    }

    console.log('\n✅ Cleanup complete!');
    console.log('\n📊 Summary:');
    const totalLeads = await Lead.countDocuments({ discordUserId: { $exists: true } });
    console.log(`   Total Discord leads: ${totalLeads}`);

    // Show leads by user
    const leadsByUser = await Lead.aggregate([
      {
        $match: { discordUserId: { $exists: true } }
      },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 },
          leads: { $push: { name: '$name', discordUserId: '$discordUserId' } }
        }
      }
    ]);

    console.log('\n   Leads by user:');
    for (const group of leadsByUser) {
      console.log(`   User ${group._id}: ${group.count} leads`);
      group.leads.forEach((lead: any) => {
        console.log(`      - ${lead.name} (${lead.discordUserId})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

fixDuplicateLeads();
