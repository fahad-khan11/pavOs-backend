import mongoose from 'mongoose';
import { config } from 'dotenv';
import { DiscordConnection } from '../src/models/DiscordConnection.js';
import { User } from '../src/models/User.js';

// Load environment variables
config();

const MONGODB_URI = process.env.MONGODB_URI || '';

// Fahad's user ID (from the checkAllDiscordConnections output)
const FAHAD_USER_ID = '693c5848dc44b5b21b6cbed6';

async function deleteFahadConnection() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get user info
    const user = await User.findById(FAHAD_USER_ID);
    if (!user) {
      console.error(`❌ User ${FAHAD_USER_ID} not found!`);
      return;
    }

    console.log(`👤 User: ${user.email}`);
    console.log(`🏢 Company ID: ${user.whopCompanyId}\n`);

    // Find Fahad's connection
    const connection = await DiscordConnection.findOne({ userId: FAHAD_USER_ID });
    
    if (!connection) {
      console.log('ℹ️  No Discord connection found for this user.');
      return;
    }

    console.log('📋 Current Discord Connection:');
    console.log(`   Discord User: ${connection.discordUsername}`);
    console.log(`   Discord User ID: ${connection.discordUserId}`);
    console.log(`   Guild: ${connection.discordGuildName} (${connection.discordGuildId})`);
    console.log(`   Status: ${connection.isActive ? 'Active' : 'Inactive'}`);
    console.log('');

    // Delete the connection
    await DiscordConnection.deleteOne({ _id: connection._id });
    
    console.log('✅ Discord connection deleted successfully!');
    console.log('');
    console.log('📌 Next Steps:');
    console.log('   1. Ask Fahad to go to Settings → Integrations → Discord');
    console.log('   2. Click "Connect Discord"');
    console.log('   3. The system will automatically assign him to the Soundboard guild');
    console.log('   4. He will now see his own leads from Discord DMs!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

deleteFahadConnection();
