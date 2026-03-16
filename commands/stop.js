const { getVoiceConnection } = require('@discordjs/voice');
const { guilds } = require('./play.js');

module.exports = {
    name: 'stop',
    async execute(message) {
        const conn = getVoiceConnection(message.guild.id);
        if (!conn) return message.reply('❌ | Não estou em nenhum canal.').catch(() => {});

        // Limpa a fila e desconecta
        guilds.delete(message.guild.id);
        conn.destroy();
        message.reply('🛑 | Parado e desconectado!').catch(() => {});
    },
};
