// src/utils/spotifyClient.js
//
// Search-only client for Spotify's real Web API - used by the Audio Hub's
// search tab once the user has connected their own account (see
// StreamingContext.jsx's PKCE flow). Every Spotify track result carries
// BOTH a `previewUrl` (a real, legal 30-second MP3 clip, playable through
// the exact same <audio> pathway local/Saavn tracks already use) and a
// `uri` (a spotify:track:... identifier only usable via the Web Playback
// SDK - i.e. full-length playback, which additionally requires a Spotify
// PREMIUM account, a real restriction of Spotify's own SDK this app can't
// change). Spotify has been progressively removing preview_url from many
// tracks over the past couple of years for licensing reasons - a null
// previewUrl on a given result is expected, not a bug, and the caller is
// expected to handle it (fall back to full SDK playback if a device is
// ready, otherwise show the track as preview-unavailable) rather than
// assume every result has one.
export const searchSpotifyTracks = async (accessToken, query, { limit = 15, offset, signal } = {}) => {
    const trimmed = (query || '').trim();
    if (!trimmed) return [];
    if (!accessToken) throw new Error('Spotify is not connected - click "Connect Spotify" in Settings first.');

    // Spotify's own docs list a valid `limit` range of 1-50, but this
    // app's newly re-created (Development Mode) app returned a real,
    // authenticated "Invalid limit" error at 15 - live-verified this
    // wasn't a token problem (a garbage token gets a 401 first, before
    // Spotify even looks at query params, so the 400 here only happens
    // once auth genuinely succeeds). Rather than guess at some smaller
    // "safe" number that might ALSO be rejected by whatever restriction
    // this specific access level enforces, the limit param is left off
    // the request entirely - Spotify applies its own default (20) when
    // it's absent, sidestepping the issue outright instead of chasing it.
    void limit; // kept in the signature for future callers, deliberately unused for now
    const params = new URLSearchParams({ q: trimmed, type: 'track' });
    // `offset` is a genuinely separate param from the one that broke above
    // - only ever added when a caller (searchManySpotifyTracks below)
    // explicitly passes one, so a plain single-page call's request shape
    // is completely unchanged from before.
    if (Number.isFinite(offset) && offset > 0) params.set('offset', String(offset));
    let res;
    try {
        res = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal,
        });
    } catch (e) {
        if (e?.name === 'AbortError') throw e;
        throw new Error('Could not reach the Spotify API (network error).');
    }
    if (res.status === 401) {
        throw new Error('Spotify session expired - reconnect in Settings > Security & API.');
    }
    if (res.status === 403) {
        // Read the REAL body first - a hardcoded guess here (as this used
        // to be) stops being useful the moment that guess turns out wrong
        // (e.g. once "Web API" is already enabled on the app and it still
        // 403s for some OTHER reason). Spotify's actual error body is the
        // real source of truth every time.
        let realMessage = '';
        try {
            const errJson = await res.json();
            realMessage = errJson?.error?.message || '';
        } catch (e) { /* body wasn't JSON */ }
        throw new Error(
            `Spotify search failed (HTTP 403 - Forbidden)${realMessage ? `: ${realMessage}` : ' - no message body returned'}. `
            + 'If this persists after confirming "Web API" is enabled at developer.spotify.com/dashboard, the app may need re-authorization (disconnect + reconnect) or could be a different, less common restriction - the message above (if any) is Spotify\'s own stated reason.'
        );
    }
    if (!res.ok) {
        let message = `Spotify search failed (HTTP ${res.status})`;
        try {
            const errJson = await res.json();
            if (errJson?.error?.message) message = `Spotify search failed: ${errJson.error.message}`;
            else {
                const rawText = JSON.stringify(errJson).slice(0, 200);
                if (rawText && rawText !== '{}') message += ` - ${rawText}`;
            }
        } catch (e) { /* body wasn't JSON - keep the generic HTTP-status message */ }
        throw new Error(message);
    }

    const json = await res.json();
    const items = Array.isArray(json?.tracks?.items) ? json.tracks.items : [];
    return items
        .filter((t) => t?.id)
        .map(normalizeSpotifyTrack);
};

