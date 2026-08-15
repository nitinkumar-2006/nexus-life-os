// src/context/SoundSettingsContext.jsx
//
// A single, shared source of truth for every non-music sound effect in the
// app: independent volume + mute per channel (UI Interaction Feedback,
// Task Alerts), persisted to localStorage, read by the Settings page's
// sliders/toggles AND by whatever actually triggers each sound. This is
// deliberately separate from AudioPlayerContext, which owns music
// playback - these are short/ambient sound effects, not tracks in a queue.
//
// Each channel can also have a small library of user-uploaded custom
// sounds (a "ringtone picker") - one selected as that channel's ACTIVE
// sound, the rest kept as alternatives. Custom sound files are stored in
// IndexedDB (real audio blobs don't belong in localStorage), following the
// exact same pattern AudioPlayerContext already uses for imported local
// music files - a completely separate database/store, so this never
// touches that feature's data.
//
// Every slider/upload/select/delete in Settings calls a real function
// here that updates real, persisted state; playChannelSound is the ONLY
// path any of these sounds is ever triggered through, and it transparently
// resolves to a channel's custom sound when one is selected, or the
// caller's built-in default otherwise - no separate "custom" code path for
// callers to worry about.
//
// TWO SEPARATE CONTEXTS, ONE PROVIDER: React re-renders every consumer of
// a context whenever its value changes, even a consumer that only reads a
// stable function off it - so a component like DynamicBackground (thunder
// audio) that ONLY ever calls playChannelSound was re-rendering on every
// single volume-slider drag in Settings, despite never touching the actual
// volume numbers itself. SoundActionsContext holds ONLY the functions
// below (all useCallback-memoized with stable dependencies, so this
// object is built once via useMemo and never changes reference again);
// SoundSettingsContext keeps the frequently-changing state
// (settings/customSounds) for consumers that genuinely need to react to
// it live (the Settings page's sliders, the Rain Audio loop's volume).
// useSoundSettings() still returns everything combined for callers that
// need both - useSoundActions() is the opt-in fast path for callers that
// only need to trigger a sound.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'nexus_sound_settings';

export const SOUND_CHANNELS = {
    uiFeedback: { label: 'UI Feedback', description: 'Short tick on toggles/interactions' },
    taskAlerts: { label: 'Task Alerts', description: 'Chime when a task is completed' },
};

const DEFAULT_CHANNEL_SETTINGS = { volume: 0.6, muted: false, activeSoundId: 'default' };
const DEFAULT_SETTINGS = {
    uiFeedback: { ...DEFAULT_CHANNEL_SETTINGS, volume: 0.5 },
    taskAlerts: { ...DEFAULT_CHANNEL_SETTINGS, volume: 0.65 },
};

const loadSettings = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (!saved || typeof saved !== 'object') return DEFAULT_SETTINGS;
        // Merge over defaults rather than trusting the saved shape wholesale,
        // so a field added later doesn't crash on an older saved blob that
        // doesn't have it yet - and so an old saved blob that still has
        // thunderstorm/rainAudio entries from before their removal simply
        // has those keys ignored (not merged, since they're no longer in
        // DEFAULT_SETTINGS) rather than causing any error.
        const merged = {};
        for (const key of Object.keys(DEFAULT_SETTINGS)) {
            merged[key] = { ...DEFAULT_SETTINGS[key], ...(saved[key] || {}) };
        }
        return merged;
    } catch (e) {
        return DEFAULT_SETTINGS;
    }
};

// --- Custom sound storage (IndexedDB) - a real audio Blob per uploaded
// file, in its own database/store, isolated from AudioPlayerContext's
// local-music-file storage even though the pattern is deliberately the
// same. Metadata (id/channel/name/dateAdded) lives alongside the blob in
// the same record, so a single query on mount is enough to populate the
// picker list. ---
const SOUND_DB_NAME = 'nexus_sound_settings_db';
const SOUND_DB_VERSION = 1;
const SOUND_STORE_NAME = 'custom_sounds';
const MAX_CUSTOM_SOUND_BYTES = 8 * 1024 * 1024; // 8MB - generous for a short ringtone-length clip, small enough to stay snappy

const isIndexedDbAvailable = () => typeof window !== 'undefined' && !!window.indexedDB;

