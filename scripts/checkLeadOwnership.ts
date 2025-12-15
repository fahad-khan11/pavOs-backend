import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Lead } from '../src/models/Lead.js';
import { DiscordMessage } from '../src/models/DiscordMessage.js';
import { User } from '../src/models/User.js';

dotenv.config();

async function checkLeadOwnership() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    // Get all users
    const users = await User.find({}, 'email whopCompanyId').lean();
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    console.log('👥 Users:');
    users.forEach(u => {
      console.log(`   ${u._id}: ${u.email} (company: ${u.whopCompanyId || 'none'})`);
    });

    console.log('\n📊 Leads:');
    const leads = await Lead.find({ discordUserId: { $exists: true } }).lean();
    
    for (const lead of leads) {
      const user = userMap.get(lead.userId.toString());
      console.log(`\n   Lead: ${lead.name} (${lead.discordUserId})`);
      console.log(`      Owner: ${user?.email || lead.userId} (${lead.userId})`);
      console.log(`      Company: ${lead.whopCompanyId || 'none'}`);
      console.log(`      Created: ${lead.createdAt}`);
      
      // Check messages
      const messages = await DiscordMessage.find({ 
        leadId: lead._id.toString() 
      }).lean();
      
      console.log(`      Messages: ${messages.length}`);
      messages.forEach(msg => {
        const msgUser = userMap.get(msg.userId.toString());
        console.log(`         - "${msg.content?.substring(0, 30) || 'no content'}" (userId: ${msgUser?.email || msg.userId})`);
      });
    }

    console.log('\n✅ Analysis complete');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkLeadOwnership();
