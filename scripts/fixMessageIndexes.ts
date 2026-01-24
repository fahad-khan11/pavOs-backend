import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Fix duplicate key error by dropping old unique indexes
 * and recreating them with sparse option
 */
async function fixIndexes() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db!.collection('discordmessages');

    // Get current indexes
    const indexes = await collection.indexes();
    console.log('\n📋 Current indexes:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    // Drop old discordMessageId unique index (without sparse)
    try {
      await collection.dropIndex('discordMessageId_1');
      console.log('\n✅ Dropped old discordMessageId_1 index');
    } catch (error: any) {
      if (error.code === 27) {
        console.log('\nℹ️  discordMessageId_1 index not found (already dropped or never existed)');
      } else {
        console.log('\n⚠️  Could not drop discordMessageId_1:', error.message);
      }
    }

    // Drop old whopMessageId unique index (without sparse) if exists
    try {
      await collection.dropIndex('whopMessageId_1');
      console.log('✅ Dropped old whopMessageId_1 index');
    } catch (error: any) {
      if (error.code === 27) {
        console.log('ℹ️  whopMessageId_1 index not found (already dropped or never existed)');
      } else {
        console.log('⚠️  Could not drop whopMessageId_1:', error.message);
      }
    }

    // Create new sparse unique indexes
    console.log('\n🔧 Creating new sparse unique indexes...');
    
    await collection.createIndex(
      { discordMessageId: 1 }, 
      { 
        unique: true, 
        sparse: true,
        name: 'discordMessageId_1_sparse'
      }
    );
    console.log('✅ Created discordMessageId_1_sparse (unique + sparse)');

    await collection.createIndex(
      { whopMessageId: 1 }, 
      { 
        unique: true, 
        sparse: true,
        name: 'whopMessageId_1_sparse'
      }
    );
    console.log('✅ Created whopMessageId_1_sparse (unique + sparse)');

    // Show new indexes
    const newIndexes = await collection.indexes();
    console.log('\n📋 New indexes:');
    newIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} ${idx.sparse ? '(sparse)' : ''} ${idx.unique ? '(unique)' : ''}`);
    });

    console.log('\n✅ Index migration complete!');
    console.log('\n📝 Summary:');
    console.log('  - Discord messages can have null whopMessageId');
    console.log('  - Whop messages can have null discordMessageId');
    console.log('  - No more duplicate key errors!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

fixIndexes();