// Real, reported gap closed: a single search call only ever returns
// Spotify's own default page size (20, since `limit` can't be sent - see
// searchSpotifyTracks's own comment), which read as "only 4-5 real songs"
// once a genre tile's own client-side filtering/dedup trimmed that further
// - nowhere near "kam se kam 200-300" for a real genre/mood browse. This
// pages through the SAME endpoint with only `offset` (never `limit`, so it
// can never re-trigger the earlier "Invalid limit" 400), firing every
// page's request in parallel (not one-by-one) so a real 200-track fetch
// takes roughly one request's latency instead of ten, then keeps whichever
// pages succeeded even if one or two individually fail (a single flaky
// page shouldn't blank the whole genre) - only throws if EVERY page
// failed. `maxPages` (10 x Spotify's own ~20-per-page default) is a real
// safety cap on API calls per open, close to the requested 200-300 without
// hammering the API on every tap. Duplicate track ids across pages
// (Spotify's own ranking can repeat a track across adjacent pages) are
// removed.
export const searchManySpotifyTracks = async (accessToken, query, { targetCount = 200, startOffset = 0, maxPages = 10, signal } = {}) => {
    const trimmed = (query || '').trim();
    if (!trimmed) return [];
    const pageCount = Math.ceil(targetCount / 20);
    const offsets = Array.from({ length: Math.min(pageCount, maxPages) }, (_, i) => startOffset + i * 20);
    const settled = await Promise.allSettled(
        offsets.map((offset) => searchSpotifyTracks(accessToken, trimmed, { offset, signal }))
    );
    const failures = settled.filter((r) => r.status === 'rejected');
    if (failures.length === settled.length) {
        throw failures[0].reason instanceof Error ? failures[0].reason : new Error('Could not load this genre');
    }
    const seen = new Set();
    const all = [];
    for (const r of settled) {
        if (r.status !== 'fulfilled') continue;
        for (const t of r.value) {
            if (seen.has(t.id)) continue;
            seen.add(t.id);
            all.push(t);
        }
    }
    return all.slice(0, targetCount);
};

// Real fix for a real, reported gap: the "Playlists & Albums" row only
// ever showed this app's own pre-existing demo/mock catalog (Focus Flow,
// Deep Work, etc.) even once Spotify was genuinely connected - there was
// no path to the user's own real playlists at all. Returns the raw
// Spotify playlist objects (id/name/images/tracks.total) - deliberately
// NOT normalized into this app's own local playlist shape (trackRefs()
// etc.), since a Spotify playlist's tracks are fetched separately/lazily
// (see getSpotifyPlaylistTracks) rather than known up front.
export const getSpotifyPlaylists = async (accessToken, { signal } = {}) => {
    if (!accessToken) throw new Error('Spotify is not connected.');
    let res;
    try {
        res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal,
        });
    } catch (e) {
        if (e?.name === 'AbortError') throw e;
        throw new Error('Could not reach the Spotify API (network error).');
    }
    if (!res.ok) throw new Error(await describeSpotifyError(res, 'Could not load your Spotify playlists'));
    const json = await res.json();
    const items = Array.isArray(json?.items) ? json.items : [];
    return items.filter(Boolean).map((p) => ({
        id: p.id,
        title: p.name || 'Untitled Playlist',
        description: p.description || '',
        artworkUrl: p.images?.[0]?.url || '',
        trackCount: p.tracks?.total || 0,
        source: 'spotify',
    }));
};

