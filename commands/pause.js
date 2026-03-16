const { getVoiceConnection, AudioPlayerStatus } = require('@discordjs/voice');

module.exports = {
    name: 'pause',
    async execute(message) {
        const conn = getVoiceConnection(message.guild.id);
        if (!conn?.state?.subscription?.player) return message.reply('❌ | Nada tocando.').catch(() => {});

        const player = conn.state.subscription.player;

        if (player.state.status === AudioPlayerStatus.Paused) {
            player.unpause();
            message.reply('▶️ | Continuando!').catch(() => {});
        } else if (player.state.status === AudioPlayerStatus.Playing) {
            player.pause();
            message.reply('⏸ | Pausado!').catch(() => {});
        } else {
            message.reply('❌ | Nada tocando.').catch(() => {});
        }
    },
};
