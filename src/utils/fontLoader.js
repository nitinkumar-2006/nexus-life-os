// src/utils/fontLoader.js
//
// Dynamically injects the real stylesheet a chosen font actually needs -
// Google Fonts for the `googleFont` entries, Fontshare for the two
// `fontshare` entries (Satoshi, General Sans - real fonts, just not on
// Google Fonts), and genuinely nothing at all for the system-font entries
// (Apple & Premium), which resolve via the OS's own installed fonts and
// have no stylesheet to fetch. One <link>, reused and its href swapped in
// place on every change (not a new tag appended each time), so switching
// fonts repeatedly never accumulates stale <link> elements in <head>.
const DYNAMIC_FONT_LINK_ID = 'nexus-dynamic-font-link';

const buildGoogleFontsUrl = (option) =>
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(option.googleFont)}:wght@${option.weights}&display=swap`;

const buildFontshareUrl = (option) =>
    `https://api.fontshare.com/v2/css?f[]=${option.fontshare}@${option.weights}&display=swap`;

export const loadFontStylesheet = (option) => {
    if (typeof document === 'undefined' || !option) return;

    let link = document.getElementById(DYNAMIC_FONT_LINK_ID);

    if (!option.googleFont && !option.fontshare) {
        // A real system font (Apple & Premium category) - nothing to
        // fetch. Remove any previously-loaded web font stylesheet so it
        // doesn't linger unused.
        if (link) link.remove();
        return;
    }

    const href = option.googleFont ? buildGoogleFontsUrl(option) : buildFontshareUrl(option);
    if (!link) {
        link = document.createElement('link');
        link.id = DYNAMIC_FONT_LINK_ID;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
};

// Real, live previews for every option in the Typography picker's expanded
// grid need every font's stylesheet loaded - but the library is genuinely
// 130+ fonts now, and both Google Fonts' and Fontshare's own CSS2 APIs
// support requesting MANY families in a single stylesheet request (repeated
// `family=`/`f[]=` query params), not just one. Firing one consolidated
// request per ~12 fonts instead of one request PER font is the real,
// meaningful difference between ~10 network round-trips and 130+ of them
// the moment someone opens the picker - this is what "optimized for a
// React/Vite setup" actually means here, not just organizing the CSS.
// Chunked (not one giant request) to stay safely under practical URL
// length limits some proxies/CDNs still enforce (~2000 chars).
const PREVIEW_LINK_ID_PREFIX = 'nexus-font-preview-batch-';
const CHUNK_SIZE = 12;

const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

const buildBatchedGoogleFontsUrl = (options) => {
    const families = options.map((o) => `family=${encodeURIComponent(o.googleFont)}:wght@${o.weights}`).join('&');
    return `https://fonts.googleapis.com/css2?${families}&display=swap`;
};

const buildBatchedFontshareUrl = (options) => {
    const families = options.map((o) => `f[]=${o.fontshare}@${o.weights}`).join('&');
    return `https://api.fontshare.com/v2/css?${families}&display=swap`;
};

// Idempotent per batch-of-provider (checks for an existing tag before
// appending), so repeatedly expanding/collapsing the picker never
// re-fetches or duplicates stylesheets already loaded this session. Call
// once with the full FONT_OPTIONS list when the picker actually opens -
// not on every normal page load, only when someone is actually browsing
// the library.
export const preloadFontsForPreview = (options) => {
    if (typeof document === 'undefined' || !Array.isArray(options)) return;

    const googleOptions = options.filter((o) => o.googleFont);
    const fontshareOptions = options.filter((o) => o.fontshare);

    chunk(googleOptions, CHUNK_SIZE).forEach((group, i) => {
        const id = `${PREVIEW_LINK_ID_PREFIX}google-${i}`;
        if (document.getElementById(id)) return;
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = buildBatchedGoogleFontsUrl(group);
        document.head.appendChild(link);
    });

    chunk(fontshareOptions, CHUNK_SIZE).forEach((group, i) => {
        const id = `${PREVIEW_LINK_ID_PREFIX}fontshare-${i}`;
        if (document.getElementById(id)) return;
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = buildBatchedFontshareUrl(group);
        document.head.appendChild(link);
    });
};
