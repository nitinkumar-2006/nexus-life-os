// src/config/streamingConfig.js
//
// ============================================================================
// TWO WAYS TO CONFIGURE SPOTIFY/APPLE MUSIC CREDENTIALS
// ============================================================================
// Preferred: open Settings > Security & API in the running app, paste your
// credentials into the Spotify/Apple Music fields, and click Confirm once
// each one validates. That's the same real localStorage value this file
// reads from below - no redeploy needed to change it.
//
// Alternative: edit the *_FALLBACK constants below directly and redeploy.
// This only takes effect for anyone who hasn't already set a value in
// Settings - a real, saved Settings value always takes priority over
// these constants, exactly as advertised.
//
// Same situation as src/firebase/config.js either way: both Spotify and
// Apple Music require a real, registered developer identity - there is no
// generic key that works for every installation of this app. Until one is
// provided (via either path above), isSpotifyConfigured()/
// isAppleMusicConfigured() return false and both "Connect" buttons show a
// clear "not configured" state (a tooltip explaining exactly what's
// missing) rather than crashing or pretending to authenticate.
//
// --- Spotify ---
//   1. Go to https://developer.spotify.com/dashboard and log in/create a
//      free account (no cost - a Spotify Premium account is only needed
//      later, for actual playback control, not for connecting).
//   2. Create an app. For "Redirect URI", enter EXACTLY the value below
//      (SPOTIFY_REDIRECT_URI) - Spotify rejects the login if this doesn't
//      match character-for-character.
//   3. Copy the Client ID shown on your app's dashboard page into Settings
//      (or SPOTIFY_CLIENT_ID_FALLBACK below). There is no secret to copy
//      here - this app uses the Authorization Code + PKCE flow
//      specifically so no client secret ever needs to exist in
//      browser-side code for the actual login (a plain secret embedded in
//      shipped JS is not secure). The Settings page's Client Secret field
//      is used only to validate the pair together before confirming, via
//      Spotify's separate Client Credentials flow - it's never sent as
//      part of the real PKCE login below.
//
// --- Apple Music ---
//   1. Requires an active Apple Developer Program membership (paid,
//      $99/year) with MusicKit access - there is no free tier for this.
//   2. In your developer account: Certificates, Identifiers & Profiles >
//      Keys > create a new key with "MusicKit" enabled. Apple gives you a
//      .p8 private key file once, which cannot be re-downloaded.
//   3. That private key must be used to SIGN a developer token (a JWT) -
//      this signing step has to happen with the private key kept secret,
//      so it belongs in a small server-side script or build step, never in
//      browser code. Paste the resulting signed token string into Settings
//      (or APPLE_MUSICKIT_DEVELOPER_TOKEN_FALLBACK below). These tokens
//      expire (Apple allows up to 6 months) and need regenerating before
//      they lapse.
// ============================================================================

// This Client ID was recreated (2026-09-02) under the user's OWN Spotify
// account (the one they actually log in with, which has Premium) instead
// of a different "Nitin Rajshankar" account the previous app happened to
// be created under - confirmed as the real cause of a persistent 403 on
// EVERY Web API call (even /v1/me, reproduced in Incognito with extensions
// disabled, ruling out an extension as the cause): Development Mode apps
// only grant real Web API access to the app's own owner account, and the
// account actually completing OAuth login here was a different one.
export const SPOTIFY_CLIENT_ID_FALLBACK = '2494684038a545168597c8ab6609ffad';
// Spotify's dashboard no longer accepts the literal hostname "localhost" in
// a Redirect URI at all (confirmed by the user directly - their dashboard
// rejected it outright, requiring the loopback IP 127.0.0.1 instead). Vite's
// dev server listens on both localhost and 127.0.0.1, and both resolve to
// the exact same local machine - but Spotify treats them as two textually
// different strings that must match EXACTLY, so normalizing here means this
// works regardless of which one happens to be typed into the address bar
// that day, instead of relying on remembering to always use 127.0.0.1.
// Deployed origins (a real https:// domain) are untouched - this only ever
// rewrites the literal word "localhost".
const SPOTIFY_REDIRECT_ORIGIN = window.location.origin.replace('://localhost', '://127.0.0.1');
export const SPOTIFY_REDIRECT_URI = `${SPOTIFY_REDIRECT_ORIGIN}/spotify-callback`;
export const SPOTIFY_SCOPES = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-read-playback-state',
    'user-modify-playback-state',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-library-read',
].join(' ');

export const APPLE_MUSICKIT_DEVELOPER_TOKEN_FALLBACK = 'YOUR_APPLE_MUSICKIT_DEVELOPER_TOKEN';
export const APPLE_MUSICKIT_APP_NAME = 'Nexus OS';
export const APPLE_MUSICKIT_APP_BUILD = '1.0.0';

// Reads the real, currently-saved Settings-page value for a credential
// field - the exact same localStorage blob the Settings page itself reads
// from and writes to, so a token confirmed there is immediately visible
// here on the very next connection attempt, with no separate sync step.
const readSavedSetting = (key) => {
    try {
        const saved = JSON.parse(localStorage.getItem('nexus_global_settings') || '{}');
        const value = saved[key];
        return typeof value === 'string' ? value.trim() : '';
    } catch (e) {
        return '';
    }
};

