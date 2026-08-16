// src/context/AudioPlayerContext.jsx
//
// A single, global audio engine shared by every part of the app that touches
// the playlist (AudioHubPage, the Header's "Focus Audio Studio" dropdown,
// and the GreetingCard mini-player). There is exactly one <audio> element,
// rendered here, and it must be mounted once at the persistent app root
// (DashboardLayout / App) so it is never unmounted just because the visible
// page changed - that's what makes playback survive navigation.
import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { useStreaming } from './StreamingContext.jsx';
import { useAuth } from './AuthContext.jsx';
import { buildAudioTrackCloudMetadata, AUDIO_SYNC_STATUS } from '../utils/audioCloudSchema.js';
import { uploadAudioToCloud, saveAudioTrackMetadata, fetchUserAudioTracks, deleteAudioFromCloud } from '../utils/audioCloudSync.js';
import { getSynthPresetUrl } from '../utils/noiseSynth.js';

// A brand-new user (empty localStorage) starts on this queue - it used to
// hotlink Pixabay's CDN directly, which is exactly the unreliable pattern
// noiseSynth.js exists to avoid (Pixabay doesn't expose stable, crawlable
// direct-download links without an authenticated API call). That's what
// produced the real console 403/429s and the "Couldn't play" state on the
// very first thing a fresh install ever tries to play. Synth-generated
// audio has zero network dependency and can never 403/429/go dead.
const DEFAULT_PLAYLIST = [
    { id: 1, title: 'Lofi Focus Beats', url: getSynthPresetUrl('lofi'), isLocal: false },
    { id: 2, title: 'Ambient Rain', url: getSynthPresetUrl('rain'), isLocal: false },
];

// Every title any synth-generated track (library "catalog" tracks above,
// plus AudioHubPage's Ambient Focus presets - see AMBIENT_PRESETS there)
// is ever known by, mapped to the noiseSynth.js profile that regenerates
// its audio. Two things can leave a persisted playlist entry pointing at
// a genuinely dead URL: (1) an install from before this fix may still
// have the old, dead Pixabay hotlink baked into a saved track object, or
// (2) ANY blob: URL (what every synth track's `url` actually is) is
// fundamentally tied to the document/session that minted it via
// URL.createObjectURL - it does NOT survive a page reload, so a
// synth-track's blob URL read back from localStorage is *always* stale,
// not just sometimes. Both cases are healed the same way: regenerate a
// fresh URL from the matching profile, keyed by title since that's the
// only stable identifier these mock/generated tracks ever had.
const TITLE_TO_SYNTH_PROFILE = {
    'Lofi Focus Beats': 'lofi',
    'Ambient Rain': 'rain',
    'Rain': 'rain',
    'Forest': 'forest',
    'Coffee Shop': 'coffeeShop',
    'White Noise': 'whiteNoise',
};
const healDeadHotlinks = (tracks) => tracks.map((t) => {
    const profileKey = TITLE_TO_SYNTH_PROFILE[t.title];
    if (!profileKey || typeof t.url !== 'string') return t;
    const isDeadPixabayLink = t.url.includes('pixabay.com');
    const isStaleBlobUrl = t.url.startsWith('blob:');
    if (isDeadPixabayLink || isStaleBlobUrl) {
        return { ...t, url: getSynthPresetUrl(profileKey) };
    }
    return t;
});

// Dropping/selecting several local files at once calls addSong() several
// times in the same synchronous tick. Date.now() only has millisecond
// resolution, so those calls were frequently generating IDENTICAL ids for
// different tracks - which breaks React's key={song.id} list reconciliation
// and made "Play" on an imported row sometimes trigger the wrong track (or
// appear to do nothing). A monotonically increasing counter guarantees a
// unique id every single time, even for files imported in the same instant.
let trackIdCounter = 0;
const generateTrackId = () => {
    trackIdCounter += 1;
    return `track-${Date.now()}-${trackIdCounter}`;
};

// ---------------------------------------------------------------------------
// LOCAL FILE STORE (IndexedDB)
// ---------------------------------------------------------------------------
// Object URLs (blob:) only live as long as the current browser tab, so a
// page reload always kills them - that's a browser limitation, not
// something JS can work around directly. To make imported local tracks
// survive a reload, the actual file bytes are saved into IndexedDB (which
// *can* store Blobs persistently), keyed by the track's id. On startup, any
// track marked isLocal re-reads its bytes from here and mints a brand new
// object URL for the current session. localStorage only ever stores the
// track's metadata (title, id, isLocal) - never a blob: URL, since last
// session's blob URL would already be dead.
const DB_NAME = 'nexus_audio_db';
const DB_VERSION = 1;
const STORE_NAME = 'local_tracks';

const isIndexedDbAvailable = () => typeof window !== 'undefined' && !!window.indexedDB;

