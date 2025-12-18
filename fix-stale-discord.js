// Connect to MongoDB and fix stale Discord connections
const { MongoClient } = require('mongodb');
require('dotenv').config();

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
    
    // Clear all active connections (user will need to reconnect)
    const result = await connections.updateMany(
      { isActive: true },
      { 
        $set: { 
          isActive: false,
          discordGuildId: null,
          discordGuildName: null,
          accessToken: null,
          refreshToken: null,
          syncedMembersCount: 0,
          syncedChannelsCount: 0
        }
      }
    );
    
    console.log(`✅ Fixed ${result.modifiedCount} stale connections`);
    console.log('⚠️  Users will need to reconnect their Discord servers');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

fixStaleConnections();
