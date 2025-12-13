import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { DiscordConnection } from '../src/models/index.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/paveos';
const USER_ID = '693c51f957adb2211b6007aa';

async function deleteDiscordConnection() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find the Discord connection
    const connection = await DiscordConnection.findOne({ userId: USER_ID });
    
    if (!connection) {
      console.log('❌ No Discord connection found for user:', USER_ID);
      process.exit(0);
    }

    console.log('📋 Found Discord Connection:');
    console.log('   User ID:', connection.userId);
    console.log('   Guild ID:', connection.guildId);
    console.log('   Guild Name:', connection.guildName);
    console.log('   Discord User ID:', connection.discordUserId);
    console.log('   Access Token:', connection.accessToken ? '***' + connection.accessToken.slice(-4) : 'N/A');
    console.log('   Connected At:', connection.connectedAt);

    // Delete the connection
    await DiscordConnection.deleteOne({ userId: USER_ID });
    
    console.log('\n✅ Discord connection deleted successfully!');
    console.log('\n📌 Next Steps:');
    console.log('   1. Go to Settings → Integrations in your app');
    console.log('   2. Click "Connect Discord"');
    console.log('   3. Authorize for the "Soundboard" server');
    console.log('   4. The correct guild ID will be saved');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

deleteDiscordConnection();
