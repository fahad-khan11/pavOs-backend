import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once('ready', async () => {
  console.log(`✅ Bot logged in as ${client.user.tag}\n`);
  
  const guildId = '1451091882129096868'; // PavosTesting
  const guild = client.guilds.cache.get(guildId);
  
  if (!guild) {
    console.log('❌ Bot is not in the guild!');
    process.exit(1);
  }
  
  console.log(`📊 Guild: ${guild.name} (${guild.id})\n`);
  
  const botMember = guild.members.cache.get(client.user.id);
  const permissions = botMember.permissions;
  
  const requiredPerms = [
    { name: 'Manage Channels', bit: PermissionFlagsBits.ManageChannels },
    { name: 'Manage Threads', bit: PermissionFlagsBits.ManageThreads },
    { name: 'Create Public Threads', bit: PermissionFlagsBits.CreatePublicThreads },
    { name: 'Create Private Threads', bit: PermissionFlagsBits.CreatePrivateThreads },
    { name: 'Send Messages', bit: PermissionFlagsBits.SendMessages },
    { name: 'View Channels', bit: PermissionFlagsBits.ViewChannel },
    { name: 'Read Message History', bit: PermissionFlagsBits.ReadMessageHistory },
  ];
  
  console.log('🔍 Permission Check:\n');
  let missing = [];
  
  for (const perm of requiredPerms) {
    const has = permissions.has(perm.bit);
    console.log(`${has ? '✅' : '❌'} ${perm.name}`);
    if (!has) missing.push(perm.name);
  }
  
  if (missing.length > 0) {
    console.log(`\n⚠️  Missing ${missing.length} required permission(s):`);
    missing.forEach(p => console.log(`   - ${p}`));
    console.log('\n📝 Re-invite the bot with this URL:');
    console.log(`https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=275415957504&scope=bot`);
  } else {
    console.log('\n✅ Bot has all required permissions!');
  }
  
  process.exit(0);
});

client.login(process.env.DISCORD_BOT_TOKEN);
