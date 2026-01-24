import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/paveos';

async function fixLeadIndexesFinal() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not established');

    const collection = db.collection('leads');

    // List current indexes
    console.log('\n📋 Current indexes:');
    const currentIndexes = await collection.indexes();
    currentIndexes.forEach((index) => {
      console.log(`  - ${index.name}`);
    });

    // Drop the problematic indexes
    console.log('\n🔧 Dropping old indexes...');
    try {
      await collection.dropIndex('unique_discord_user_per_company');
      console.log('✅ Dropped unique_discord_user_per_company');
    } catch (error: any) {
      if (error.code === 27) {
        console.log('⚠️  Index unique_discord_user_per_company not found');
      } else {
        throw error;
      }
    }

    try {
      await collection.dropIndex('unique_whop_membership_per_company');
      console.log('✅ Dropped unique_whop_membership_per_company');
    } catch (error: any) {
      if (error.code === 27) {
        console.log('⚠️  Index unique_whop_membership_per_company not found');
      } else {
        throw error;
      }
    }

    // Create new PARTIAL index for Discord users only
    console.log('\n🔧 Creating new partial indexes...');
    
    await collection.createIndex(
      { whopCompanyId: 1, discordUserId: 1 },
      {
        unique: true,
        partialFilterExpression: { discordUserId: { $type: 'string' } },
        name: 'unique_discord_user_per_company',
      }
    );
    console.log('✅ Created unique_discord_user_per_company (partial - Discord only)');

    await collection.createIndex(
      { whopCompanyId: 1, whopMembershipId: 1 },
      {
        unique: true,
        partialFilterExpression: { whopMembershipId: { $type: 'string' } },
        name: 'unique_whop_membership_per_company',
      }
    );
    console.log('✅ Created unique_whop_membership_per_company (partial - Whop only)');

    // List new indexes
    console.log('\n📋 New indexes:');
    const newIndexes = await collection.indexes();
    newIndexes.forEach((index) => {
      if (index.name && index.name.includes('unique')) {
        console.log(`  - ${index.name}:`, index.key, index.partialFilterExpression ? '(partial)' : '');
      }
    });

    console.log('\n✅ Index migration complete!');
    console.log('\n📝 How this works:');
    console.log('  - Manual leads: Can have null discordUserId & null whopMembershipId (unlimited)');
    console.log('  - Whop leads: Must have unique whopMembershipId per company');
    console.log('  - Discord leads: Must have unique discordUserId per company');
    console.log('  - NO MORE DUPLICATE KEY ERRORS! 🎉');

    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error during index migration:', error);
    process.exit(1);
  }
}

fixLeadIndexesFinal();
