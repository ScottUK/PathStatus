const config = require('./config.json');
const { Client, Intents, MessageEmbed } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

const axios = require('axios');
const fs = require('fs');

let ready = false;
let guild;
let channel;
let message;

client.once('ready', async () => {
    console.log('Bot starting...');

    client.user.setActivity('For Maintenance', { type: 'WATCHING' });

    guild = await client.guilds.fetch(config.guild_id);
    channel = guild.channels.cache.get(config.channel_id);

    if(!guild || !channel) {
        console.log('Unable to find guild or channel. :(');
        return;
    }

    let messageFound = false;
    if (config.message_id) {
        message = await channel.messages.fetch(config.message_id);
        if (message) messageFound = true;
    }

    if (!messageFound) {
        message = await channel.send('Checking for Maintenance...');

        config.message_id = message.id;

        fs.writeFileSync('config.json', JSON.stringify(config, null, 4));
    }

    ready = true;

    console.log('Bot started.');
});

setInterval(async () => {
    if (!ready) return;

    const response = await axios.get('https://status.path.net/api/v2/scheduled-maintenances.json');

    const in_progress = [];
    const upcoming = [];
    const completed = [];

    for (const maintenance of response.data.scheduled_maintenances) {
        if (maintenance.status === 'in_progress') {
            in_progress.push(maintenance);
        } else if (maintenance.status === 'completed') {
            const date = new Date(maintenance.resolved_at);
            const otherDate = new Date();
            otherDate.setDate(otherDate.getDate() - 3);
        
            if (date < otherDate) continue;

            completed.push(maintenance);
        } else if (maintenance.status === 'scheduled') {
            upcoming.push(maintenance);
        }
    }

    const in_progress_embed = new MessageEmbed().setTitle('In Progress').setTimestamp();

    if (in_progress.length === 0) {
        in_progress_embed.setDescription('No scheduled maintenance is currently in progress.');
    } else {
        in_progress_embed.setDescription('Current in progress maintenance can be found below.');
    }

    for (const maintenance of in_progress) {
        in_progress_embed.addField(maintenance.name, `Impact: ${maintenance.impact}\nStarted: ${new Date(maintenance.started_at).toLocaleString()}\nScheduled Until: ${new Date(maintenance.scheduled_until).toLocaleString()}`);
    }

    const upcoming_embed = new MessageEmbed().setTitle('Upcoming').setTimestamp();

    if (upcoming.length === 0) {
        upcoming_embed.setDescription('No scheduled maintenance is currently upcoming.');
    } else {
        upcoming_embed.setDescription('Scheduled upcoming maintenance can be found below.');
    }

    for (const maintenance of upcoming) {
        upcoming_embed.addField(maintenance.name, `Impact: ${maintenance.impact}\nScheduled For: ${new Date(maintenance.scheduled_for).toLocaleString()}\nScheduled Until: ${new Date(maintenance.scheduled_until).toLocaleString()}`);
    }

    const completed_embed = new MessageEmbed().setTitle('Completed').setTimestamp();

    if (completed.length === 0) {
        completed_embed.setDescription('No recent maintenance has been completed.');
    } else {
        completed_embed.setDescription('Recently completed maintenance can be found below.');
    }

    for (const maintenance of completed) {
        completed_embed.addField(maintenance.name, `Impact: ${maintenance.impact}\nStarted: ${new Date(maintenance.started_at).toLocaleString()}\nResolved: ${new Date(maintenance.resolved_at).toLocaleString()}`);
    }

    await message.edit({ embeds: [ in_progress_embed, upcoming_embed, completed_embed ] });

}, config.interval_check);

client.login(config.token);