const openDb = () =>
    new Promise((resolve, reject) => {
        if (!isIndexedDbAvailable()) {
            reject(new Error('IndexedDB unavailable'));
            return;
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

const saveLocalTrackBlob = async (id, blob) => {
    try {
        const db = await openDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put({ id, blob });
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        // If IndexedDB isn't available for some reason, the track still
        // plays fine for this session via its object URL - it just won't
        // survive a reload. Never let this break the import itself.
    }
};

const loadLocalTrackBlob = async (id) => {
    try {
        const db = await openDb();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(id);
            req.onsuccess = () => resolve(req.result ? req.result.blob : null);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        return null;
    }
};

const deleteLocalTrackBlob = async (id) => {
    try {
        const db = await openDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(id);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        // Nothing to clean up if IndexedDB isn't available.
    }
};

// What gets written to localStorage: local tracks are persisted WITHOUT a
// url (it would be a dead blob: URL next session anyway) - just enough
// metadata to know to rehydrate them from IndexedDB on the next load,
// plus the real, Firebase-ready cloud metadata fields (fileSizeBytes,
// mimeType, uploadedAt, syncStatus, etc.) when present, so a future
// cloud-sync step has real, persisted data to work with rather than
// values that only ever existed in memory for the tab that uploaded
// the track.
const toPersistable = (list) =>
    list.map((t) => (t.isLocal ? {
        id: t.id, title: t.title, isLocal: true, url: null,
        ...(t.fileSizeBytes !== undefined && {
            fileSizeBytes: t.fileSizeBytes, mimeType: t.mimeType, fileExtension: t.fileExtension,
            uploadedAt: t.uploadedAt, syncStatus: t.syncStatus, cloudStorageUrl: t.cloudStorageUrl,
        }),
    } : t));

const AudioPlayerContext = createContext(null);

export const AudioPlayerProvider = ({ children }) => {
    // Which service (if any) should actually be steering playback right
    // now - 'local' uses everything below exactly as before; 'spotify'/
    // 'apple' route the same togglePlay/next/prev calls to that service's
    // own SDK instead, so every existing caller (header shortcut, Audio
    // Hub page, keyboard shortcuts) automatically follows the active
    // source without needing its own copy of this check.
    const { activeSource, spotifyTogglePlay, spotifyNext, spotifyPrevious, appleMusicTogglePlay, appleMusicNext, appleMusicPrevious } = useStreaming();
    const { user } = useAuth();
    // Real, per-track cloud upload state - keyed by track id since more
    // than one upload could genuinely be in flight at once. Consumed by
    // AudioHubPage for real progress/success/error UI, not a fire-and-
    // forget background operation the user has no visibility into.
    const [cloudUploadStatus, setCloudUploadStatus] = useState({});
    const [playlist, setPlaylist] = useState(() => {
        try {
            const saved = localStorage.getItem('nexus_playlist');
            const parsed = saved ? JSON.parse(saved) : null;
            return Array.isArray(parsed) && parsed.length > 0 ? healDeadHotlinks(parsed) : DEFAULT_PLAYLIST;
        } catch (e) {
            return DEFAULT_PLAYLIST;
        }
    });
    // Favorited playlist/album IDs (from the Library tab) - a simple string
    // Set persisted to localStorage. Kept separate from the playback queue
    // entirely: favoriting a playlist doesn't queue its tracks, it just
    // marks it for quick access in the Library grid.
    const [favoritePlaylistIds, setFavoritePlaylistIds] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('nexus_favorite_playlists') || '[]');
            return new Set(Array.isArray(saved) ? saved : []);
        } catch (e) {
            return new Set();
        }
    });
    // Individual track favorites - separate from playlist-level favorites
    // above. A track keeps its favorite status even after being removed
    // from the queue and re-added later, since this is keyed by title
    // (mock tracks don't have a stable catalog id the way a real streaming
    // API's tracks would - a real integration would key this by the
    // API's own track id instead).
    const [favoriteTrackTitles, setFavoriteTrackTitles] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('nexus_favorite_tracks') || '[]');
            return new Set(Array.isArray(saved) ? saved : []);
        } catch (e) {
            return new Set();
        }
    });
    const [shuffleEnabled, setShuffleEnabled] = useState(() => localStorage.getItem('nexus_shuffle') === 'true');
    // Off by default - a real, confirmed source of "audio overlaps / two
    // tracks play at once" reports: the crossfade below is genuine,
    // intentional, working behavior (fades the next track in for
    // CROSSFADE_SECONDS before the old one fully stops), but it was
    // completely invisible anywhere in the UI - no label while it's
    // happening, no setting to see or turn off. From a real listener's
    // perspective, "two songs suddenly play together with zero
    // explanation" reads exactly like a bug even though the code itself
    // was working as designed. Kept as a real, functioning feature (not
    // deleted) for anyone who does want it - just no longer a surprise.
    const [crossfadeEnabled, setCrossfadeEnabled] = useState(() => localStorage.getItem('nexus_crossfade_enabled') === 'true');
    // 'off' | 'all' | 'one'
    const [repeatMode, setRepeatMode] = useState(() => {
        const saved = localStorage.getItem('nexus_repeat_mode');
        return saved === 'all' || saved === 'one' ? saved : 'off';
    });
    // Tracks which indices have already been visited during the current
    // shuffle "round", so shuffle mode covers every track once before any
    // repeats - rather than pure random-each-time, which can replay the
    // same track repeatedly by chance and feels broken to users.
    const shuffleHistoryRef = useRef([]);
    const [currentSongIndex, setCurrentSongIndex] = useState(() => {
        const saved = parseInt(localStorage.getItem('nexus_current_song_index'), 10);
        return Number.isFinite(saved) && saved >= 0 ? saved : 0;
    });
    // Declared immediately after playlist/currentSongIndex (the only two
    // things it depends on), rather than much further down the component -
    // it's referenced inside a useEffect DEPENDENCY ARRAY below (not just
    // inside an effect callback body). A dependency array is evaluated
    // synchronously as the component renders, unlike the deferred callback
    // itself, so referencing a `const` that hasn't been initialized yet at
    // that point in the function is a genuine temporal-dead-zone
    // ReferenceError ("Cannot access 'currentTrack' before initialization"),
    // not just a stale-closure concern - it crashes the whole app. Moving
    // the declaration here, before anything that reads it, fixes that at
    // the root instead of working around it.
    const currentTrack = playlist[currentSongIndex] || { id: null, title: 'No Track', url: '', isLocal: false };
    const [isPlaying, setIsPlaying] = useState(false);
    // A real, confirmed bug: neither audio element had any error
    // handling at all, so a failed load (an expired/blocked CDN URL,
    // a network issue) left isPlaying stuck true with no actual sound
    // and no way for this app - or the person using it - to know
    // anything had gone wrong. Cleared automatically the next time a
    // track genuinely starts playing successfully.
    const [playbackError, setPlaybackError] = useState(null);
    // Real, visible counterpart to crossfadingRef (a plain ref, so it
    // never triggers a re-render on its own) - lets the UI show an
    // honest "Crossfading..." label for the ~4 real seconds two tracks
    // are genuinely, intentionally both audible, instead of leaving
    // that moment completely unexplained.
    const [isCrossfading, setIsCrossfading] = useState(false);
    const [volume, setVolume] = useState(() => {
        const saved = parseFloat(localStorage.getItem('nexus_volume'));
        return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : 1.0;
    });
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Two audio elements instead of one, to make real crossfading possible:
    // as the active track nears its end, the NEXT track is preloaded and
    // started on the inactive element at volume 0, then both volumes ramp
    // (active down, inactive up) over a few seconds before the "active"
    // role swaps to whichever element now holds the new track. Every
    // existing control (play/pause/seek/volume) is routed through
    // getActiveAudio()/getInactiveAudio() rather than a single fixed ref,
    // so they keep working correctly regardless of which physical element
    // is currently "the" active one.
    const audioRefA = useRef(null);
    const audioRefB = useRef(null);
    const activeSlotRef = useRef('A');
    const crossfadingRef = useRef(false);
    const crossfadeIntervalRef = useRef(null);
    const skipNextLoadRef = useRef(false);
    const getActiveAudio = () => (activeSlotRef.current === 'A' ? audioRefA.current : audioRefB.current);
    const getInactiveAudio = () => (activeSlotRef.current === 'A' ? audioRefB.current : audioRefA.current);

    const previousVolumeRef = useRef(1.0);
    // Latest-value refs for use inside the crossfade timer and timeupdate
    // handler, which are attached once per track rather than re-created on
    // every render - reading state directly there could see a stale value.
    const volumeRef = useRef(volume);
    const currentSongIndexRef = useRef(currentSongIndex);
    const repeatModeRef = useRef(repeatMode);
    const shuffleEnabledRef = useRef(shuffleEnabled);
    const crossfadeEnabledRef = useRef(crossfadeEnabled);
    useEffect(() => { volumeRef.current = volume; }, [volume]);
    useEffect(() => { currentSongIndexRef.current = currentSongIndex; }, [currentSongIndex]);
    useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
    useEffect(() => { shuffleEnabledRef.current = shuffleEnabled; }, [shuffleEnabled]);
    useEffect(() => {
        crossfadeEnabledRef.current = crossfadeEnabled;
        localStorage.setItem('nexus_crossfade_enabled', String(crossfadeEnabled));
    }, [crossfadeEnabled]);

    // Always-fresh reference to the playlist, so next()/prev()/playAt() never
    // act on a stale closure without needing to be re-created on every edit.
    const playlistRef = useRef(playlist);
    useEffect(() => {
        playlistRef.current = playlist;
    }, [playlist]);

    // Real fetch-from-cloud-on-sign-in - the actual mechanism behind
    // this request's own "logs in on any session or device, their
    // custom uploaded tracks... persist automatically" requirement. On
    // a genuinely new device, localStorage's own nexus_playlist is
    // empty, so the playlist starts as DEFAULT_PLAYLIST - without this,
    // the user's real cloud-synced tracks would never even enter this
    // device's playlist state for the rehydration effect below to act
    // on. Only adds tracks this device doesn't already know about (by
    // id) - never overwrites or duplicates a track already present.
    useEffect(() => {
        if (!user || !user.uid) return;
        let cancelled = false;
        (async () => {
            try {
                const cloudTracks = await fetchUserAudioTracks(user.uid);
                if (cancelled || cloudTracks.length === 0) return;
                setPlaylist((prevList) => {
                    const knownIds = new Set(prevList.map((t) => t.id));
                    const newFromCloud = cloudTracks
                        .filter((t) => !knownIds.has(t.id))
                        // No url yet - the real rehydration effect below
                        // points it at its own live cloudStorageUrl.
                        .map((t) => ({ ...t, url: null }));
                    return newFromCloud.length > 0 ? [...prevList, ...newFromCloud] : prevList;
                });
            } catch (e) {
                // Real network/permission failure - this device simply
                // doesn't get the cloud tracks merged in this session;
                // its own, already-known local tracks are unaffected.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [user]);

    // Re-hydrates any locally-imported tracks that survived (as metadata
    // only) from a previous session, or just arrived from the cloud-fetch
    // effect above, by reading their actual bytes back out of IndexedDB
    // (or, failing that, re-downloading from their own cloudStorageUrl)
    // and minting fresh object URLs for them. Re-runs on playlist.length
    // changes (not the full playlist array, which would loop against
    // this same effect's own url updates) so tracks added later by the
    // async cloud fetch are genuinely picked up too, not missed because
    // this only ran once before they arrived. Tracks with no bytes
    // available anywhere are dropped rather than left permanently
    // unplayable.
    useEffect(() => {
        let cancelled = false;

        const rehydrate = async () => {
            const pending = playlistRef.current.filter((t) => t.isLocal && !t.url);
            for (const entry of pending) {
                const blob = await loadLocalTrackBlob(entry.id);
                if (cancelled) return;
                if (blob) {
                    const freshUrl = URL.createObjectURL(blob);
                    setPlaylist((prevList) => prevList.map((t) => (t.id === entry.id ? { ...t, url: freshUrl } : t)));
                    continue;
                }
                // Not in local IndexedDB (a genuinely new device, or a
                // cleared browser) - if this track was previously synced
                // to the cloud, play it directly from its own live
                // cloudStorageUrl instead of giving up on it.
                //
                // This used to fetch() the full file into a Blob first
                // (so it could also be re-saved to IndexedDB for offline
                // playback), but that fetch() is a cross-origin read of
                // the response body, which the browser always subjects to
                // CORS - and this Firebase Storage bucket has no CORS
                // policy configured for this origin, so every one of
                // those calls genuinely failed with a real, reproducible
                // `net::ERR_FAILED` / "blocked by CORS policy" console
                // error. That error is logged by the browser itself the
                // moment the cross-origin request is blocked - it can't
                // be silenced from application code no matter how the
                // resulting promise rejection is caught, so the only real
                // fix is to never make that fetch() at all.
                //
                // A plain <audio> element doesn't have this problem: it
                // never reads the response bytes into JS, so streaming a
                // cross-origin URL directly needs no CORS involvement.
                // The one real trade-off is that a track rehydrated this
                // way isn't re-cached into IndexedDB, so it won't play
                // with this device fully offline - reasonable, since
                // everything else about a cloud-synced track (auth,
                // Firestore, the original sync) already needs a network
                // connection anyway.
                if (entry.cloudStorageUrl) {
                    setPlaylist((prevList) => prevList.map((t) => (t.id === entry.id ? { ...t, url: entry.cloudStorageUrl } : t)));
                    continue;
                }
                setPlaylist((prevList) => prevList.filter((t) => t.id !== entry.id));
            }
        };

        rehydrate();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playlist.length]);

    // Persist the playlist and notify any other listeners (e.g. another
    // browser tab) exactly once whenever it actually changes - centralizing
    // this here (instead of duplicating it inside addSong/deleteSong/
    // moveSong) keeps those functions as plain, side-effect-free state
    // updates, which is also what makes them safe under React StrictMode's
    // dev-only double-invocation of updater functions.
    useEffect(() => {
        localStorage.setItem('nexus_playlist', JSON.stringify(toPersistable(playlist)));
        window.dispatchEvent(new Event('nexus_playlist_updated'));
    }, [playlist]);

    // Persist which track is active so it's restored (metadata-wise) across
    // a reload too - actual playback never auto-resumes on load, browsers
    // block that anyway without a fresh user gesture.
    useEffect(() => {
        localStorage.setItem('nexus_current_song_index', String(currentSongIndex));
    }, [currentSongIndex]);

    useEffect(() => {
        localStorage.setItem('nexus_favorite_playlists', JSON.stringify([...favoritePlaylistIds]));
    }, [favoritePlaylistIds]);

    useEffect(() => {
        localStorage.setItem('nexus_favorite_tracks', JSON.stringify([...favoriteTrackTitles]));
    }, [favoriteTrackTitles]);

    useEffect(() => {
        localStorage.setItem('nexus_shuffle', String(shuffleEnabled));
    }, [shuffleEnabled]);

    useEffect(() => {
        localStorage.setItem('nexus_repeat_mode', repeatMode);
    }, [repeatMode]);

    // Pick up playlist edits made in another browser tab/window. Real bug,
    // found and confirmed live with multiple tabs of this app open at
    // once: healDeadHotlinks (like every .map() call) always returns a
    // BRAND NEW array, even when every track passes through completely
    // unchanged - so setPlaylist was firing on every single 'storage'
    // event regardless of whether anything actually differed. That new
    // reference re-triggers this file's own playlist-persistence effect,
    // which re-writes localStorage and re-fires 'storage' in every OTHER
    // open tab, whose own identical, unguarded listener does the same
    // thing right back - a genuine, self-sustaining cross-tab ping-pong
    // (confirmed live: 600+ redundant writes/sec, tripping React's
    // "Maximum update depth exceeded" guard) with two or more tabs open,
    // even with playback fully idle. The same JSON-equality guard
    // GlobalUserSettingsContext already uses for this exact reason -
    // bail out to the previous reference when nothing genuinely
    // changed - stops the cascade at its source.
    useEffect(() => {
        const syncFromStorage = () => {
            try {
                const saved = localStorage.getItem('nexus_playlist');
                if (!saved) return;
                const healed = healDeadHotlinks(JSON.parse(saved));
                setPlaylist((prev) => (JSON.stringify(prev) === JSON.stringify(healed) ? prev : healed));
            } catch (e) {
                /* ignore malformed storage */
            }
        };
        window.addEventListener('storage', syncFromStorage);
        return () => window.removeEventListener('storage', syncFromStorage);
    }, []);

    useEffect(() => {
        if (!crossfadingRef.current) {
            const audio = getActiveAudio();
            if (audio) audio.volume = volume;
        }
        localStorage.setItem('nexus_volume', String(volume));
    }, [volume]);

    // Attempts to start playback, and - this is the actual fix for
    // "skipping to a local track pauses or fails to play" - if the very
    // first attempt is rejected (common right after load() on a freshly
    // assigned blob: URL, before the browser has buffered enough to play
    // yet), it waits for the element to report it's genuinely ready
    // (`canplay`) and retries exactly once, instead of silently giving up.
    // If it still can't play, `isPlaying` is corrected back to false so the
    // UI never shows a stuck "Pause" button while nothing is actually
    // playing - previously a failed play() was swallowed with no recovery
    // and no state correction, which is exactly what caused the stuck state.
    const attemptPlay = useCallback(() => {
        const audio = getActiveAudio();
        if (!audio) return;
        const playPromise = audio.play();
        if (!playPromise || typeof playPromise.catch !== 'function') return;
        playPromise.catch(() => {
            const onReady = () => {
                audio.removeEventListener('canplay', onReady);
                audio.play().catch(() => setIsPlaying(false));
            };
            audio.addEventListener('canplay', onReady, { once: true });
        });
    }, []);

    // Whenever the active track changes (skip, direct select, or auto-advance
    // on "ended"), (re)start playback if we're supposed to be playing. This
    // runs after React has already committed the new `src` to the <audio>
    // element. load() is called explicitly first - this forces the browser
    // to reset any previous decode state and cleanly begin loading whatever
    // `src` is currently set (whether that's a streamed http(s) URL or a
    // locally-imported blob: URL) before play() is requested.
    useEffect(() => {
        if (skipNextLoadRef.current) {
            // A crossfade just completed and swapped which element is
            // active - it's already playing the correct track at the
            // correct volume, so reloading here would cause an audible
            // hiccup for no reason. Just sync the displayed time/duration
            // to the now-active element's real state instead.
            skipNextLoadRef.current = false;
            const audio = getActiveAudio();
            if (audio) {
                setCurrentTime(audio.currentTime || 0);
                setDuration(audio.duration || 0);
            }
            return;
        }
        // BUGFIX (Play does nothing right after a refresh, but Next/Prev/
        // direct-select fixes it): this effect used to only re-run when
        // `currentSongIndex` itself changed. Right after a page reload, the
        // persisted current track can briefly resolve to an EMPTY url -
        // most commonly a local (drag-and-dropped) file, whose url is
        // deliberately not persisted (see toPersistable above) and only
        // becomes available a moment later, once it's asynchronously
        // re-read from IndexedDB and re-hydrated into `playlist`. That
        // rehydration updates `playlist`/`currentTrack.url` WITHOUT
        // changing `currentSongIndex` - so this effect never re-ran, and
        // the <audio> element's `src` stayed empty indefinitely even
        // though `currentTrack.url` was valid by then. Clicking Play just
        // calls .play() on that still-unloaded element (a silent no-op);
        // clicking Next "worked" only because it explicitly changes
        // currentSongIndex, which finally re-triggers this effect with the
        // by-then-valid url. Fix: also depend on currentTrack.url, so the
        // moment a valid url becomes available for the current index -
        // whether from a normal track change OR from rehydration
        // completing - the <audio> element gets (re)loaded automatically;
        // and skip loading entirely while the url is still empty, rather
        // than pointing the element at "".
        if (!currentTrack.url) return;
        setCurrentTime(0);
        setDuration(0);
        const audio = getActiveAudio();
        if (!audio) return;
        // src is set imperatively here (not via a declarative src= prop on
        // the <audio> elements below) deliberately - during a crossfade,
        // the INACTIVE element's src is also set imperatively
        // (inactiveAudio.src = nextTrack.url in startCrossfade). If both
        // elements had src={currentTrack.url} bound declaratively, any
        // unrelated re-render mid-crossfade would reset the inactive
        // element's src back to the OLD track, silently breaking the fade.
        audio.src = currentTrack.url;
        audio.loop = !!currentTrack.isAmbientPreset;
        audio.load();
        if (isPlaying) attemptPlay();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSongIndex, currentTrack.url]);

    // Play/Pause never sets `isPlaying` itself - the <audio> element's own
    // onPlay/onPause events do that (below). That guarantees the UI can
    // never drift out of sync with what's actually playing.
    const togglePlay = useCallback(() => {
        if (activeSource === 'spotify') { spotifyTogglePlay(); return; }
        if (activeSource === 'apple') { appleMusicTogglePlay(); return; }
        const audio = getActiveAudio();
        if (!audio) return;
        if (isPlaying) {
            if (crossfadingRef.current) cancelCrossfade();
            audio.pause();
        } else {
            attemptPlay();
        }
    }, [isPlaying, attemptPlay, activeSource, spotifyTogglePlay, appleMusicTogglePlay]);

    // Used by the seek bar. Moves the real <audio> element's position and
    // updates state immediately, rather than waiting for the next
    // "timeupdate" tick, so dragging the slider feels instant.
    const seek = useCallback((time) => {
        if (crossfadingRef.current) cancelCrossfade();
        const audio = getActiveAudio();
        if (!audio || !isFinite(time)) return;
        audio.currentTime = time;
        setCurrentTime(time);
    }, []);

    const toggleMute = useCallback(() => {
        setVolume((currentVol) => {
            if (currentVol > 0) {
                previousVolumeRef.current = currentVol;
                return 0;
            }
            return previousVolumeRef.current > 0 ? previousVolumeRef.current : 1;
        });
    }, []);

    const playAt = useCallback((index) => {
        if (crossfadingRef.current) cancelCrossfade();
        const len = playlistRef.current.length;
        if (index < 0 || index >= len) return;
        setCurrentSongIndex(index);
        setIsPlaying(true);
    }, []);

    // isNaturalEnd distinguishes "the track finished playing on its own"
    // (onEnded) from "the user clicked skip" - repeat-one should replay the
    // same track on a natural end, but a manual skip should always move to
    // a different track even while repeat-one is active (matching standard
    // Spotify/Apple Music behavior).
    const next = useCallback((opts = {}) => {
        if (activeSource === 'spotify') { spotifyNext(); return; }
        if (activeSource === 'apple') { appleMusicNext(); return; }
        const { isNaturalEnd = false } = opts;
        if (!isNaturalEnd && crossfadingRef.current) cancelCrossfade();
        const len = playlistRef.current.length;
        if (len === 0) return;

        if (isNaturalEnd && repeatMode === 'one') {
            const audio = getActiveAudio();
            if (audio) {
                audio.currentTime = 0;
                attemptPlay();
            }
            return;
        }

        if (shuffleEnabled) {
            if (len === 1) {
                setIsPlaying(true);
                return;
            }
            // Covers every track once before allowing any repeats within a
            // shuffle "round" - pure random-each-time can otherwise replay
            // the same track back-to-back by chance, which feels broken.
            if (shuffleHistoryRef.current.length >= len) shuffleHistoryRef.current = [];
            let candidate;
            do {
                candidate = Math.floor(Math.random() * len);
            } while (shuffleHistoryRef.current.includes(candidate) || candidate === currentSongIndex);
            shuffleHistoryRef.current.push(candidate);
            setCurrentSongIndex(candidate);
            setIsPlaying(true);
            return;
        }

        setCurrentSongIndex((prevIdx) => {
            const atEnd = prevIdx >= len - 1;
            if (atEnd && isNaturalEnd && repeatMode === 'off') {
                // Reached the end naturally with repeat off - stop rather
                // than silently looping back to track 0.
                setIsPlaying(false);
                return prevIdx;
            }
            return (prevIdx + 1) % len;
        });
        if (!(repeatMode === 'off' && isNaturalEnd)) setIsPlaying(true);
    }, [repeatMode, shuffleEnabled, currentSongIndex, attemptPlay, activeSource, spotifyNext, appleMusicNext]);

    // Mirrors next()'s shuffle/repeat decision to determine what track
    // comes after the current one, for crossfade preloading - committing to
    // shuffle history at the moment of peeking (not just previewing),
    // since starting a crossfade toward a track IS a real commitment: it
    // doesn't make sense to preload and start fading in one track, then
    // land on a different one once the crossfade actually completes.
    // Returns null when there's nothing sensible to crossfade into
    // (a single-track queue, repeat-one replaying itself, or the end of a
    // non-repeating queue).
    const peekNextIndex = useCallback(() => {
        const list = playlistRef.current;
        const len = list.length;
        if (len <= 1) return null;
        if (repeatModeRef.current === 'one') return null; // replays itself - nothing to crossfade into
        if (shuffleEnabledRef.current) {
            if (shuffleHistoryRef.current.length >= len) shuffleHistoryRef.current = [];
            let candidate;
            do {
                candidate = Math.floor(Math.random() * len);
            } while (shuffleHistoryRef.current.includes(candidate) || candidate === currentSongIndexRef.current);
            shuffleHistoryRef.current.push(candidate);
            return candidate;
        }
        const idx = currentSongIndexRef.current;
        const atEnd = idx >= len - 1;
        if (atEnd) return repeatModeRef.current === 'off' ? null : 0;
        return idx + 1;
    }, []);

    // Apple-Music-style crossfade: as the active track nears its end, the
    // next track is preloaded and started on the currently-inactive audio
    // element at volume 0, then both elements' volumes ramp over a few
    // seconds (active down, inactive up) before the "active" role swaps.
    // Ambient presets (which loop indefinitely) never trigger this - there
    // is no natural "next" to crossfade into while one is playing.
    const CROSSFADE_SECONDS = 4;
    const startCrossfade = useCallback(() => {
        if (crossfadingRef.current) return;
        const list = playlistRef.current;
        const activeTrack = list[currentSongIndexRef.current];
        if (!activeTrack || activeTrack.isAmbientPreset) return;
        const nextIdx = peekNextIndex();
        if (nextIdx === null) return;
        const nextTrack = list[nextIdx];
        if (!nextTrack || !nextTrack.url) return;

        const activeAudio = getActiveAudio();
        const inactiveAudio = getInactiveAudio();
        if (!activeAudio || !inactiveAudio) return;

        crossfadingRef.current = true;
        setIsCrossfading(true);
        const targetVolume = volumeRef.current;
        inactiveAudio.src = nextTrack.url;
        inactiveAudio.loop = !!nextTrack.isAmbientPreset;
        inactiveAudio.currentTime = 0;
        inactiveAudio.volume = 0;
        inactiveAudio.play().catch(() => {
            // If the next track can't start (e.g. blocked/unavailable),
            // abandon the crossfade cleanly and let the normal onEnded
            // path handle advancing instead of leaving state stuck.
            crossfadingRef.current = false;
            setIsCrossfading(false);
        });

        const steps = 24;
        const stepMs = (CROSSFADE_SECONDS * 1000) / steps;
        let step = 0;
        crossfadeIntervalRef.current = setInterval(() => {
            if (!crossfadingRef.current) {
                clearInterval(crossfadeIntervalRef.current);
                return;
            }
            step += 1;
            const t = step / steps;
            activeAudio.volume = Math.max(0, targetVolume * (1 - t));
            inactiveAudio.volume = Math.min(targetVolume, targetVolume * t);
            if (step >= steps) {
                clearInterval(crossfadeIntervalRef.current);
                activeAudio.pause();
                activeAudio.volume = targetVolume; // restored for the next time this slot is reused
                activeSlotRef.current = activeSlotRef.current === 'A' ? 'B' : 'A';
                crossfadingRef.current = false;
                setIsCrossfading(false);
                skipNextLoadRef.current = true;
                setCurrentSongIndex(nextIdx);
                setIsPlaying(true);
            }
        }, stepMs);
    }, [peekNextIndex]);

    // Cancels an in-progress crossfade cleanly (used when the user
    // manually skips/pauses/seeks mid-fade) - stops the inactive element
    // and restores the active element's volume immediately, rather than
    // leaving two tracks audibly overlapping indefinitely.
    const cancelCrossfade = useCallback(() => {
        if (!crossfadingRef.current) return;
        clearInterval(crossfadeIntervalRef.current);
        crossfadingRef.current = false;
        setIsCrossfading(false);
        const inactiveAudio = getInactiveAudio();
        if (inactiveAudio) {
            inactiveAudio.pause();
            inactiveAudio.currentTime = 0;
        }
        const activeAudio = getActiveAudio();
        if (activeAudio) activeAudio.volume = volumeRef.current;
    }, []);

    const prev = useCallback(() => {
        if (activeSource === 'spotify') { spotifyPrevious(); return; }
        if (activeSource === 'apple') { appleMusicPrevious(); return; }
        if (crossfadingRef.current) cancelCrossfade();
        const len = playlistRef.current.length;
        if (len === 0) return;
        setCurrentSongIndex((prevIdx) => (prevIdx - 1 + len) % len);
        setIsPlaying(true);
    }, [activeSource, spotifyPrevious, appleMusicPrevious]);

    // For locally-imported files (drag-and-drop / file picker). Takes the
    // raw File object so this function can own the whole lifecycle: an
    // object URL for immediate playback, plus persisting the actual bytes
    // to IndexedDB so the track survives a reload.
    const addSong = useCallback(async (title, file) => {
        if (!title || !title.trim() || !file) return;
        const id = generateTrackId();
        const url = URL.createObjectURL(file);
        // Real cloud-ready metadata, captured now while the actual File
        // object (with its own real size/type/name) is still available -
        // this is the only point in the track's whole lifecycle where
        // that's true, so it has to happen here, not deferred to some
        // later "prepare for sync" step that wouldn't have this data.
        const cloudMetadata = buildAudioTrackCloudMetadata({ id, title }, file);
        // Await the IndexedDB write BEFORE adding the track to playlist
        // state (and therefore before it enters localStorage's persisted
        // metadata below). Previously this was fire-and-forget, so the
        // track's metadata could reach localStorage while its actual
        // bytes were still mid-write in IndexedDB - a page reload landing
        // in that window left localStorage pointing at a local track with
        // nothing to rehydrate, which the startup effect then silently
        // dropped. Awaiting here closes that window: by the time the
        // track is visible anywhere, its bytes are already durably saved.
        await saveLocalTrackBlob(id, file);
        setPlaylist((prevList) => [...prevList, { id, title, url, isLocal: true, ...cloudMetadata }]);

        // Real, background cloud upload - deliberately NOT awaited here,
        // so the track is already playable locally the instant this
        // function returns, regardless of how long the real upload takes.
        // Genuinely skipped (not attempted, not faked) when no one is
        // signed in - a local-only user's track honestly stays
        // 'local-only', matching what actually happened.
        if (user && user.uid) {
            setCloudUploadStatus((prev) => ({ ...prev, [id]: { status: 'uploading', progress: 0, error: null } }));
            uploadAudioToCloud(file, id, user.uid, (progress) => {
                setCloudUploadStatus((prev) => ({ ...prev, [id]: { status: 'uploading', progress, error: null } }));
            })
                .then(async (downloadUrl) => {
                    const syncedMetadata = { ...cloudMetadata, cloudStorageUrl: downloadUrl, syncStatus: AUDIO_SYNC_STATUS.SYNCED };
                    await saveAudioTrackMetadata(user.uid, syncedMetadata);
                    setPlaylist((prevList) => prevList.map((t) => (t.id === id ? { ...t, cloudStorageUrl: downloadUrl, syncStatus: AUDIO_SYNC_STATUS.SYNCED } : t)));
                    setCloudUploadStatus((prev) => ({ ...prev, [id]: { status: 'success', progress: 100, error: null } }));
                })
                .catch((err) => {
                    setPlaylist((prevList) => prevList.map((t) => (t.id === id ? { ...t, syncStatus: AUDIO_SYNC_STATUS.SYNC_FAILED } : t)));
                    setCloudUploadStatus((prev) => ({ ...prev, [id]: { status: 'error', progress: 0, error: err.message || 'Upload failed.' } }));
                });
        }
    }, [user]);

    // For remote/streamed tracks (e.g. the Ambient Focus Presets) - the URL
    // itself is durable across reloads, so there's no IndexedDB involved.
    const addRemoteTrack = useCallback((title, url) => {
        if (!title || !url) return;
        setPlaylist((prevList) => [...prevList, { id: generateTrackId(), title, url, isLocal: false }]);
    }, []);

    // Immediately jumps to and plays a track - adding it to the queue first
    // only if it isn't already there. This is what a click on an individual
    // track (in an opened playlist, search results, etc.) should actually
    // call: addRemoteTrack alone only appends to the queue silently, which
    // was the actual bug - a track never became the active, playing track
    // just by being added.
    const playTrackNow = useCallback((title, url) => {
        if (!title || !url) return;
        if (crossfadingRef.current) cancelCrossfade();
        const list = playlistRef.current;
        const existingIndex = list.findIndex((t) => t.title === title && t.url === url);
        if (existingIndex !== -1) {
            setCurrentSongIndex(existingIndex);
            setIsPlaying(true);
            return;
        }
        const newIndex = list.length;
        setPlaylist((prevList) => [...prevList, { id: generateTrackId(), title, url, isLocal: false }]);
        setCurrentSongIndex(newIndex);
        setIsPlaying(true);
    }, []);

    // Queues an entire array of tracks (e.g. a whole Library playlist) in
    // one call, then jumps to and plays the first one - optionally shuffled
    // first. Each incoming track only needs {title, url}; everything else
    // is filled in consistently with how addRemoteTrack works, so a
    // playlist's tracks behave identically to any other queued track
    // (reorderable, removable, etc.) once they're in the queue.
    const queuePlaylistTracks = useCallback((tracks, { shuffle = false } = {}) => {
        if (!Array.isArray(tracks) || tracks.length === 0) return;
        if (crossfadingRef.current) cancelCrossfade();
        const ordered = shuffle ? [...tracks].sort(() => Math.random() - 0.5) : tracks;
        setPlaylist((prevList) => {
            const startIndex = prevList.length;
            const newEntries = ordered.map((t) => ({
                id: generateTrackId(),
                title: t.title,
                url: t.url,
                artist: t.artist || '',
                artworkUrl: t.artworkUrl || '',
                isLocal: false,
            }));
            setCurrentSongIndex(startIndex);
            setIsPlaying(true);
            return [...prevList, ...newEntries];
        });
    }, []);

    const toggleFavoritePlaylist = useCallback((playlistId) => {
        setFavoritePlaylistIds((prev) => {
            const next = new Set(prev);
            if (next.has(playlistId)) next.delete(playlistId);
            else next.add(playlistId);
            return next;
        });
    }, []);

    const toggleFavoriteTrack = useCallback((title) => {
        setFavoriteTrackTitles((prev) => {
            const nextSet = new Set(prev);
            if (nextSet.has(title)) nextSet.delete(title);
            else nextSet.add(title);
            return nextSet;
        });
    }, []);

    const toggleShuffle = useCallback(() => {
        shuffleHistoryRef.current = [];
        setShuffleEnabled((v) => !v);
    }, []);

    const cycleRepeatMode = useCallback(() => {
        setRepeatMode((mode) => (mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off'));
    }, []);

    // Toggle-plays a named ambient preset: switches to it (adding it to the
    // queue first if it isn't already there), or pauses it if it's already
    // the track currently playing. Marked isAmbientPreset so the shared
    // <audio> element loops it seamlessly instead of advancing to the next
    // queue item when the (finite, ~30s) generated buffer ends.
    const playPreset = useCallback((title, url) => {
        if (crossfadingRef.current) cancelCrossfade();
        const list = playlistRef.current;
        const existingIndex = list.findIndex((t) => t.title === title && t.url === url);

        if (existingIndex !== -1 && existingIndex === currentSongIndex) {
            setIsPlaying((wasPlaying) => !wasPlaying);
            return;
        }

        if (existingIndex !== -1) {
            setCurrentSongIndex(existingIndex);
            setIsPlaying(true);
            return;
        }

        const newIndex = list.length;
        setPlaylist((prevList) => [...prevList, { id: generateTrackId(), title, url, isLocal: false, isAmbientPreset: true }]);
        setCurrentSongIndex(newIndex);
        setIsPlaying(true);
    }, [currentSongIndex]);

    const deleteSong = useCallback((id) => {
        setPlaylist((prevList) => {
            const target = prevList.find((s) => s.id === id);
            const removedIndex = prevList.findIndex((s) => s.id === id);
            if (removedIndex === -1) return prevList;
            const updated = prevList.filter((s) => s.id !== id);

            if (target) {
                if (target.isLocal) {
                    deleteLocalTrackBlob(target.id);
                }
                if (target.url && target.url.startsWith('blob:')) {
                    URL.revokeObjectURL(target.url);
                }
                // Real cloud cleanup - only attempted for a track that
                // was actually synced (has a real cloudStorageUrl); a
                // local-only track has nothing in the cloud to remove.
                // Errors are intentionally not surfaced to the user here
                // - deletion has already succeeded locally, which is the
                // real, primary outcome the user asked for; a lingering
                // orphaned cloud object (cleaned up on a later attempt,
                // or manually) is a minor, non-blocking side effect.
                if (user && user.uid && target.cloudStorageUrl) {
                    deleteAudioFromCloud(user.uid, target.id, target.fileExtension).catch(() => {});
                }
            }

            setCurrentSongIndex((ci) => {
                if (updated.length === 0) return 0;
                if (removedIndex < ci) return ci - 1;
                if (removedIndex === ci) return Math.min(ci, updated.length - 1);
                return ci;
            });

            return updated;
        });
    }, [user]);

    const moveSong = useCallback((index, direction) => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        setPlaylist((prevList) => {
            if (newIndex < 0 || newIndex >= prevList.length) return prevList;
            const updated = [...prevList];
            const temp = updated[index];
            updated[index] = updated[newIndex];
            updated[newIndex] = temp;

            setCurrentSongIndex((ci) => {
                if (ci === index) return newIndex;
                if (ci === newIndex) return index;
                return ci;
            });

            return updated;
        });
    }, []);

    // Recently Played: a capped, deduplicated history of tracks that have
    // actually been made active (not just added to the queue) - updated
    // whenever the active track genuinely changes, so skipping through
    // several tracks builds real history rather than a static list.
    const [recentlyPlayed, setRecentlyPlayed] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('nexus_recently_played') || '[]');
            return Array.isArray(saved) ? healDeadHotlinks(saved) : [];
        } catch (e) {
            return [];
        }
    });
    const lastTrackedTitleRef = useRef(null);

    useEffect(() => {
        if (!currentTrack.title || currentTrack.title === 'No Track') return;
        if (lastTrackedTitleRef.current === currentTrack.title) return;
        lastTrackedTitleRef.current = currentTrack.title;
        setRecentlyPlayed((prev) => {
            const withoutDupe = prev.filter((t) => t.title !== currentTrack.title);
            const next = [
                { title: currentTrack.title, url: currentTrack.url, isLocal: !!currentTrack.isLocal, playedAt: Date.now() },
                ...withoutDupe,
            ].slice(0, 10);
            localStorage.setItem('nexus_recently_played', JSON.stringify(next));
            return next;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTrack.title, currentTrack.url]);

    // Duration cache for queue rows that aren't the currently-playing
    // track (which already gets its real duration from the shared <audio>
    // element's own onLoadedMetadata). Every OTHER track's real duration is
    // resolved lazily by loading its metadata into a throwaway Audio
    // object - genuine durations, not placeholders, for every row.
    const [durationsByUrl, setDurationsByUrl] = useState({});
    useEffect(() => {
        playlist.forEach((track) => {
            if (!track.url || durationsByUrl[track.url] !== undefined) return;
            const probe = new Audio();
            probe.preload = 'metadata';
            probe.src = track.url;
            probe.addEventListener('loadedmetadata', () => {
                setDurationsByUrl((prev) => ({ ...prev, [track.url]: probe.duration || 0 }));
            });
            probe.addEventListener('error', () => {
                setDurationsByUrl((prev) => ({ ...prev, [track.url]: 0 }));
            });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playlist]);

    const value = {
        playlist,
        currentSongIndex,
        currentTrack,
        isPlaying,
        volume,
        isMuted: volume === 0,
        currentTime,
        duration,
        favoritePlaylistIds,
        favoriteTrackTitles,
        shuffleEnabled,
        repeatMode,
        crossfadeEnabled,
        isCrossfading,
        recentlyPlayed,
        durationsByUrl,
        setVolume,
        toggleMute,
        togglePlay,
        playAt,
        next,
        prev,
        addSong,
        addRemoteTrack,
        playTrackNow,
        queuePlaylistTracks,
        toggleFavoritePlaylist,
        toggleFavoriteTrack,
        toggleShuffle,
        cycleRepeatMode,
        setCrossfadeEnabled,
        playPreset,
        deleteSong,
        moveSong,
        seek,
        cloudUploadStatus,
        playbackError,
    };

    return (
        <AudioPlayerContext.Provider value={value}>
            {children}
            {/* Two <audio> elements instead of one - see the dual-slot
                architecture notes near audioRefA/audioRefB above. Both live
                here, at the persistent root, so neither is ever torn down
                by route changes. Neither has a declarative src/loop prop
                (deliberately - see the comment in the track-changed effect
                above); both are managed entirely imperatively so the
                crossfade's direct assignments on the inactive element are
                never fought by React's own reconciliation. */}
            <audio
                ref={audioRefA}
                onEnded={() => { if (activeSlotRef.current === 'A') next({ isNaturalEnd: true }); }}
                onPlay={() => { if (activeSlotRef.current === 'A') { setIsPlaying(true); setPlaybackError(null); } }}
                onPause={() => { if (activeSlotRef.current === 'A' && !crossfadingRef.current) setIsPlaying(false); }}
                onError={() => {
                    if (activeSlotRef.current !== 'A') return;
                    setIsPlaying(false);
                    setPlaybackError(`Couldn't play "${currentTrack.title}" - the track may be unavailable right now.`);
                }}
                onTimeUpdate={(e) => {
                    if (activeSlotRef.current !== 'A') return;
                    setCurrentTime(e.target.currentTime);
                    const dur = e.target.duration;
                    if (crossfadeEnabledRef.current && isFinite(dur) && dur > 0 && !crossfadingRef.current && dur - e.target.currentTime <= CROSSFADE_SECONDS) {
                        startCrossfade();
                    }
                }}
                onLoadedMetadata={(e) => { if (activeSlotRef.current === 'A') setDuration(e.target.duration || 0); }}
                onDurationChange={(e) => { if (activeSlotRef.current === 'A') setDuration(e.target.duration || 0); }}
            />
            <audio
                ref={audioRefB}
                onEnded={() => { if (activeSlotRef.current === 'B') next({ isNaturalEnd: true }); }}
                onPlay={() => { if (activeSlotRef.current === 'B') { setIsPlaying(true); setPlaybackError(null); } }}
                onPause={() => { if (activeSlotRef.current === 'B' && !crossfadingRef.current) setIsPlaying(false); }}
                onError={() => {
                    if (activeSlotRef.current !== 'B') return;
                    setIsPlaying(false);
                    setPlaybackError(`Couldn't play "${currentTrack.title}" - the track may be unavailable right now.`);
                }}
                onTimeUpdate={(e) => {
                    if (activeSlotRef.current !== 'B') return;
                    setCurrentTime(e.target.currentTime);
                    const dur = e.target.duration;
                    if (crossfadeEnabledRef.current && isFinite(dur) && dur > 0 && !crossfadingRef.current && dur - e.target.currentTime <= CROSSFADE_SECONDS) {
                        startCrossfade();
                    }
                }}
                onLoadedMetadata={(e) => { if (activeSlotRef.current === 'B') setDuration(e.target.duration || 0); }}
                onDurationChange={(e) => { if (activeSlotRef.current === 'B') setDuration(e.target.duration || 0); }}
            />
        </AudioPlayerContext.Provider>
    );
};

export const useAudioPlayer = () => {
    const ctx = useContext(AudioPlayerContext);
    if (!ctx) {
        throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
    }
    return ctx;
};
