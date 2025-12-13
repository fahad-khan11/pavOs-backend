import mongoose from 'mongoose';
import { config } from 'dotenv';
import { DiscordConnection } from '../src/models/DiscordConnection.js';
import { User } from '../src/models/User.js';

config();

async function checkDiscordStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    // Find current user
    const user = await User.findOne({ email: 'saadmustafa' }).lean();
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('📋 User Info:');
    console.log(`   ID: ${user._id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   WhopCompanyId: ${user.whopCompanyId || 'N/A'}\n`);

    // Check Discord connection
    const connection = await DiscordConnection.findOne({ userId: user._id }).lean();
    if (!connection) {
      console.log('❌ No Discord connection found for this user');
      return;
    }

    console.log('🔗 Discord Connection:');
    console.log(`   Connection ID: ${connection._id}`);
    console.log(`   Discord User ID: ${connection.discordUserId}`);
    console.log(`   Guild ID: ${connection.guildId}`);
    console.log(`   Is Active: ${connection.isActive}`);
    console.log(`   Has Bot Token: ${connection.botToken ? 'Yes' : 'No'}`);
    console.log(`   Created: ${connection.createdAt}`);

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
  }
}

checkDiscordStatus();
