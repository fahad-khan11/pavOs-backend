import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { DiscordConnection } from '../src/models/index.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/paveos';
const USER_ID = '693c51f957adb2211b6007aa';
const CORRECT_GUILD_ID = '1449394492938522736'; // Soundboard server
const CORRECT_GUILD_NAME = 'Soundboard';

async function updateGuildId() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find the Discord connection
    const connection = await DiscordConnection.findOne({ userId: USER_ID });
    
    if (!connection) {
      console.log('❌ No Discord connection found for user:', USER_ID);
      console.log('\n📌 Please reconnect Discord first:');
      console.log('   1. Go to Settings → Integrations');
      console.log('   2. Click "Connect Discord"');
      console.log('   3. Then run this script again');
      process.exit(0);
    }

    console.log('📋 Current Discord Connection:');
    console.log('   User ID:', connection.userId);
    console.log('   Discord Guild ID:', connection.discordGuildId || 'NOT SET');
    console.log('   Discord Guild Name:', connection.discordGuildName || 'NOT SET');
    console.log('   Discord User ID:', connection.discordUserId);
    console.log('   Is Active:', connection.isActive);

    // Update to correct guild ID
    console.log('\n🔄 Updating to correct guild...');
    console.log('   New Guild ID:', CORRECT_GUILD_ID);
    console.log('   New Guild Name:', CORRECT_GUILD_NAME);

    connection.discordGuildId = CORRECT_GUILD_ID;
    connection.discordGuildName = CORRECT_GUILD_NAME;
    await connection.save();
    
    console.log('\n✅ Discord connection updated successfully!');
    console.log('\n📌 Next Steps:');
    console.log('   1. Go to Settings → Integrations → Discord');
    console.log('   2. Click "Sync Members"');
    console.log('   3. It should now work with the Soundboard server!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

updateGuildId();
