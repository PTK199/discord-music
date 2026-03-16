// ══════════════════════════════════════
//  Spotify — API + Embed Fallback
// ══════════════════════════════════════

let accessToken = null;
let tokenExpiry = 0;

async function getToken() {
    const id = process.env.SPOTIFY_CLIENT_ID;
    const secret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!id || !secret) return null;

    if (accessToken && Date.now() < tokenExpiry) return accessToken;

    console.log('[spotify] Obtendo token...');
    const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
        },
        body: 'grant_type=client_credentials',
    });

    const data = await res.json();
    if (!res.ok) {
        console.error('[spotify] Token falhou:', res.status, data);
        throw new Error(`Token erro: ${data.error || res.status}`);
    }

    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    console.log('[spotify] Token OK ✓');
    return accessToken;
}

async function apiRequest(endpoint) {
    const token = await getToken();
    if (!token) return null;

    const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!res.ok) return null;
    return res.json();
}

// ══════════════════════════════════════
//  EMBED SCRAPING (fallback sem API)
// ══════════════════════════════════════
async function getTracksFromEmbed(type, id) {
    console.log(`[spotify] Usando embed para ${type}/${id}...`);
    const url = `https://open.spotify.com/embed/${type}/${id}`;
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    if (!res.ok) throw new Error(`Embed falhou: ${res.status}`);

    const html = await res.text();

    // Extrai JSON do __NEXT_DATA__
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (!match) throw new Error('Não consegui ler dados do embed');

    const nextData = JSON.parse(match[1]);
    const entity = nextData?.props?.pageProps?.state?.data?.entity;
    if (!entity) throw new Error('Dados do embed vazios');

    const results = [];

    // Pega a lista de tracks do entity
    const trackList = entity.trackList || [];
    for (const t of trackList.slice(0, 50)) {
        results.push({
            title: t.title || t.name || 'Unknown',
            artist: t.subtitle || '',
        });
    }

    // Se não achou trackList, tenta outro caminho
    if (!results.length && entity.tracks?.items) {
        for (const item of entity.tracks.items.slice(0, 50)) {
            const track = item.track || item;
            results.push({
                title: track.name || 'Unknown',
                artist: track.artists?.map(a => a.name).join(', ') || '',
            });
        }
    }

    console.log(`[spotify] Embed retornou ${results.length} tracks`);
    return results;
}

// ══════════════════════════════════════
//  INTERFACE PRINCIPAL
// ══════════════════════════════════════
function parseUrl(url) {
    const match = url.match(/spotify\.com\/(track|playlist|album)\/([a-zA-Z0-9]+)/);
    if (!match) return null;
    return { type: match[1], id: match[2] };
}

async function getTracks(url) {
    const parsed = parseUrl(url);
    if (!parsed) throw new Error('URL do Spotify inválida');

    console.log(`[spotify] ${parsed.type}/${parsed.id}`);
    const results = [];

    if (parsed.type === 'track') {
        // Track individual — API funciona em Dev mode
        const data = await apiRequest(`/tracks/${parsed.id}?market=BR`);
        if (data) {
            results.push({
                title: data.name,
                artist: data.artists.map(a => a.name).join(', '),
            });
        } else {
            // Fallback pro embed
            return getTracksFromEmbed('track', parsed.id);
        }

    } else if (parsed.type === 'playlist') {
        // Playlist — API bloqueia em Dev mode, usa embed direto
        return getTracksFromEmbed('playlist', parsed.id);

    } else if (parsed.type === 'album') {
        // Álbum — tenta API primeiro, fallback embed
        const data = await apiRequest(`/albums/${parsed.id}?market=BR`);
        if (data?.tracks?.items) {
            for (const track of data.tracks.items.slice(0, 50)) {
                results.push({
                    title: track.name,
                    artist: track.artists.map(a => a.name).join(', '),
                });
            }
        } else {
            return getTracksFromEmbed('album', parsed.id);
        }
    }

    console.log(`[spotify] ${results.length} tracks encontradas`);
    return results;
}

function isSpotifyUrl(url) {
    return url.includes('open.spotify.com/');
}

module.exports = { getTracks, isSpotifyUrl, getToken };
