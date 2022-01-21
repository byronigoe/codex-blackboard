// Require the necessary discord.js classes
const { Client, Intents } = require('discord.js');
const { token } = require('./config.json');

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

// When the client is ready, run this code (only once)
client.once('ready', () => {
	console.log('Ready!');
});
//
// Login to Discord with your client's token
client.login(token);

const guild = client.guilds.cache.get("790817688673976341");

guild.channels.create('new-bot-test-channel', { reason: 'Testing the bot' }).then(console.log).catch(console.error);
