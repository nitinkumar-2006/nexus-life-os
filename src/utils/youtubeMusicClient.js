// src/utils/youtubeMusicClient.js
//
// Search-only client for the YouTube Data API v3 (music videos/lofi
// beats), used by the Audio Hub's search tab. Reuses the exact same
// youtubeApiKey the Syllabus Hub already validates in Settings > API
// Integrations - one confirmed key, two features. YouTube gives no
// direct, playable audio URL for a video (that's the whole reason the
// hidden IFrame player exists in AudioPlayerContext) - a result here
// carries a `videoId` instead of a `url`, and is played by handing that
// id to `playYoutubeTrack()`, not `playTrackNow()`.
import { getYoutubeApiKey } from '../config/streamingConfig.js';

// searchYoutubeTracks(query, { limit }) -> Promise<Array<{id,videoId,title,artist,artworkUrl,source}>>
// Throws a real, readable Error on a missing key / network failure /
// non-2xx (including YouTube's own quota-exceeded error body) - callers
// are expected to catch this and show a toast rather than letting it
// surface as an unhandled rejection.
export const searchYoutubeTracks = async (query, { limit = 15, signal } = {}) => {
    const trimmed = (query || '').trim();
    if (!trimmed) return [];
    const apiKey = getYoutubeApiKey();
    if (!apiKey) throw new Error('YouTube Data API key is not configured or not confirmed - add it in Settings > API Integrations.');

    const params = new URLSearchParams({
        part: 'snippet',
        q: trimmed,
        type: 'video',
        videoCategoryId: '10', // "Music" category
        maxResults: String(limit),
        key: apiKey,
    });

    let res;
    try {
        res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, { signal });
    } catch (e) {
        if (e?.name === 'AbortError') throw e;
        throw new Error('Could not reach the YouTube Data API (network error).');
    }
    if (!res.ok) {
        let message = `YouTube search failed (HTTP ${res.status})`;
        try {
            const errJson = await res.json();
            if (errJson?.error?.message) message = `YouTube search failed: ${errJson.error.message}`;
        } catch (e) { /* body wasn't JSON - keep the generic HTTP-status message */ }
        throw new Error(message);
    }

    const json = await res.json();
    const items = Array.isArray(json?.items) ? json.items : [];
    return items
        .filter((item) => item?.id?.videoId)
        .map((item) => ({
            id: item.id.videoId,
            videoId: item.id.videoId,
            title: item.snippet?.title || 'Unknown Title',
            artist: item.snippet?.channelTitle || '',
            artworkUrl: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
            source: 'youtube',
        }));
};
