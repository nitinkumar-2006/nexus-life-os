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

export const SPOTIFY_CLIENT_ID_FALLBACK = 'YOUR_SPOTIFY_CLIENT_ID';
export const SPOTIFY_REDIRECT_URI = `${window.location.origin}/spotify-callback`;
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
export const APPLE_MUSICKIT_APP_NAME = 'Nexus Life OS';
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
