import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/paveos';

async function fixLeadIndexes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }

    const collection = db.collection('leads');

    // List current indexes
    console.log('\n📋 Current indexes:');
    const currentIndexes = await collection.indexes();
    currentIndexes.forEach((index) => {
      console.log(`  - ${index.name}:`, index.key, index.unique ? '(unique)' : '', index.sparse ? '(sparse)' : '');
    });

    // Drop the old non-sparse unique index
    console.log('\n🔧 Fixing unique_discord_user_per_company index...');
    try {
      await collection.dropIndex('unique_discord_user_per_company');
      console.log('✅ Dropped old unique_discord_user_per_company index');
    } catch (error: any) {
      if (error.code === 27) {
        console.log('⚠️  Index unique_discord_user_per_company not found (already dropped)');
      } else {
        throw error;
      }
    }

    // Create new sparse unique index
    console.log('\n🔧 Creating new sparse unique index...');
    await collection.createIndex(
      { whopCompanyId: 1, discordUserId: 1 },
      {
        unique: true,
        sparse: true,
        name: 'unique_discord_user_per_company',
      }
    );
    console.log('✅ Created unique_discord_user_per_company (unique + sparse)');

    // List new indexes
    console.log('\n📋 New indexes:');
    const newIndexes = await collection.indexes();
    newIndexes.forEach((index) => {
      console.log(`  - ${index.name}:`, index.key, index.unique ? '(unique)' : '', index.sparse ? '(sparse)' : '');
    });

    console.log('\n✅ Index migration complete!');
    console.log('\n📝 Summary:');
    console.log('  - Manual leads can now have null discordUserId');
    console.log('  - Whop leads can have null discordUserId');
    console.log('  - Discord leads must have unique discordUserId per company');
    console.log('  - No more duplicate key errors!');

    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error during index migration:', error);
    process.exit(1);
  }
}

fixLeadIndexes();
