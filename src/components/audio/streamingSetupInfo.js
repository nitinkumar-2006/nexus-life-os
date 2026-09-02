// src/components/audio/streamingSetupInfo.js
//
// Shared "not configured yet" copy for each streaming service - extracted
// out of AudioHubPage.jsx so both it and TransferMusicModal.jsx (the new
// service switcher) can show the exact same real setup instructions
// instead of duplicating this text in two places.
export const STREAMING_SETUP_INFO = {
    apple: {
        title: 'Connect Apple Music - Setup Needed',
        steps: [
            'Requires an active Apple Developer Program membership (paid) with MusicKit access.',
            'Generate a MusicKit developer token (a signed JWT) from your Apple Developer account.',
            'Paste it into APPLE_MUSICKIT_DEVELOPER_TOKEN in src/config/streamingConfig.js.',
        ],
    },
    spotify: {
        title: 'Connect Spotify - Setup Needed',
        steps: [
            'Create a free app at developer.spotify.com/dashboard.',
            'Set its Redirect URI to exactly match SPOTIFY_REDIRECT_URI in src/config/streamingConfig.js.',
            'Copy the Client ID into SPOTIFY_CLIENT_ID in that same file - no secret needed.',
        ],
    },
    youtube: {
        title: 'Connect YouTube - Setup Needed',
        steps: [
            'Create a free API key in the Google Cloud Console with the "YouTube Data API v3" enabled.',
            'Go to Settings > API Integrations and paste it into the YouTube Data API Key field.',
            'Click Confirm once it validates - the same key also powers the Syllabus Hub\'s video search.',
        ],
    },
    saavn: {
        title: 'Connect Saavn - Setup Needed',
        steps: [
            'No account or credentials needed - Saavn just needs a working mirror confirmed.',
            'Go to Settings > API Integrations and turn on Saavn Music Search.',
            'Wait for it to show "Mirror responded successfully", then click Confirm. If it fails, paste a different working mirror URL (unofficial JioSaavn API mirrors go down often).',
        ],
    },
};
