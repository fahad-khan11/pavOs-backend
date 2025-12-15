import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';

dotenv.config();

async function checkBotGuilds() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once('ready', () => {
    console.log('✅ Discord bot logged in\n');
    console.log('🤖 Bot is in the following servers:\n');

    client.guilds.cache.forEach((guild) => {
      console.log(`   ${guild.name}`);
      console.log(`      ID: ${guild.id}`);
      console.log(`      Members: ${guild.memberCount}`);
      console.log(`      Owner ID: ${guild.ownerId}`);
      console.log();
    });

    console.log(`\n📊 Total: ${client.guilds.cache.size} servers`);
    process.exit(0);
  });

  await client.login(process.env.DISCORD_BOT_TOKEN);
}

checkBotGuilds();
