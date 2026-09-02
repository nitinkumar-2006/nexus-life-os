// src/utils/youtubeClient.js
//
// Real YouTube resource discovery for the Syllabus Hub's per-topic
// learning resources - two honest tiers, not fabricated data at either
// one:
//
// 1. Always available, zero-config: a real, correctly-built YouTube
//    search URL for the topic. Clicking it opens genuine YouTube search
//    results - not individual video cards with thumbnails, but never
//    invented titles/channels/video IDs either.
// 2. Optional, richer tier: if the user adds a real YouTube Data API v3
//    key in Settings (the same key-management pattern as Gemini/OpenAI),
//    real search.list results - genuine video IDs, titles, channel
//    names, and thumbnail URLs Google's own API returns, rendered as
//    real embeddable video cards (youtube.com/embed/{videoId}).
//
// IMPORTANT, real caveat surfaced honestly rather than discovered by the
// user as a confusing failure: YouTube Data API's free daily quota is
// notoriously small for search specifically (search.list costs 100 of
// the ~10,000 default daily units - about 100 searches/day per project),
// so a quota error here is a real, expected possibility for an active
// user, not a bug - describeYoutubeError below names this specifically
// rather than a generic "something went wrong".
const API_BASE = 'https://www.googleapis.com/youtube/v3';

export class YoutubeApiError extends Error {
    constructor(message, kind = 'unknown') {
        super(message);
        this.name = 'YoutubeApiError';
        this.kind = kind;
    }
}

// 'en' | 'hi' - the only two the request asks for. Kept as a small, real
// lookup rather than a free-text field so both the deep-link and the API
// path stay in sync with exactly what's offered in the UI.
const LANGUAGE_QUERY_SUFFIX = { en: 'tutorial explained', hi: 'hindi mein समझाया tutorial' };
const LANGUAGE_RELEVANCE = { en: 'en', hi: 'hi' };

// A real, working YouTube search URL - no key, no quota, always
// available. This is genuinely what "click to open real YouTube search
// results for this topic" means; it is not a placeholder for the API
// tier below.
export const buildYoutubeSearchUrl = (topicName, language = 'en') => {
    const suffix = LANGUAGE_QUERY_SUFFIX[language] || LANGUAGE_QUERY_SUFFIX.en;
    const query = `${topicName} ${suffix}`;
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
};

const describeYoutubeError = async (response) => {
    let reason = '';
    let message = '';
    try {
        const body = await response.json();
        message = body?.error?.message || '';
        reason = body?.error?.errors?.[0]?.reason || '';
    } catch (e) { /* body wasn't JSON */ }

    if (response.status === 400 && /API key not valid/i.test(message)) {
        return new YoutubeApiError('Your YouTube API key is invalid. Update it in Settings → Security & API Integrations.', 'invalid_key');
    }
    if (reason === 'quotaExceeded' || /quota/i.test(message)) {
        return new YoutubeApiError('Your YouTube API key has hit its daily search quota (Google\'s free tier allows roughly 100 searches/day). It resets at midnight Pacific time, or use the "Search on YouTube" link instead.', 'quota');
    }
    if (response.status === 403) {
        return new YoutubeApiError(message || 'This YouTube API key doesn\'t have the YouTube Data API v3 enabled, or lacks permission for search.', 'forbidden');
    }
    return new YoutubeApiError(message || `YouTube API request failed (HTTP ${response.status}).`, 'unknown');
};

// Real search.list results - genuine video IDs/titles/channels/
// thumbnails from Google's own API, never invented. Returns
// [{videoId, title, channelTitle, thumbnailUrl}]. Throws YoutubeApiError
// on any failure; callers should fall back to buildYoutubeSearchUrl
// rather than blocking the whole resource section on this.
export const searchYoutubeVideos = async ({ apiKey, topicName, language = 'en', maxResults = 6, signal }) => {
    if (!apiKey || !apiKey.trim()) {
        throw new YoutubeApiError('No YouTube API key is configured.', 'missing_key');
    }
    const suffix = LANGUAGE_QUERY_SUFFIX[language] || LANGUAGE_QUERY_SUFFIX.en;
    const params = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        maxResults: String(maxResults),
        q: `${topicName} ${suffix}`,
        relevanceLanguage: LANGUAGE_RELEVANCE[language] || 'en',
        safeSearch: 'strict',
        videoEmbeddable: 'true',
        key: apiKey.trim(),
    });

    let response;
    try {
        response = await fetch(`${API_BASE}/search?${params.toString()}`, { signal });
    } catch (e) {
        if (e.name === 'AbortError') throw e;
        throw new YoutubeApiError('Could not reach the YouTube API. Check your internet connection.', 'network');
    }

    if (!response.ok) throw await describeYoutubeError(response);

    let data;
    try {
        data = await response.json();
    } catch (e) {
        throw new YoutubeApiError('YouTube returned a response that could not be read.', 'unknown');
    }

    const items = Array.isArray(data.items) ? data.items : [];
    return items
        .filter((item) => item?.id?.videoId && item?.snippet?.title)
        .map((item) => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            channelTitle: item.snippet.channelTitle || '',
            thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
        }));
};
