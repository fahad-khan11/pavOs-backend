import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function migrateLeadIndexes() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const leadsCollection = db.collection('leads');

    console.log('📊 Current indexes on leads collection:');
    const currentIndexes = await leadsCollection.indexes();
    console.log(JSON.stringify(currentIndexes, null, 2));

    console.log('\n🔄 Dropping old indexes that conflict with multi-tenant setup...');
    
    // Drop any old unique index on discordUserId alone (if it exists)
    try {
      await leadsCollection.dropIndex('discordUserId_1');
      console.log('✅ Dropped old discordUserId unique index');
    } catch (error) {
      if (error.code === 27 || error.message.includes('index not found')) {
        console.log('ℹ️  No old discordUserId unique index to drop');
      } else {
        console.warn('⚠️  Could not drop discordUserId index:', error.message);
      }
    }

    console.log('\n🔄 Creating new compound unique index...');
    
    // Create the compound unique index
    try {
      await leadsCollection.createIndex(
        { whopCompanyId: 1, discordUserId: 1 },
        { 
          unique: true, 
          sparse: true,
          name: 'unique_discord_user_per_company'
        }
      );
      console.log('✅ Created compound unique index: (whopCompanyId + discordUserId)');
    } catch (error) {
      if (error.code === 85 || error.message.includes('already exists')) {
        console.log('ℹ️  Compound unique index already exists');
      } else {
        throw error;
      }
    }

    console.log('\n📊 New indexes on leads collection:');
    const newIndexes = await leadsCollection.indexes();
    console.log(JSON.stringify(newIndexes, null, 2));

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 What this means:');
    console.log('   ✅ Same Discord user CAN be a lead in multiple companies');
    console.log('   ✅ Same Discord user CANNOT be duplicated within one company');
    console.log('   ✅ Each company sees only their own leads');
    console.log('\n🔮 Example:');
    console.log('   Discord user "john#1234" can now be:');
    console.log('   - Lead in Company A');
    console.log('   - Lead in Company B');
    console.log('   - Lead in Company C');
    console.log('   All managed independently!');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrateLeadIndexes();
