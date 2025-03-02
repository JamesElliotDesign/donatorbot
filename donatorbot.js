require('dotenv').config(); // Load environment variables

const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Load token from .env
const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
    console.error("❌ BOT_TOKEN is missing! Make sure it's in your .env file.");
    process.exit(1); // Exit the script if no token is found
}

const DONATION_FILE = 'donations.json';
let donations = {};

// Load existing donation data
if (fs.existsSync(DONATION_FILE)) {
    donations = JSON.parse(fs.readFileSync(DONATION_FILE, 'utf8'));
}

// Define donation roles (sorted from highest to lowest)
const roles = [
    { id: "1345839570041835591", amount: 1000 }, // OG
    { id: "1345840100491395092", amount: 500 },  // Diamond
    { id: "1345839616095289345", amount: 250 },  // Emerald
    { id: "1345838625757204640", amount: 150 },  // Platinum
    { id: "1345836451362766880", amount: 100 },  // Gold
    { id: "1345834598969643221", amount: 50 },   // Silver
    { id: "1227025687316005015", amount: 15 }    // Bronze
];

// Function to get the highest role a player qualifies for
function getRoleForDonation(amount) {
    return roles.find(role => amount >= role.amount) || null;
}

// Slash Command Registration
client.once('ready', async () => {
    console.log(`${client.user.tag} is online!`);

    const guild = client.guilds.cache.first(); // Replace with your guild ID if needed

    await guild.commands.create(new SlashCommandBuilder()
        .setName('donate')
        .setDescription('Track a player’s donation.')
        .addUserOption(option =>
            option.setName('player')
                .setDescription('The player who donated')
                .setRequired(true))
        .addNumberOption(option =>
            option.setName('amount')
                .setDescription('Amount donated')
                .setRequired(true)));

    await guild.commands.create(new SlashCommandBuilder()
        .setName('checkdono')
        .setDescription('Check a player’s total donation.')
        .addUserOption(option =>
            option.setName('player')
                .setDescription('The player to check')
                .setRequired(true)));

    console.log("✅ Commands registered.");
});

// Handle Commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;
    const user = options.getUser('player');
    const amount = options.getNumber('amount');

    if (commandName === 'donate') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: "You don’t have permission to use this command.", ephemeral: true });
        }

        if (!donations[user.id]) {
            donations[user.id] = { total: 0 };
        }

        donations[user.id].total += amount;
        fs.writeFileSync(DONATION_FILE, JSON.stringify(donations, null, 2));

        const highestRole = getRoleForDonation(donations[user.id].total);
        if (highestRole) {
            const guildMember = await interaction.guild.members.fetch(user.id);
            const role = interaction.guild.roles.cache.get(highestRole.id);

            if (role) {
                // Remove lower-tier roles only
                for (let r of roles) {
                    const existingRole = interaction.guild.roles.cache.get(r.id);
                    if (existingRole && guildMember.roles.cache.has(existingRole.id)) {
                        // Only remove if it's a lower-tier role
                        if (r.amount < highestRole.amount) {
                            await guildMember.roles.remove(existingRole);
                        }
                    }
                }

                // Assign the new highest role (if they don't already have it)
                if (!guildMember.roles.cache.has(role.id)) {
                    await guildMember.roles.add(role);
                }
            }
        }

        await interaction.reply({ content: `✅ Added £${amount} to ${user.username}. They now have **£${donations[user.id].total}** in total donations.` });

    } else if (commandName === 'checkdono') {
        if (!donations[user.id]) {
            return interaction.reply({ content: `${user.username} has not donated anything yet.`, ephemeral: true });
        }
        return interaction.reply({ content: `💰 ${user.username} has donated a total of **£${donations[user.id].total}**.` });
    }
});

client.login(TOKEN);