// Lazily fetches one playlist's actual tracks (only called when the user
// opens it) - same normalizeSpotifyTrack shape search results already use,
// so the resulting rows can reuse the exact same play/preview/favorite
// handling GlobalSearchTab already has, rather than a second, parallel
// implementation.
export const getSpotifyPlaylistTracks = async (accessToken, playlistId, { signal } = {}) => {
    if (!accessToken) throw new Error('Spotify is not connected.');
    let res;
    try {
        res = await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal,
        });
    } catch (e) {
        if (e?.name === 'AbortError') throw e;
        throw new Error('Could not reach the Spotify API (network error).');
    }
    if (!res.ok) throw new Error(await describeSpotifyError(res, "Could not load this playlist's tracks"));
    const json = await res.json();
    const items = Array.isArray(json?.items) ? json.items : [];
    return items.map((item) => item?.track).filter((t) => t?.id).map(normalizeSpotifyTrack);
};

// Shared "why did this actually fail" helper - reads Spotify's own real
// error body (its message, or the raw JSON if the shape is unexpected)
// instead of a bare HTTP status, the same real lesson learned from the
// search 403 earlier: a generic status-code-only message gave no way to
// act on it, and the real cause (account/app mismatch) only became
// findable once the actual body was surfaced.
async function describeSpotifyError(res, prefix) {
    if (res.status === 403) {
        try {
            const errJson = await res.json();
            const realMessage = errJson?.error?.message;
            return `${prefix} (HTTP 403 - Forbidden)${realMessage ? `: ${realMessage}` : ' - no message body returned'}. This can happen for a Spotify-owned/editorial playlist (not one you created yourself) that this app's access level doesn't cover, not necessarily an account problem.`;
        } catch (e) {
            return `${prefix} (HTTP 403 - Forbidden, no message body returned).`;
        }
    }
    try {
        const errJson = await res.json();
        if (errJson?.error?.message) return `${prefix}: ${errJson.error.message}`;
    } catch (e) { /* body wasn't JSON */ }
    return `${prefix} (HTTP ${res.status}).`;
}

