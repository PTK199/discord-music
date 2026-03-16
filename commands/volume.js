const { getVoiceConnection } = require('@discordjs/voice');
const { getGuild } = require('./play.js');

module.exports = {
    name: 'volume',
    async execute(message, args) {
        const conn = getVoiceConnection(message.guild.id);
        if (!conn?.state?.subscription?.player) return message.reply('❌ | Nada tocando.').catch(() => {});

        const g = getGuild(message.guild.id);
        const player = conn.state.subscription.player;
        const resource = player.state.resource;

        if (!resource?.volume) {
            return message.reply('❌ | Controle de volume não disponível.').catch(() => {});
        }

        const vol = parseInt(args[0]);
        if (isNaN(vol)) {
            const current = Math.round(resource.volume.volume * 100);
            return message.reply(`🔊 | Volume atual: **${current}%**`).catch(() => {});
        }

        if (vol < 0 || vol > 150) {
            return message.reply('❌ | Volume entre 0 e 150!').catch(() => {});
        }

        const normalized = vol / 100;
        resource.volume.setVolume(normalized);
        g.volume = normalized; // Salva pra persistir entre músicas
        message.reply(`🔊 | Volume: **${vol}%**`).catch(() => {});
    },
};
