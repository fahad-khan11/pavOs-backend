import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/paveos';

async function checkIndexes() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not established');

    const collection = db.collection('leads');
    const indexes = await collection.indexes();

    console.log('\n📋 Current Lead Indexes:');
    indexes.forEach((index) => {
      if (index.name === 'unique_discord_user_per_company') {
        console.log('\n🔍 FOUND THE PROBLEMATIC INDEX:');
        console.log('  Name:', index.name);
        console.log('  Key:', JSON.stringify(index.key));
        console.log('  Unique:', index.unique || false);
        console.log('  Sparse:', index.sparse || false);
        console.log('  ❌ THIS IS THE PROBLEM!' );
      }
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkIndexes();
