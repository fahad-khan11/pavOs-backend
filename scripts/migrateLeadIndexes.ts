import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Lead } from '../src/models/Lead.js';

dotenv.config();

async function migrateLeadIndexes() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    console.log('📊 Current indexes on Lead collection:');
    const currentIndexes = await Lead.collection.getIndexes();
    console.log(JSON.stringify(currentIndexes, null, 2));

    console.log('\n🔄 Dropping old indexes that conflict with multi-tenant setup...');
    
    // Drop any old unique index on discordUserId alone (if it exists)
    try {
      await Lead.collection.dropIndex('discordUserId_1');
      console.log('✅ Dropped old discordUserId unique index');
    } catch (error: any) {
      if (error.code === 27 || error.message.includes('index not found')) {
        console.log('ℹ️  No old discordUserId unique index to drop');
      } else {
        console.warn('⚠️  Could not drop discordUserId index:', error.message);
      }
    }

    console.log('\n🔄 Ensuring new compound unique index exists...');
    
    // Create the compound unique index (if it doesn't exist)
    await Lead.collection.createIndex(
      { whopCompanyId: 1, discordUserId: 1 },
      { 
        unique: true, 
        sparse: true,
        name: 'unique_discord_user_per_company'
      }
    );
    console.log('✅ Created compound unique index: (whopCompanyId + discordUserId)');

    console.log('\n📊 New indexes on Lead collection:');
    const newIndexes = await Lead.collection.getIndexes();
    console.log(JSON.stringify(newIndexes, null, 2));

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 What this means:');
    console.log('   - Same Discord user CAN be a lead in multiple companies ✅');
    console.log('   - Same Discord user CANNOT be duplicated within one company ✅');
    console.log('   - Each company sees only their own leads ✅');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrateLeadIndexes();
