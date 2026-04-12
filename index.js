require('dotenv').config();
const { Client, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const playdl = require('play-dl');

// ── Proteção contra crash (Discloud/Docker) ──
process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

// ── FFmpeg ──
try {
    const fp = require('ffmpeg-static');
    if (fp && fs.existsSync(fp)) {
        process.env.FFMPEG_PATH = fp;
        console.log(`[ffmpeg] ${fp}`);
    } else throw 0;
} catch { console.log('[ffmpeg] usando do sistema'); }

// ── Opus + Encryption ──
try { require('opusscript');  console.log('[opus] opusscript ✓'); } catch { console.log('[opus] ✗'); }
try { require('tweetnacl');   console.log('[enc]  tweetnacl ✓');  } catch { console.log('[enc]  ✗'); }

// ── Bot ──
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.commands = new Collection();

// ── Carregar comandos ──
const cmdDir = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'))) {
    const cmd = require(path.join(cmdDir, file));
    client.commands.set(cmd.name, cmd);
    console.log(`[cmd] ${cmd.name}`);
}

// ── Mensagens ──
client.on('messageCreate', async (msg) => {
    const prefix = process.env.PREFIX || 'e!';
    if (!msg.content.startsWith(prefix) || msg.author.bot || !msg.member) return;

    const args = msg.content.slice(prefix.length).trim().split(/ +/);
    const name = args.shift().toLowerCase();
    const cmd = client.commands.get(name);
    if (!cmd) return;

    // Auth — creator, cargos específicos, ou admin do servidor
    const roles = ['1395958089613705226', '1395958095510769765'];
    const creator = '1202072357729206306';
    const isCreator = msg.author.id === creator;
    const hasRole = msg.member.roles.cache.some(r => roles.includes(r.id));
    const isAdmin = msg.member.permissions.has('Administrator');
    if (!isCreator && !hasRole && !isAdmin) {
        return msg.reply('❌ | Sem permissão.').catch(() => {});
    }

    try {
        await cmd.execute(msg, args);
    } catch (e) {
        console.error(`[err] ${name}:`, e);
        msg.reply('❌ | Erro no comando.').catch(() => {});
    }
});

// ── SoundCloud Init (com retry) ──
let scReady = false;

async function initSoundCloud() {
    for (let i = 1; i <= 5; i++) {
        try {
            console.log(`[play-dl] Tentativa ${i}/5 de obter SoundCloud client_id...`);
            const id = await playdl.getFreeClientID();
            playdl.setToken({ soundcloud: { client_id: id } });
            console.log('[play-dl] SoundCloud client_id OK ✓');
            scReady = true;
            return true;
        } catch (e) {
            console.log(`[play-dl] Falhou: ${e.message}`);
            if (i < 5) await new Promise(r => setTimeout(r, 3000));
        }
    }
    console.log('[play-dl] ⚠ SoundCloud não inicializado após 5 tentativas');
    return false;
}

// Exporta pra o play.js poder chamar se precisar
module.exports.initSoundCloud = initSoundCloud;
module.exports.isSCReady = () => scReady;

// ── Iniciar ──
async function main() {
    await initSoundCloud();

    client.once('ready', () => {
        console.log(`\n✅ Bot online: ${client.user.tag} | Prefix: ${process.env.PREFIX || 'e!'}\n`);
        client.user.setActivity('Desenvolvido por PTK', { type: ActivityType.Watching });
    });

    await client.login(process.env.DISCORD_TOKEN);
}

main().catch(e => { console.error('[FATAL]', e); process.exit(1); });