// The Client ID actually used for a connection attempt right now -
// whatever's saved and confirmed in Settings takes priority; the constant
// above only matters for a developer who's editing this file directly
// instead of using the in-app Settings flow.
export const getSpotifyClientId = () => readSavedSetting('spotifyClientId') || SPOTIFY_CLIENT_ID_FALLBACK;

export const getAppleMusicToken = () => readSavedSetting('appleMusicToken') || APPLE_MUSICKIT_DEVELOPER_TOKEN_FALLBACK;

export const isSpotifyConfigured = () => {
    const id = getSpotifyClientId();
    return typeof id === 'string' && !id.startsWith('YOUR_') && id.length > 0;
};

export const isAppleMusicConfigured = () => {
    const token = getAppleMusicToken();
    return typeof token === 'string' && !token.startsWith('YOUR_') && token.length > 0;
};

// --- YouTube ---
// Reuses the SAME youtubeApiKey/youtubeApiKeyConfirmed fields the Syllabus
// Hub's video-search cards already use (Settings > API Integrations) - one
// key, validated once in Settings, works for both features. There is no
// separate "connect" handshake the way Spotify/Apple need: a YouTube Data
// API key authenticates the APP to Google, not a specific user, so a
// confirmed key IS the connection.
//
// Real, explicit request: a real, working default key (created under the
// app owner's own Google Cloud project - "YouTube Data API v3" enabled)
// so this works the moment anyone downloads the app, same precedent as
// SPOTIFY_CLIENT_ID_FALLBACK above. A key embedded in a browser bundle or
// compiled APK is visible to anyone who looks (devtools' Network tab, or
// decompiling the APK) - real mitigations actually worth doing on this
// key in Google Cloud Console (console.cloud.google.com/apis/
// credentials): set "Application restrictions" (HTTP referrers for the
// deployed domain, Android apps for the APK's package name + SHA-1), and
// know its free daily quota (10,000 units - about 100 searches) is
// SHARED across every install using this default key, not per-user.
export const YOUTUBE_API_KEY_FALLBACK = 'AIzaSyDLAX-3o5TjMS7iBRUVGt9voS1d9OdHhTU';

export const isYoutubeConfigured = () => !!getYoutubeApiKey();

export const getYoutubeApiKey = () => readSavedSetting('youtubeApiKey') || YOUTUBE_API_KEY_FALLBACK;

// --- Saavn (unofficial JioSaavn API wrapper) ---
// No credentials of any kind - every public mirror of this API is
// unauthenticated. "Connected" here is purely a user preference toggle
// (saavnEnabled), not a real auth state, and the base URL is a genuinely
// separate Settings field (saavnApiBaseUrl) rather than a hardcoded
// constant: unofficial API mirrors are frequently taken down/redeployed
// at a new URL with no notice, so the working URL at any given moment
// needs to be something the user can update without a code change,
// exactly like Spotify/Apple's own Settings-first credential model above.
//
// This exact default was picked by live-testing real fetch() calls
// (not just curl/HEAD checks) against ~10 candidate mirrors: most were
// completely dead (DNS failure or 404 on every route), and the one
// previously used here (jiosaavn-api-two.vercel.app) turned out to be
// one of the dead ones - its /api/search/songs route 404s and the
// response carries no CORS headers either, which is exactly what a
// browser reports as "blocked by CORS policy" even though the real
// problem is the route not existing. This mirror is the one candidate
// found with BOTH a correctly-routed /api/search/songs endpoint AND
// proper CORS headers - confirmed by getting a real, well-formed 400
// validation error back (not a CORS block or blank 404) when the query
// param was left off. It can still fail with a 500 sometimes (JioSaavn's
// own real backend rejecting/rate-limiting the request that reaches it,
// not something a mirror's own code can fix) - that's a live upstream
// reliability issue with the unofficial API ecosystem itself, not a
// wrong URL, and no public mirror is immune to it.
export const SAAVN_API_BASE_URL_FALLBACK = 'https://jio-saavn-api.vercel.app/api';

export const getSaavnApiBaseUrl = () => readSavedSetting('saavnApiBaseUrl') || SAAVN_API_BASE_URL_FALLBACK;

// Requires BOTH the on/off preference AND a real, confirmed-working base
// URL (see SettingsPage.jsx's saavnBaseUrlStatus check, which runs an
// actual test search against it) - exactly the same "toggle alone isn't
// enough, it has to have been verified and confirmed" bar every other
// provider on this page is held to (Gemini/OpenAI/GitHub/Apple/Spotify/
// YouTube all require their own Confirmed flag, not just a non-empty
// field). Saavn needs no secret, but it still needs to be PROVEN
// reachable before the rest of the app treats it as connected - flipping
// the toggle alone used to be enough, which is exactly what made the
// "Connected Saavn" badge show up without ever having confirmed the
// mirror actually works.
export const isSaavnConfigured = () => {
    try {
        const saved = JSON.parse(localStorage.getItem('nexus_global_settings') || '{}');
        return !!saved.saavnEnabled && !!saved.saavnApiBaseUrlConfirmed;
    } catch (e) {
        return false;
    }
};
