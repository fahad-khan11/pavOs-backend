// Connect to MongoDB and fix stale Discord connections
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function fixStaleConnections() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    const connections = db.collection('discordconnections');
    
    // Find all active connections
    const activeConns = await connections.find({ isActive: true }).toArray();
    console.log(`📊 Found ${activeConns.length} active Discord connections`);
    
    if (activeConns.length === 0) {
      console.log('No active connections to fix');
      return;
    }
    
    // Show the connections before fixing
    for (const conn of activeConns) {
      console.log(`  - User: ${conn.userId}, Guild: ${conn.discordGuildId} (${conn.discordGuildName})`);
    }
    
    // Clear all active connections (user will need to reconnect)
    const result = await connections.updateMany(
      { isActive: true },
      { 
        $set: { 
          isActive: false
        },
        $unset: {
          discordGuildId: "",
          discordGuildName: "",
          accessToken: "",
          refreshToken: "",
          syncedMembersCount: "",
          syncedChannelsCount: ""
        }
      }
    );
    
    console.log(`\n✅ Fixed ${result.modifiedCount} stale connections`);
    console.log('⚠️  Users will need to reconnect their Discord servers via the UI');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.close();
  }
}

fixStaleConnections();
