const { SlashCommandBuilder } = require('@discordjs/builders');
const admin = require('firebase-admin')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('subscribe')
        .setDescription('Subscribe to a collection')
        .addStringOption(option =>
            option.setName('slug')
                .setDescription('The slug of the collection')
                .setRequired(true)
        )
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send notifications to')
                .setRequired(true)
        ),
    async execute(interaction) {
        const slug = interaction.options.getString('slug');
        const channel = interaction.options.getChannel('channel');

        const firestore = admin.firestore()

        const guildId = interaction.guild.id;
        const channelId = channel.id;
        const subscriptionId = `${guildId}-${channelId}`;
        const subscriptionRef = firestore.collection('subscriptions').doc(slug);
        const subscriptionDoc = await subscriptionRef.get();
        if (!subscriptionDoc.exists) {
            await subscriptionRef.set({ guilds: [subscriptionId] });
            await interaction.reply(`Subscribed to ${slug} collection`);
            return;
        }
        let guilds = subscriptionDoc.data().guilds || [];
        for (let i = 0; i < guilds.length; i++) {
            const guildChannelId = guilds[i];
            if (guildChannelId === subscriptionId) {
                await interaction.reply(`Already subscribed to ${slug} collection`);
                return;
            } else {
                guilds.push(subscriptionId);
                await subscriptionRef.set({ guilds });
            }
        }
        await interaction.reply(`Subscribed to ${slug} collection`);
    }
};