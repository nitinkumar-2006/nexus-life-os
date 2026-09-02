// src/utils/saavnClient.js
//
// A thin client for the unofficial JioSaavn API (the widely-deployed
// `sumitkolhe/jiosaavn-api` shape and its many public mirrors). There is
// no official Saavn/JioSaavn public API - every wrapper is a community
// reverse-engineering project, unauthenticated, and prone to being
// redeployed at a new URL with no notice. Confirmed live while building
// this: `saavn.me` and `saavn.dev` (two of the most commonly referenced
// mirrors) do not currently resolve at all. Because of that, the base URL
// is read from Settings (saavnApiBaseUrl, see streamingConfig.js) rather
// than hardcoded - if search/playback stops working, the fix is updating
// that one field to whatever mirror (or self-hosted instance) is
// currently live, not a code change.
import { getSaavnApiBaseUrl } from '../config/streamingConfig.js';

// Every field access below is defensive (optional chaining + fallbacks
// across the couple of key-naming variants seen across different mirror
// deployments of this same underlying project) since the exact response
// shape is not something this app controls or can guarantee stays fixed.
const pickBestDownloadUrl = (downloadUrl) => {
    if (!Array.isArray(downloadUrl) || downloadUrl.length === 0) return '';
    // Highest-quality entry is conventionally last (12kbps -> 320kbps) -
    // sorted defensively by parsing the leading number out of `quality`
    // (e.g. "320kbps") rather than assuming array order, since that's not
    // documented as a guarantee.
    const withRank = downloadUrl.map((entry) => ({
        entry,
        rank: parseInt(String(entry?.quality || '0'), 10) || 0,
    }));
    withRank.sort((a, b) => b.rank - a.rank);
    return withRank[0]?.entry?.url || downloadUrl[downloadUrl.length - 1]?.url || '';
};

const normalizeTrack = (raw) => {
    if (!raw) return null;
    const artistNames = raw?.artists?.primary?.map((a) => a?.name).filter(Boolean)
        || (Array.isArray(raw?.primaryArtists) ? raw.primaryArtists : (typeof raw?.primaryArtists === 'string' ? raw.primaryArtists.split(', ') : []))
        || [];
    const streamUrl = pickBestDownloadUrl(raw?.downloadUrl) || raw?.media_url || raw?.url || '';
    const artworkList = raw?.image;
    const artworkUrl = Array.isArray(artworkList) ? (artworkList[artworkList.length - 1]?.url || artworkList[artworkList.length - 1]?.link || '') : (typeof artworkList === 'string' ? artworkList : '');
    if (!streamUrl) return null; // a result with no resolvable stream URL is useless to the player, drop it
    return {
        id: raw.id || raw.songid || `saavn-${raw.name || 'track'}-${Math.random().toString(36).slice(2, 8)}`,
        title: raw.name || raw.song || 'Unknown Title',
        artist: artistNames.length ? artistNames.join(', ') : (raw.subtitle || ''),
        url: streamUrl,
        artworkUrl,
        durationSec: Number(raw.duration) || 0,
        source: 'saavn',
    };
};

// searchSaavnSongs(query, { limit }) -> Promise<Array<{id,title,artist,url,artworkUrl,durationSec,source}>>
// Throws a real, readable Error on network failure / non-2xx / unexpected
// shape - callers (GlobalSearchTab) are expected to catch this and show a
// toast rather than letting it surface as an unhandled rejection.
export const searchSaavnSongs = async (query, { limit = 15, signal } = {}) => {
    const trimmed = (query || '').trim();
    if (!trimmed) return [];
    const base = getSaavnApiBaseUrl().replace(/\/+$/, '');
    const url = `${base}/search/songs?query=${encodeURIComponent(trimmed)}&limit=${limit}`;
    let res;
    try {
        res = await fetch(url, { signal });
    } catch (e) {
        if (e?.name === 'AbortError') throw e;
        throw new Error(`Could not reach the Saavn API at ${base} (network error or the mirror is down - update the Saavn API Base URL in Settings if this persists).`);
    }
    if (!res.ok) {
        // These wrapper APIs commonly return a real, readable JSON error
        // body even on a non-2xx response (route-not-found messages, or -
        // the specific case that prompted this - a 500 whose own message
        // says it got back an HTML page instead of JSON from JioSaavn's
        // real backend, i.e. the mirror's routing is fine but ITS OWN
        // request to JioSaavn failed/got blocked). Surfacing that exact
        // message is far more actionable than a bare status code.
        let upstreamMessage = '';
        try { upstreamMessage = (await res.json())?.message || ''; } catch (e) { /* body wasn't JSON - fall through to the generic message below */ }
        if (res.status >= 500) {
            throw new Error(`Saavn search failed (HTTP ${res.status}${upstreamMessage ? `: ${upstreamMessage}` : ''}) - the mirror itself is reachable, but its own request to JioSaavn's real backend failed. This is usually temporary (JioSaavn rate-limiting or blocking that mirror's server), not a wrong URL - try again shortly, or try a different mirror in Settings.`);
        }
        throw new Error(`Saavn search failed (HTTP ${res.status}${upstreamMessage ? `: ${upstreamMessage}` : ''}) - the configured mirror's route may be wrong or it may have moved; check the Saavn API Base URL in Settings.`);
    }
    let json;
    try {
        json = await res.json();
    } catch (e) {
        throw new Error('Saavn API returned a non-JSON response - the configured mirror may be misconfigured or down.');
    }
    // Two shapes seen across mirrors: { data: { results: [...] } } (the
    // common one) and a bare { results: [...] } / [...] fallback.
    const results = json?.data?.results || json?.results || (Array.isArray(json) ? json : []);
    if (!Array.isArray(results)) throw new Error('Saavn API returned an unexpected response shape.');
    return results.map(normalizeTrack).filter(Boolean);
};
