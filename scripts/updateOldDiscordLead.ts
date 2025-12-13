import mongoose from 'mongoose';
import { config } from 'dotenv';
import { Lead } from '../src/models/Lead.js';
import { User } from '../src/models/User.js';

config();

async function updateOldDiscordLead() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    // Find current Whop user
    const currentUser = await User.findById('693c51f957adb2211b6007aa');
    if (!currentUser || !currentUser.whopCompanyId) {
      console.log('❌ Current user not found or no whopCompanyId');
      return;
    }

    console.log('📋 Current User:');
    console.log(`   ID: ${currentUser._id}`);
    console.log(`   Email: ${currentUser.email}`);
    console.log(`   WhopCompanyId: ${currentUser.whopCompanyId}\n`);

    // Find old Discord lead
    const oldLead = await Lead.findOne({ discordUserId: '1435931504407482468' });
    if (!oldLead) {
      console.log('❌ Old Discord lead not found');
      return;
    }

    console.log('📋 Old Discord Lead:');
    console.log(`   ID: ${oldLead._id}`);
    console.log(`   Name: ${oldLead.name}`);
    console.log(`   userId: ${oldLead.userId}`);
    console.log(`   whopCompanyId: ${oldLead.whopCompanyId || 'N/A'}\n`);

    // Update the lead
    console.log('🔄 Updating lead...');
    oldLead.userId = String(currentUser._id);
    oldLead.whopCompanyId = currentUser.whopCompanyId;
    await oldLead.save();

    console.log('✅ Updated lead:');
    console.log(`   New userId: ${oldLead.userId}`);
    console.log(`   New whopCompanyId: ${oldLead.whopCompanyId}`);
    console.log('\n💡 Lead should now appear in Whop dashboard!');

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

updateOldDiscordLead();