const openSoundDb = () =>
    new Promise((resolve, reject) => {
        if (!isIndexedDbAvailable()) { reject(new Error('IndexedDB unavailable')); return; }
        const req = indexedDB.open(SOUND_DB_NAME, SOUND_DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(SOUND_STORE_NAME)) {
                const store = db.createObjectStore(SOUND_STORE_NAME, { keyPath: 'id' });
                store.createIndex('channel', 'channel', { unique: false });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

const saveCustomSoundRecord = async (record) => {
    const db = await openSoundDb();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(SOUND_STORE_NAME, 'readwrite');
        tx.objectStore(SOUND_STORE_NAME).put(record);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
};

const loadCustomSoundBlob = async (id) => {
    const db = await openSoundDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(SOUND_STORE_NAME, 'readonly');
        const req = tx.objectStore(SOUND_STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result ? req.result.blob : null);
        req.onerror = () => reject(req.error);
    });
};

const deleteCustomSoundRecord = async (id) => {
    const db = await openSoundDb();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(SOUND_STORE_NAME, 'readwrite');
        tx.objectStore(SOUND_STORE_NAME).delete(id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
};

const listAllCustomSoundMeta = async () => {
    const db = await openSoundDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(SOUND_STORE_NAME, 'readonly');
        const req = tx.objectStore(SOUND_STORE_NAME).getAll();
        req.onsuccess = () => resolve((req.result || []).map(({ id, channel, name, dateAdded }) => ({ id, channel, name, dateAdded })));
        req.onerror = () => reject(req.error);
    });
};

const SoundSettingsContext = createContext(null);
const SoundActionsContext = createContext(null);

