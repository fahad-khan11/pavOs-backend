import { PermissionFlagsBits } from 'discord.js';

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║          DISCORD PERMISSION CALCULATION EXPLAINED             ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

console.log('📚 Discord uses BITWISE flags for permissions.\n');
console.log('Each permission has a unique bit value (power of 2):\n');

const permissions = [
  { name: 'View Channels', bit: PermissionFlagsBits.ViewChannel },
  { name: 'Manage Channels', bit: PermissionFlagsBits.ManageChannels },
  { name: 'Send Messages', bit: PermissionFlagsBits.SendMessages },
  { name: 'Read Message History', bit: PermissionFlagsBits.ReadMessageHistory },
  { name: 'Create Public Threads', bit: PermissionFlagsBits.CreatePublicThreads },
  { name: 'Create Private Threads', bit: PermissionFlagsBits.CreatePrivateThreads },
  { name: 'Manage Threads', bit: PermissionFlagsBits.ManageThreads },
];

console.log('Individual Permission Values:');
console.log('─'.repeat(60));
permissions.forEach(perm => {
  console.log(`${perm.name.padEnd(30)} = ${perm.bit.toString().padStart(15)}`);
});

console.log('\n🔢 To get the COMBINED permission value, we use BITWISE OR:');
console.log('─'.repeat(60));

const combined = 
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.ManageChannels |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.ReadMessageHistory |
  PermissionFlagsBits.CreatePublicThreads |
  PermissionFlagsBits.CreatePrivateThreads |
  PermissionFlagsBits.ManageThreads;

console.log(`\nCombined Permission Value: ${combined}\n`);

console.log('✅ This is the value we use in the bot invite URL!\n');

console.log('📖 Reference:');
console.log('   Discord.js PermissionFlagsBits: Official Discord API');
console.log('   Documentation: https://discord.com/developers/docs/topics/permissions\n');

console.log('🔧 OLD vs NEW Permissions:');
console.log('─'.repeat(60));

const oldPermissions = 275146468368n;
const newPermissions = 275415957504n;

console.log(`Old value: ${oldPermissions} (missing Manage Channels & Threads)`);
console.log(`New value: ${newPermissions} (includes ALL required permissions)`);
console.log(`\nDifference: ${newPermissions - oldPermissions} (added permissions)\n`);

// Show what was missing
console.log('❌ Old permissions were MISSING:');
if (!(oldPermissions & PermissionFlagsBits.ManageChannels)) {
  console.log(`   - Manage Channels (${PermissionFlagsBits.ManageChannels})`);
}
if (!(oldPermissions & PermissionFlagsBits.ManageThreads)) {
  console.log(`   - Manage Threads (${PermissionFlagsBits.ManageThreads})`);
}

console.log('\n✅ New permissions INCLUDE:');
permissions.forEach(perm => {
  if (newPermissions & perm.bit) {
    console.log(`   ✓ ${perm.name}`);
  }
});

console.log('\n');
