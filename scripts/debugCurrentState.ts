import { config } from 'dotenv';
import mongoose from 'mongoose';
import { Lead } from '../src/models/Lead.js';
import { User } from '../src/models/User.js';
import { DiscordConnection } from '../src/models/DiscordConnection.js';

config();

async function debugCurrentState() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('\n✅ Connected to MongoDB\n');
    console.log('='.repeat(80));
    console.log('\n🔍 CURRENT STATE ANALYSIS\n');
    console.log('='.repeat(80));

    // Get saadmustafa user
    const saadmustafa = await User.findOne({ email: /saadmustafa.*@paveos/ });
    if (!saadmustafa) {
      console.log('❌ saadmustafa user not found');
      return;
    }

    console.log(`\n👤 USER: ${saadmustafa.name}`);
    console.log(`   Email: ${saadmustafa.email}`);
    console.log(`   User ID: ${saadmustafa._id}`);
    console.log(`   Whop Company: ${saadmustafa.whopCompanyId}`);

    // Get Discord connections
    const connections = await DiscordConnection.find({ userId: saadmustafa._id });
    console.log(`\n🔗 Discord Connections: ${connections.length}`);
    connections.forEach((conn, i) => {
      console.log(`\n   Connection ${i + 1}:`);
      console.log(`      Active: ${conn.isActive}`);
      console.log(`      Guild: ${conn.discordGuildName} (${conn.discordGuildId})`);
      console.log(`      Discord User: ${conn.discordUsername}`);
      console.log(`      Connected: ${conn.connectedAt}`);
    });

    // Get leads for this user
    const userLeads = await Lead.find({ userId: saadmustafa._id.toString() });
    console.log(`\n📊 Leads for saadmustafa: ${userLeads.length}`);
    userLeads.forEach((lead, i) => {
      console.log(`\n   Lead ${i + 1}: ${lead.name}`);
      console.log(`      Lead ID: ${lead._id}`);
      console.log(`      userId: ${lead.userId}`);
      console.log(`      whopCompanyId: ${lead.whopCompanyId || 'NONE'}`);
      console.log(`      Source: ${lead.source}`);
      console.log(`      Discord: ${lead.discordUsername || 'N/A'}`);
    });

    // Check if there are leads with the wrong userId
    const allLeads = await Lead.find({});
    const leadsByDiscordUserId = new Map();
    
    allLeads.forEach(lead => {
      if (lead.discordUserId === '1435931504407482468') {  // saadmustafa0479's Discord ID
        const existing = leadsByDiscordUserId.get(lead.discordUserId) || [];
        existing.push(lead);
        leadsByDiscordUserId.set(lead.discordUserId, existing);
      }
    });

    console.log(`\n🔍 Searching for Discord user: 1435931504407482468 (saadmustafa0479)`);
    const matches = leadsByDiscordUserId.get('1435931504407482468') || [];
    console.log(`   Found ${matches.length} leads for this Discord user:\n`);

    matches.forEach((lead, i) => {
      const owner = allLeads.find(l => l._id.toString() === lead._id.toString());
      const ownerUser = User.findById(lead.userId);
      
      console.log(`   ${i + 1}. Lead: ${lead.name} (${lead._id})`);
      console.log(`      Belongs to userId: ${lead.userId}`);
      console.log(`      whopCompanyId: ${lead.whopCompanyId || 'NONE'}`);
      console.log(`      Created: ${lead.createdAt}`);
      console.log(`      Tags: ${lead.tags.join(', ')}`);
      
      if (lead.userId?.toString() !== saadmustafa._id.toString()) {
        console.log(`      ⚠️  WRONG USER! Should belong to ${saadmustafa._id}`);
      }
      console.log('');
    });

    // Get all users
    console.log('\n👥 All Users:');
    const allUsers = await User.find({});
    allUsers.forEach(u => {
      console.log(`   - ${u.name} (${u.email})`);
      console.log(`     ID: ${u._id}, Company: ${u.whopCompanyId || 'NONE'}`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Analysis complete\n');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
  }
}

debugCurrentState();