async function fetchLikedSongsPage(accessToken, limit, offset, signal) {
    let res;
    try {
        res = await fetch(`https://api.spotify.com/v1/me/tracks?limit=${limit}&offset=${offset}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal,
        });
    } catch (e) {
        if (e?.name === 'AbortError') throw e;
        throw new Error('Could not reach the Spotify API (network error).');
    }
    if (!res.ok) throw new Error(await describeSpotifyError(res, 'Could not load your Spotify Liked Songs'));
    return res.json();
}

// Real, explicitly-requested feature: the user's ACTUAL Spotify "Liked
// Songs" library (GET /v1/me/tracks - a different endpoint from a
// playlist's own tracks, this is Spotify's one dedicated saved-tracks
// list), not just tracks favorited from inside this app. Uses the exact
// same normalizeSpotifyTrack shape everything else here does.
//
// Real, reported bug fixed: this used to fetch a single page (default
// limit 50) and stop - a real account with more than 50 Liked Songs (this
// user's own, confirmed by comparing against the real Spotify mobile app)
// only ever saw its first 50 here, which read as "sab dikh nahi raha" even
// though nothing was actually broken, just silently truncated. Now reads
// the real `total` from Spotify's own first page and fetches every
// remaining page in parallel (same pattern as searchManySpotifyTracks),
// capped at a real safety limit (1000 tracks / 20 pages) rather than an
// unbounded fetch for an account with an unusually large library.
export const getSpotifyLikedSongs = async (accessToken, { signal } = {}) => {
    if (!accessToken) throw new Error('Spotify is not connected.');
    const pageSize = 50;
    const maxTracks = 1000;
    const first = await fetchLikedSongsPage(accessToken, pageSize, 0, signal);
    const total = Math.min(Number(first?.total) || 0, maxTracks);
    const firstItems = Array.isArray(first?.items) ? first.items : [];
    const remainingOffsets = [];
    for (let offset = pageSize; offset < total; offset += pageSize) remainingOffsets.push(offset);
    const restResults = remainingOffsets.length
        ? await Promise.allSettled(remainingOffsets.map((offset) => fetchLikedSongsPage(accessToken, pageSize, offset, signal)))
        : [];
    const allItems = [...firstItems];
    for (const r of restResults) {
        if (r.status === 'fulfilled' && Array.isArray(r.value?.items)) allItems.push(...r.value.items);
    }
    return allItems.map((item) => item?.track).filter((t) => t?.id).map(normalizeSpotifyTrack);
};

// Real, explicitly-requested "New Releases" section - Spotify's actual
// `GET /v1/browse/new-releases` catalog-browse endpoint (a plain, non-
// personalized global feed - no special app permission beyond a normal
// connected token, unlike the recommendations endpoints that are largely
// restricted for newer apps). Returns real albums, not tracks - see
// getSpotifyAlbumTracks below for opening one.
export const getSpotifyNewReleases = async (accessToken, { signal } = {}) => {
    if (!accessToken) throw new Error('Spotify is not connected.');
    let res;
    try {
        res = await fetch('https://api.spotify.com/v1/browse/new-releases?limit=20', {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal,
        });
    } catch (e) {
        if (e?.name === 'AbortError') throw e;
        throw new Error('Could not reach the Spotify API (network error).');
    }
    if (!res.ok) throw new Error(await describeSpotifyError(res, 'Could not load new releases'));
    const json = await res.json();
    const items = Array.isArray(json?.albums?.items) ? json.albums.items : [];
    return items.filter(Boolean).map((a) => ({
        id: a.id,
        title: a.name || 'Untitled',
        artist: Array.isArray(a.artists) ? a.artists.map((x) => x.name).filter(Boolean).join(', ') : '',
        artworkUrl: a.images?.[0]?.url || '',
    }));
};

// An album's own tracks endpoint returns SIMPLIFIED track objects with no
// `album` field of their own (they belong to the one album being fetched,
// unlike a playlist's mixed-album tracks) - so normalizeSpotifyTrack's own
// `t.album?.images` lookup would find nothing here. `albumArtworkUrl` is
// passed in from the already-known album instead.
export const getSpotifyAlbumTracks = async (accessToken, albumId, albumArtworkUrl, { signal } = {}) => {
    if (!accessToken) throw new Error('Spotify is not connected.');
    let res;
    try {
        res = await fetch(`https://api.spotify.com/v1/albums/${encodeURIComponent(albumId)}/tracks?limit=50`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal,
        });
    } catch (e) {
        if (e?.name === 'AbortError') throw e;
        throw new Error('Could not reach the Spotify API (network error).');
    }
    if (!res.ok) throw new Error(await describeSpotifyError(res, "Could not load this album's tracks"));
    const json = await res.json();
    const items = Array.isArray(json?.items) ? json.items : [];
    return items.filter((t) => t?.id).map((t) => ({
        id: t.id,
        uri: t.uri,
        title: t.name || 'Unknown Title',
        artist: Array.isArray(t.artists) ? t.artists.map((a) => a.name).filter(Boolean).join(', ') : '',
        artworkUrl: albumArtworkUrl || '',
        previewUrl: t.preview_url || null,
        durationSec: t.duration_ms ? Math.round(t.duration_ms / 1000) : 0,
        source: 'spotify',
    }));
};

function normalizeSpotifyTrack(t) {
    return {
        id: t.id,
        uri: t.uri,
        title: t.name || 'Unknown Title',
        artist: Array.isArray(t.artists) ? t.artists.map((a) => a.name).filter(Boolean).join(', ') : '',
        artworkUrl: t.album?.images?.[t.album.images.length - 1]?.url || t.album?.images?.[0]?.url || '',
        previewUrl: t.preview_url || null,
        durationSec: t.duration_ms ? Math.round(t.duration_ms / 1000) : 0,
        source: 'spotify',
    };
}
