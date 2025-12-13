import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI!;

async function fixDiscordConnections() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get the DiscordConnection collection
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    const collection = db.collection('discordconnections');

    // Remove companyId field from all documents
    const result = await collection.updateMany(
      {},
      { $unset: { companyId: '' } }
    );

    console.log(`✅ Updated ${result.modifiedCount} Discord connections`);
    console.log(`   Matched: ${result.matchedCount} documents`);

    // List all connections
    const connections = await collection.find({}).toArray();
    console.log('\n📋 Current Discord connections:');
    connections.forEach((conn: any) => {
      console.log(`   - userId: ${conn.userId}, guildName: ${conn.discordGuildName || 'N/A'}, active: ${conn.isActive}`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixDiscordConnections();
