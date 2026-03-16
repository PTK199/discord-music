const { getVoiceConnection, AudioPlayerStatus } = require('@discordjs/voice');

module.exports = {
    name: 'skip',
    async execute(message) {
        const conn = getVoiceConnection(message.guild.id);
        if (!conn?.state?.subscription?.player) return message.reply('❌ | Nada tocando.').catch(() => {});

        const player = conn.state.subscription.player;
        if (player.state.status === AudioPlayerStatus.Idle) {
            return message.reply('❌ | Nada tocando.').catch(() => {});
        }

        player.stop(); // Idle → dispara playNext automaticamente
        message.reply('⏭ | Pulada!').catch(() => {});
    },
};
