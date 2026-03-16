const { getGuild } = require('./play.js');

module.exports = {
    name: 'fila',
    async execute(message) {
        const g = getGuild(message.guild.id);
        if (!g.current && !g.tracks.length) {
            return message.reply('📭 | Fila vazia.').catch(() => {});
        }

        let text = '';
        if (g.current) text += `▶️ Tocando: **${g.current.title}** (${g.current.duration})\n\n`;

        if (g.tracks.length) {
            text += '📋 **Próximas:**\n';
            for (let i = 0; i < Math.min(g.tracks.length, 10); i++) {
                text += `${i + 1}. ${g.tracks[i].title} (${g.tracks[i].duration})\n`;
            }
            if (g.tracks.length > 10) text += `... e mais ${g.tracks.length - 10}`;
        } else {
            text += '📋 Nenhuma próxima na fila.';
        }

        message.reply(text).catch(() => {});
    },
};
