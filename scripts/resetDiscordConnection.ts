import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config();

/**
 * Reset Discord connections for a company
 * This allows you to connect to a different Discord server
 */
async function resetDiscordConnections() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    const whopCompanyId = 'biz_9CBBQph398IKfd'; // Your company ID

    const DiscordConnection = mongoose.model('DiscordConnection', new mongoose.Schema({}, { strict: false }));

    console.log(`🔍 Finding Discord connections for company: ${whopCompanyId}`);
    
    const connections = await DiscordConnection.find({ whopCompanyId });
    
    if (connections.length === 0) {
      console.log('✅ No Discord connections found');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`\n📋 Found ${connections.length} Discord connection(s):\n`);
    connections.forEach((conn: any, idx: number) => {
      console.log(`   ${idx + 1}. User: ${conn.userId}`);
      console.log(`      Server: ${conn.discordGuildName} (${conn.discordGuildId})`);
      console.log(`      Active: ${conn.isActive}`);
      console.log(`      Connected: ${conn.connectedAt}`);
      console.log('');
    });

    console.log('🗑️  Deleting all connections...\n');
    
    const result = await DiscordConnection.deleteMany({ whopCompanyId });
    
    console.log(`✅ Deleted ${result.deletedCount} Discord connection(s)`);
    console.log('\n🎯 Next steps:');
    console.log('   1. Go to PaveOS settings');
    console.log('   2. Click "Connect Discord"');
    console.log('   3. Select YOUR Discord server');
    console.log('   4. It should now connect to your server!');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

resetDiscordConnections();