export const SoundSettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState(loadSettings);
    // Mirrors `settings` for synchronous reads inside playChannelSound
    // (which is called from event handlers, not render) without needing
    // playChannelSound itself to change identity every time a slider moves.
    const settingsRef = useRef(settings);
    useEffect(() => { settingsRef.current = settings; }, [settings]);

    // { uiFeedback: [{id,name,dateAdded}], taskAlerts: [...] } -
    // metadata only; the actual blobs stay in IndexedDB and are only
    // touched when something needs to actually play/preview one.
    const [customSounds, setCustomSounds] = useState({ uiFeedback: [], taskAlerts: [] });
    const customSoundsRef = useRef(customSounds);
    useEffect(() => { customSoundsRef.current = customSounds; }, [customSounds]);

    // Object URLs are created lazily on first play/preview and reused
    // after that (creating one per Blob is enough; re-creating it on every
    // single play would leak a new URL each time). Cleared out on delete
    // or on unmount.
    const objectUrlCacheRef = useRef(new Map()); // soundId -> object URL

    useEffect(() => {
        let cancelled = false;
        listAllCustomSoundMeta()
            .then((all) => {
                if (cancelled) return;
                const grouped = { uiFeedback: [], taskAlerts: [] };
                all.forEach((rec) => { if (grouped[rec.channel]) grouped[rec.channel].push(rec); });
                setCustomSounds(grouped);
            })
            .catch(() => { /* IndexedDB unavailable - custom sounds just won't be offered this session, defaults still work fine */ });
        return () => {
            cancelled = true;
            objectUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
            objectUrlCacheRef.current.clear();
        };
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (e) {
            /* storage full/unavailable - sliders still work for this session */
        }
    }, [settings]);

    const setChannelVolume = useCallback((channel, volume) => {
        const clamped = Math.max(0, Math.min(1, volume));
        setSettings((prev) => ({ ...prev, [channel]: { ...prev[channel], volume: clamped } }));
    }, []);

    const setChannelMuted = useCallback((channel, muted) => {
        setSettings((prev) => ({ ...prev, [channel]: { ...prev[channel], muted } }));
    }, []);

    const selectActiveSound = useCallback((channel, soundId) => {
        setSettings((prev) => ({ ...prev, [channel]: { ...prev[channel], activeSoundId: soundId } }));
    }, []);

    const getObjectUrlForSound = useCallback(async (id) => {
        const cached = objectUrlCacheRef.current.get(id);
        if (cached) return cached;
        const blob = await loadCustomSoundBlob(id);
        if (!blob) return null;
        const url = URL.createObjectURL(blob);
        objectUrlCacheRef.current.set(id, url);
        return url;
    }, []);

    const uploadCustomSound = useCallback(async (channel, file) => {
        if (!file || !file.type || !file.type.startsWith('audio/')) {
            return { ok: false, error: 'That file doesn\u2019t look like an audio file (expected MP3/WAV/etc).' };
        }
        if (file.size > MAX_CUSTOM_SOUND_BYTES) {
            return { ok: false, error: `File is too large (max ${Math.round(MAX_CUSTOM_SOUND_BYTES / (1024 * 1024))}MB for a short sound clip).` };
        }
        const id = `custom-${channel}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        const record = { id, channel, name: file.name, blob: file, dateAdded: Date.now() };
        try {
            await saveCustomSoundRecord(record);
        } catch (e) {
            return { ok: false, error: 'Could not save this file (IndexedDB unavailable in this browser).' };
        }
        setCustomSounds((prev) => ({ ...prev, [channel]: [...prev[channel], { id, channel, name: file.name, dateAdded: record.dateAdded }] }));
        // Uploading a sound and not selecting it would be a dead upload -
        // make the newly-added sound the active one immediately.
        selectActiveSound(channel, id);
        return { ok: true, id };
    }, [selectActiveSound]);

    const deleteCustomSound = useCallback(async (channel, id) => {
        try { await deleteCustomSoundRecord(id); } catch (e) { /* best-effort - state below is the source of truth either way */ }
        const cachedUrl = objectUrlCacheRef.current.get(id);
        if (cachedUrl) { URL.revokeObjectURL(cachedUrl); objectUrlCacheRef.current.delete(id); }
        setCustomSounds((prev) => ({ ...prev, [channel]: prev[channel].filter((s) => s.id !== id) }));
        // If the deleted sound was this channel's active selection, fall
        // back to the built-in default rather than leaving activeSoundId
        // pointing at a sound that no longer exists.
        setSettings((prev) => (prev[channel]?.activeSoundId === id ? { ...prev, [channel]: { ...prev[channel], activeSoundId: 'default' } } : prev));
    }, []);

    // Plays a specific custom sound once, at a fixed audible preview
    // volume - deliberately ignores the channel's own mute/volume, since a
    // muted channel would otherwise make "Preview" silently do nothing,
    // which defeats the point of a preview button.
    const previewCustomSound = useCallback(async (id) => {
        try {
            const url = await getObjectUrlForSound(id);
            if (!url) return;
            const audio = new Audio(url);
            audio.volume = 0.7;
            audio.play().catch(() => {});
        } catch (e) {
            /* Preview failing silently is acceptable - it's a convenience action, not a core one */
        }
    }, [getObjectUrlForSound]);

    // Resolves what URL should actually play for a channel right now -
    // its selected custom sound if one is chosen, otherwise the caller's
    // own built-in default. This is the ONE place "is a custom sound
    // active" is checked, so every one-shot playChannelSound call below
    // stays in sync automatically.
    const resolveChannelUrl = useCallback(async (channel, fallbackGetUrlFn) => {
        const activeSoundId = settingsRef.current[channel]?.activeSoundId;
        if (activeSoundId && activeSoundId !== 'default') {
            const url = await getObjectUrlForSound(activeSoundId);
            if (url) return url;
            // The selected custom sound vanished (deleted in another tab,
            // IndexedDB cleared, etc.) - fall through to the default
            // rather than playing nothing.
        }
        return fallbackGetUrlFn();
    }, [getObjectUrlForSound]);

    // The one path every non-music, ONE-SHOT sound in the app plays
    // through. Returns early (plays nothing) if the channel
    // is muted or its volume is at/near zero, so a muted channel never
    // even constructs an Audio element. `onEnded`, if given, runs once
    // playback finishes - used by callers whose fallback URL is freshly
    // generated per call and needs revoking afterward (thunder); this is
    // never applied to a custom sound's URL, since those are cached and
    // reused, not freshly generated per play.
    const playChannelSound = useCallback((channel, getUrlFn, { intensity = 1, onEnded } = {}) => {
        const channelSettings = settingsRef.current[channel];
        if (!channelSettings || channelSettings.muted || channelSettings.volume <= 0.001) return;
        (async () => {
            try {
                const isCustom = channelSettings.activeSoundId && channelSettings.activeSoundId !== 'default';
                const url = await resolveChannelUrl(channel, getUrlFn);
                if (!url) return;
                const audio = new Audio(url);
                const safeIntensity = Number.isFinite(intensity) ? intensity : 1;
                audio.volume = Math.max(0, Math.min(1, channelSettings.volume * safeIntensity));
                // A custom sound's URL is cached/reused (see
                // getObjectUrlForSound) - never revoke it after one play,
                // that would break every subsequent play of the same sound.
                if (onEnded && !isCustom) {
                    audio.addEventListener('ended', onEnded, { once: true });
                    audio.addEventListener('error', onEnded, { once: true });
                }
                audio.play().catch(() => { if (onEnded && !isCustom) onEnded(); });
            } catch (e) {
                /* Audio unavailable in this environment - fails silently, never breaks the triggering action */
            }
        })();
    }, [resolveChannelUrl]);

    const getChannelVolume = useCallback((channel) => {
        const c = settingsRef.current[channel];
        if (!c) return 0;
        return c.muted ? 0 : c.volume;
    }, []);

    const value = {
        settings,
        setChannelVolume,
        setChannelMuted,
        playChannelSound,
        getChannelVolume,
        customSounds,
        uploadCustomSound,
        deleteCustomSound,
        selectActiveSound,
        previewCustomSound,
        resolveChannelUrl,
    };

    // Every function referenced here is a useCallback with stable
    // dependencies (verified above), so this object is built exactly once
    // and this reference never changes again for the lifetime of the
    // provider - consumers subscribed ONLY to SoundActionsContext (via
    // useSoundActions()) will never re-render because of this value,
    // regardless of how often settings/customSounds change.
    const actionsValue = useMemo(() => ({
        setChannelVolume, setChannelMuted, playChannelSound, getChannelVolume,
        uploadCustomSound, deleteCustomSound, selectActiveSound, previewCustomSound, resolveChannelUrl,
    }), [setChannelVolume, setChannelMuted, playChannelSound, getChannelVolume, uploadCustomSound, deleteCustomSound, selectActiveSound, previewCustomSound, resolveChannelUrl]);

    return (
        <SoundActionsContext.Provider value={actionsValue}>
            <SoundSettingsContext.Provider value={value}>{children}</SoundSettingsContext.Provider>
        </SoundActionsContext.Provider>
    );
};

// Fast path for consumers that only need to TRIGGER a sound (playChannelSound)
// or manage custom sounds, without needing to react to live volume/mute
// values themselves - subscribing here instead of useSoundSettings() means
// this component will NOT re-render when a volume slider moves in Settings,
// since this context's value never changes reference.
export const useSoundActions = () => {
    const ctx = useContext(SoundActionsContext);
    if (!ctx) {
        return {
            setChannelVolume: () => {},
            setChannelMuted: () => {},
            playChannelSound: () => {},
            getChannelVolume: () => 0,
            uploadCustomSound: async () => ({ ok: false, error: 'Sound settings unavailable' }),
            deleteCustomSound: async () => {},
            selectActiveSound: () => {},
            previewCustomSound: async () => {},
            resolveChannelUrl: async (channel, fallbackGetUrlFn) => fallbackGetUrlFn(),
        };
    }
    return ctx;
};

export const useSoundSettings = () => {
    const ctx = useContext(SoundSettingsContext);
    if (!ctx) {
        // Defensive fallback so a consumer rendered outside the provider
        // (shouldn't happen once it's mounted in DashboardLayout, but this
        // keeps things from hard-crashing) degrades to "sound off" rather
        // than throwing.
        return {
            settings: DEFAULT_SETTINGS,
            setChannelVolume: () => {},
            setChannelMuted: () => {},
            playChannelSound: () => {},
            getChannelVolume: () => 0,
            customSounds: { uiFeedback: [], taskAlerts: [] },
            uploadCustomSound: async () => ({ ok: false, error: 'Sound settings unavailable' }),
            deleteCustomSound: async () => {},
            selectActiveSound: () => {},
            previewCustomSound: async () => {},
            resolveChannelUrl: async (channel, fallbackGetUrlFn) => fallbackGetUrlFn(),
        };
    }
    return ctx;
};
