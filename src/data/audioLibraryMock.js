// src/data/audioLibraryMock.js
//
// Mock "Library" data for the Audio & Focus Hub - playlists/albums the user
// can browse and queue, standing in for a real streaming catalog until an
// external API (e.g. Apple Music/MusicKit) is wired in.
//
// ---------------------------------------------------------------------------
// SHAPES (documented here so a real API integration later is a drop-in swap,
// not a rewrite - every field a real API would give you is already present
// on these mock objects, even if currently filled with a placeholder).
// ---------------------------------------------------------------------------
//
// Track
//   id            string   stable unique id
//   title         string
//   artist        string   placeholder for mock data; real APIs always have this
//   url           string   playable audio URL (only field that's ever "fake"
//                          here, in the sense of being locally-generated/proxied
//                          rather than remote - everything else is real shape)
//   artworkUrl    string   cover art URL - empty string = fall back to a generated icon
//   durationSec   number|null  known duration if available, else null (read from <audio> once loaded)
//   source        'local' | 'synth' | 'catalog'  where this track's audio actually comes from
//
// Playlist
//   id            string
//   title         string
//   description   string
//   artworkUrl    string   empty string = fall back to a generated gradient tile
//   trackRefs     () => Track[]   a FUNCTION, not a static array - because synth
//                                 tracks need getSynthPresetUrl() called to
//                                 resolve their actual playable URL, which a
//                                 real API call would also be async/lazy for.
//                                 A real integration would replace this with
//                                 an actual fetch to a "get playlist tracks"
//                                 endpoint - the calling code (AudioHubPage)
//                                 doesn't need to change at all, since it
//                                 already treats this as "call it, get tracks".
//
// When Apple MusicKit (or similar) is integrated: Playlist.trackRefs becomes
// an async function hitting the real catalog endpoint, and each Track's url
// becomes a real MusicKit streaming URL/token-authenticated request instead
// of a Pixabay link or synthesized buffer. Nothing in AudioHubPage's
// rendering or queueing logic needs to know the difference.

import { getSynthPresetUrl } from '../utils/noiseSynth.js';

// The only two verified-reliable remote tracks in the whole app (Pixabay
// CDN links confirmed working across many rounds of testing) - reused
// across multiple mock playlists rather than introducing new unverified
// hotlinks, which have repeatedly turned out to be unreliable.
const LOFI_URL = 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf7f6.mp3?filename=lofi-study-112191.mp3';
const RAIN_URL = 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=gentle-rain-16167.mp3';

const track = (id, title, artist, url, source) => ({
    id, title, artist, url, artworkUrl: '', durationSec: null, source,
});

export const AUDIO_LIBRARY = [
    {
        id: 'pl-focus-flow',
        title: 'Focus Flow',
        description: 'Steady, low-distraction tracks for deep work sessions.',
        artworkUrl: '',
        trackRefs: () => [
            track('lib-lofi', 'Lofi Focus Beats', 'Nexus Sessions', LOFI_URL, 'catalog'),
            track('lib-whitenoise-1', 'White Noise', 'Ambient Generator', getSynthPresetUrl('whiteNoise'), 'synth'),
        ],
    },
    {
        id: 'pl-deep-work',
        title: 'Deep Work',
        description: 'Minimal, repetitive textures to hold long focus blocks.',
        artworkUrl: '',
        trackRefs: () => [
            track('lib-lofi-2', 'Lofi Focus Beats', 'Nexus Sessions', LOFI_URL, 'catalog'),
            track('lib-whitenoise-2', 'White Noise', 'Ambient Generator', getSynthPresetUrl('whiteNoise'), 'synth'),
            track('lib-rain-1', 'Ambient Rain', 'Nexus Sessions', RAIN_URL, 'catalog'),
        ],
    },
    {
        id: 'pl-rainy-study',
        title: 'Rainy Day Study',
        description: 'Rain-forward atmospheres for reading and revision.',
        artworkUrl: '',
        trackRefs: () => [
            track('lib-rain-2', 'Ambient Rain', 'Nexus Sessions', RAIN_URL, 'catalog'),
            track('lib-rain-synth', 'Rain (Generated)', 'Ambient Generator', getSynthPresetUrl('rain'), 'synth'),
            track('lib-forest-1', 'Forest', 'Ambient Generator', getSynthPresetUrl('forest'), 'synth'),
        ],
    },
    {
        id: 'pl-coffee-vibes',
        title: 'Coffee Shop Vibes',
        description: 'A murmuring cafe backdrop with a lofi undertone.',
        artworkUrl: '',
        trackRefs: () => [
            track('lib-coffee-1', 'Coffee Shop', 'Ambient Generator', getSynthPresetUrl('coffeeShop'), 'synth'),
            track('lib-lofi-3', 'Lofi Focus Beats', 'Nexus Sessions', LOFI_URL, 'catalog'),
        ],
    },
    {
        id: 'pl-nature-escape',
        title: 'Nature Escape',
        description: 'Forest and rain textures for a calmer headspace.',
        artworkUrl: '',
        trackRefs: () => [
            track('lib-forest-2', 'Forest', 'Ambient Generator', getSynthPresetUrl('forest'), 'synth'),
            track('lib-rain-3', 'Ambient Rain', 'Nexus Sessions', RAIN_URL, 'catalog'),
        ],
    },
];

// A flat view of every track across every playlist - used by the Global
// Search tab. A real API would call a dedicated search endpoint instead;
// this stands in for that until one exists, but the calling code
// (AudioHubPage's search tab) is written against "a flat list of tracks
// with a title/artist to filter", which a real search response would also
// naturally provide.
export const getAllLibraryTracks = () => AUDIO_LIBRARY.flatMap((p) => p.trackRefs());
