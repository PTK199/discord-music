const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const playdl = require('play-dl');
const spotify = require('../spotify.js');

// ══════════════════════════════════════
//  FILA POR SERVIDOR
// ══════════════════════════════════════
const guilds = new Map();

function getGuild(id) {
    if (!guilds.has(id)) {
        guilds.set(id, {
            tracks: [],
            current: null,
            connection: null,
            player: null,
            textChannel: null,
            leaveTimer: null,
            volume: 1.0, // 1.0 = 100%
        });
    }
    return guilds.get(id);
}

// Exporta pra outros comandos usarem
module.exports.guilds = guilds;
module.exports.getGuild = getGuild;

// ══════════════════════════════════════
//  TOCAR PRÓXIMA DA FILA
// ══════════════════════════════════════
async function playNext(guildId) {
    const g = getGuild(guildId);
    if (!g.tracks.length) {
        g.current = null;
        g.textChannel?.send('✅ | Fila acabou.').catch(() => {});
        // Sai do canal depois de 5 min sem música
        g.leaveTimer = setTimeout(() => {
            if (g.connection) { g.connection.destroy(); }
            guilds.delete(guildId);
        }, 300000);
        return;
    }

    const track = g.tracks.shift();
    g.current = track;

    try {
        console.log(`[stream] Extraindo: ${track.title} — ${track.url}`);
        const stream = await playdl.stream(track.url);
        const resource = createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true });
        resource.volume.setVolume(g.volume); // Aplica volume salvo
        g.player.play(resource);
        console.log(`[▶] ${track.title}`);
        g.textChannel?.send(`▶️ | **${track.title}**`).catch(() => {});
    } catch (e) {
        console.error(`[stream err] ${track.title}:`, e.message);
        g.textChannel?.send(`❌ | Erro ao tocar **${track.title}**: ${e.message}`).catch(() => {});
        playNext(guildId); // Pula pra próxima
    }
}

// ══════════════════════════════════════
//  COMANDO PLAY
// ══════════════════════════════════════
module.exports.name = 'play';

module.exports.execute = async function (message, args) {
    const query = args.join(' ');
    if (!query) return message.reply('🎵 | Escreva o nome ou cole o link!');

    const vc = message.member.voice.channel;
    if (!vc) return message.reply('🔇 | Entra na call primeiro!');

    // Tenta inicializar SoundCloud se não tiver pronto
    const mainModule = require('../index.js');
    if (mainModule.isSCReady && !mainModule.isSCReady()) {
        try {
            await mainModule.initSoundCloud();
        } catch {}
    }

    const loading = await message.reply('⏳ | Buscando...').catch(() => null);

    try {
        // ── BUSCAR TRACKS ──
        let tracks = [];

        if (query.startsWith('http')) {
            if (spotify.isSpotifyUrl(query)) {
                // ── SPOTIFY (track, playlist, album) ──
                console.log('[search] Spotify URL detectada');
                if (loading) await loading.edit('⏳ | Buscando no Spotify...').catch(() => {});

                const spTracks = await spotify.getTracks(query);
                console.log(`[search] Spotify retornou ${spTracks.length} tracks`);

                let found = 0;
                for (const t of spTracks) {
                    const searchQ = `${t.title} ${t.artist}`;
                    const res = await playdl.search(searchQ, { source: { soundcloud: 'tracks' }, limit: 1 });
                    if (res.length) {
                        tracks.push({ title: t.title, url: res[0].url, duration: fmt(res[0].durationInMs) });
                        found++;
                    }
                }
                console.log(`[search] ${found}/${spTracks.length} encontradas no SoundCloud`);

                if (loading && spTracks.length > 1) {
                    await loading.edit(`⏳ | ${found}/${spTracks.length} músicas encontradas...`).catch(() => {});
                }

            } else if (query.includes('soundcloud.com')) {
                // ── SOUNDCLOUD URL ──
                const type = await playdl.validate(query);
                console.log(`[search] SoundCloud URL tipo: ${type}`);

                if (type === 'so_track') {
                    const info = await playdl.soundcloud(query);
                    tracks.push({ title: info.name, url: info.url, duration: fmt(info.durationInMs) });
                } else if (type === 'so_playlist') {
                    const pl = await playdl.soundcloud(query);
                    const all = await pl.all_tracks();
                    for (const t of all.slice(0, 50)) {
                        tracks.push({ title: t.name, url: t.url, duration: fmt(t.durationInMs) });
                    }
                }

            } else {
                // URL desconhecida — tenta buscar como texto
                const res = await playdl.search(query, { source: { soundcloud: 'tracks' }, limit: 1 });
                if (res.length) tracks.push({ title: res[0].name, url: res[0].url, duration: fmt(res[0].durationInMs) });
            }
        } else {
            // Texto → busca no SoundCloud
            const res = await playdl.search(query, { source: { soundcloud: 'tracks' }, limit: 1 });
            if (res.length) tracks.push({ title: res[0].name, url: res[0].url, duration: fmt(res[0].durationInMs) });
        }

        if (!tracks.length) {
            if (loading) await loading.edit('❌ | Não achei nada.').catch(() => {});
            return;
        }

        // ── CONFIGURAR VOICE ──
        const g = getGuild(message.guild.id);
        g.textChannel = message.channel;

        if (g.leaveTimer) { clearTimeout(g.leaveTimer); g.leaveTimer = null; }

        if (!g.connection || g.connection.state.status === VoiceConnectionStatus.Destroyed) {
            g.connection = joinVoiceChannel({
                channelId: vc.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
                selfDeaf: true,
            });

            g.player = createAudioPlayer();
            g.connection.subscribe(g.player);

            g.player.on(AudioPlayerStatus.Idle, () => playNext(message.guild.id));
            g.player.on('error', (e) => {
                console.error('[player err]', e.message);
                g.textChannel?.send(`❌ | Erro: ${e.message}`).catch(() => {});
                playNext(message.guild.id);
            });

            g.connection.on(VoiceConnectionStatus.Disconnected, () => {
                guilds.delete(message.guild.id);
            });
        }

        // ── ADICIONAR NA FILA ──
        const wasIdle = g.player.state.status === AudioPlayerStatus.Idle;
        g.tracks.push(...tracks);

        const plural = tracks.length > 1 ? `**${tracks.length} músicas**` : `**${tracks[0].title}**`;
        if (loading) {
            await loading.edit(`🎶 | ${plural} na fila!`).catch(() => {});
            setTimeout(() => loading.delete().catch(() => {}), 10000);
        }

        if (wasIdle) playNext(message.guild.id);

    } catch (e) {
        console.error('[play err]', e);
        if (loading) await loading.edit(`❌ | ${e.message}`).catch(() => {});
    }
};

function fmt(ms) {
    if (!ms) return '?:??';
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}
