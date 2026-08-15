// src/context/StreamingContext.jsx
//
// Part 2 of 2: the real backend behind the Part 1 UI. Apple Music and
// Spotify remain two genuinely isolated state containers - connecting one
// can never mutate or clear the other's tokens, since they live in
// entirely separate pieces of state, are persisted under separate storage
// keys, and are driven by separate effects/functions below. `activeSource`
// is still the single master selector ('local' | 'apple' | 'spotify') that
// the Audio Hub page and the player read to know which service should be
// steering playback right now - none of that shape changed from Part 1,
// so the buttons/toggles built then don't need to change here.
//
// Both integrations require real developer credentials only the person
// running this app can obtain (see src/config/streamingConfig.js for
// exactly what's needed and where to get it) - this follows the identical
// pattern already used for Firebase in this codebase: isXConfigured()
// gates every real network/SDK call, so an unconfigured service shows a
// clear, honest "not connected - needs setup" state instead of crashing or
// silently pretending to authenticate.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
    getSpotifyClientId, SPOTIFY_REDIRECT_URI, SPOTIFY_SCOPES,
    getAppleMusicToken, APPLE_MUSICKIT_APP_NAME, APPLE_MUSICKIT_APP_BUILD,
    isSpotifyConfigured, isAppleMusicConfigured,
} from '../config/streamingConfig.js';

const SPOTIFY_TOKEN_KEY = 'nexus_spotify_tokens'; // isolated storage key - Apple's state never touches this
const SPOTIFY_VERIFIER_KEY = 'nexus_spotify_pkce_verifier'; // short-lived, only needed between redirect-out and redirect-back
const APPLE_MUSIC_KEY = 'nexus_apple_music_auth'; // isolated storage key - Spotify's state never touches this
const ACTIVE_SOURCE_KEY = 'nexus_active_audio_source';

// --- PKCE helpers (Authorization Code + PKCE - no client secret ever
// needs to exist in this browser-side code, which is the whole reason this
// flow exists for public/SPA clients). ---
const base64UrlEncode = (bytes) => {
    let str = '';
    for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const generateCodeVerifier = () => {
    const bytes = new Uint8Array(64);
    crypto.getRandomValues(bytes);
    return base64UrlEncode(bytes);
};
const generateCodeChallenge = async (verifier) => {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(new Uint8Array(digest));
};
const generateRandomState = () => base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));

const loadJson = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
};

const StreamingContext = createContext(null);

export const StreamingProvider = ({ children }) => {
    // --- Spotify: fully isolated state ---
    const [spotifyAuth, setSpotifyAuth] = useState(() => loadJson(SPOTIFY_TOKEN_KEY, {
        connected: false, accessToken: null, refreshToken: null, expiresAt: null, profileName: null, error: null,
    }));
    const spotifyRefreshTimeoutRef = useRef(null);
    const spotifyPlayerRef = useRef(null); // Spotify.Player instance (Web Playback SDK) - separate from the auth tokens above
    const [spotifyDeviceId, setSpotifyDeviceId] = useState(null);

    // --- Apple Music: fully isolated state ---
    const [appleMusicAuth, setAppleMusicAuth] = useState(() => loadJson(APPLE_MUSIC_KEY, {
        connected: false, musicUserToken: null, error: null,
    }));
    const musicKitRef = useRef(null);

    // --- Master active-source selector ---
    const [activeSource, setActiveSourceState] = useState(() => {
        try { return localStorage.getItem(ACTIVE_SOURCE_KEY) || 'local'; } catch (e) { return 'local'; }
    });

    // Bumped whenever a credential is confirmed in Settings (see the
    // nexus_settings_updated listener below) purely to force a re-render -
    // isSpotifyConfigured()/isAppleMusicConfigured() below read directly
    // from localStorage on every call, so a re-render is all that's
    // actually needed for the "Connect" buttons to immediately reflect a
    // freshly-saved credential rather than whatever was true the last time
    // this provider happened to render for an unrelated reason.
    const [, forceCredentialRecheck] = useState(0);
    useEffect(() => {
        const handleSettingsUpdated = () => forceCredentialRecheck((n) => n + 1);
        window.addEventListener('nexus_settings_updated', handleSettingsUpdated);
        return () => window.removeEventListener('nexus_settings_updated', handleSettingsUpdated);
    }, []);

    // Persist each container under its OWN key - a write to one never
    // touches the other's storage entry.
    useEffect(() => {
        try { localStorage.setItem(SPOTIFY_TOKEN_KEY, JSON.stringify(spotifyAuth)); } catch (e) { /* storage unavailable - state still works for this session */ }
    }, [spotifyAuth]);
    useEffect(() => {
        try { localStorage.setItem(APPLE_MUSIC_KEY, JSON.stringify(appleMusicAuth)); } catch (e) { /* storage unavailable - state still works for this session */ }
    }, [appleMusicAuth]);
    useEffect(() => {
        try { localStorage.setItem(ACTIVE_SOURCE_KEY, activeSource); } catch (e) { /* storage unavailable - state still works for this session */ }
    }, [activeSource]);

    // Only allow the active source to be set to a service that's actually
    // connected - prevents the queue from ever being told to steer through
    // a service with no valid token, which is what "crash-prevention logic"
    // means here: this is the single choke point, so no caller anywhere
    // else needs its own copy of this guard.
    const setActiveSource = useCallback((source) => {
        if (source === 'spotify' && !spotifyAuth.connected) return;
        if (source === 'apple' && !appleMusicAuth.connected) return;
        setActiveSourceState(source);
    }, [spotifyAuth.connected, appleMusicAuth.connected]);

    // ========================================================================
    // SPOTIFY: Authorization Code + PKCE
    // ========================================================================
    const connectSpotify = useCallback(async () => {
        if (!isSpotifyConfigured()) {
            setSpotifyAuth((prev) => ({ ...prev, error: 'Spotify Client ID not configured - add it in Settings > Security & API, or see src/config/streamingConfig.js' }));
            return;
        }
        const verifier = generateCodeVerifier();
        const challenge = await generateCodeChallenge(verifier);
        const state = generateRandomState();
        try {
            sessionStorage.setItem(SPOTIFY_VERIFIER_KEY, verifier);
            sessionStorage.setItem(`${SPOTIFY_VERIFIER_KEY}_state`, state);
        } catch (e) {
            setSpotifyAuth((prev) => ({ ...prev, error: 'This browser is blocking sessionStorage, needed to complete login securely.' }));
            return;
        }
        const params = new URLSearchParams({
            client_id: getSpotifyClientId(),
            response_type: 'code',
            redirect_uri: SPOTIFY_REDIRECT_URI,
            code_challenge_method: 'S256',
            code_challenge: challenge,
            state,
            scope: SPOTIFY_SCOPES,
        });
        // Full-page redirect out to Spotify's own login/consent screen -
        // the user comes back to SPOTIFY_REDIRECT_URI with ?code=&state=,
        // picked up by the effect below.
        window.location.assign(`https://accounts.spotify.com/authorize?${params.toString()}`);
    }, []);

    const exchangeSpotifyCode = useCallback(async (code, verifier) => {
        try {
            const res = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: SPOTIFY_REDIRECT_URI,
                    client_id: getSpotifyClientId(),
                    code_verifier: verifier,
                }),
            });
            if (!res.ok) throw new Error(`Spotify token exchange failed (${res.status})`);
            const data = await res.json();
            let profileName = null;
            try {
                const profileRes = await fetch('https://api.spotify.com/v1/me', {
                    headers: { Authorization: `Bearer ${data.access_token}` },
                });
                if (profileRes.ok) profileName = (await profileRes.json()).display_name || null;
            } catch (e) {
                /* profile lookup is a nice-to-have label, not required for the connection itself */
            }
            setSpotifyAuth({
                connected: true,
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt: Date.now() + data.expires_in * 1000,
                profileName,
                error: null,
            });
        } catch (err) {
            setSpotifyAuth((prev) => ({ ...prev, connected: false, error: err.message || 'Spotify connection failed' }));
        }
    }, []);

    const refreshSpotifyToken = useCallback(async () => {
        setSpotifyAuth((current) => {
            if (!current.refreshToken) return current;
            fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: current.refreshToken,
                    client_id: getSpotifyClientId(),
                }),
            })
                .then((res) => { if (!res.ok) throw new Error(`Spotify token refresh failed (${res.status})`); return res.json(); })
                .then((data) => {
                    setSpotifyAuth((prev) => ({
                        ...prev,
                        accessToken: data.access_token,
                        // Spotify only returns a new refresh_token sometimes - keep the old one otherwise.
                        refreshToken: data.refresh_token || prev.refreshToken,
                        expiresAt: Date.now() + data.expires_in * 1000,
                        error: null,
                    }));
                })
                .catch((err) => {
                    setSpotifyAuth((prev) => ({ ...prev, connected: false, error: err.message }));
                    // A failed refresh means the account genuinely needs
                    // re-auth, same as an explicit disconnect - so it gets
                    // the same activeSource fallback disconnectSpotify()
                    // already gives, rather than leaving activeSource
                    // pointing at a service that just stopped working.
                    setActiveSourceState((prevSource) => (prevSource === 'spotify' ? 'local' : prevSource));
                });
            return current;
        });
    }, []);

    // Handle the redirect back from Spotify on mount, if a ?code= is
    // present - this runs once regardless of which page of the app the
    // redirect lands the user back on.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const returnedState = params.get('state');
        if (!code) return;
        const expectedState = sessionStorage.getItem(`${SPOTIFY_VERIFIER_KEY}_state`);
        const verifier = sessionStorage.getItem(SPOTIFY_VERIFIER_KEY);
        sessionStorage.removeItem(SPOTIFY_VERIFIER_KEY);
        sessionStorage.removeItem(`${SPOTIFY_VERIFIER_KEY}_state`);
        // Strip the query string so a page refresh never tries to re-redeem
        // an already-used, now-invalid authorization code.
        window.history.replaceState({}, '', window.location.pathname);
        if (!verifier || !returnedState || returnedState !== expectedState) {
            setSpotifyAuth((prev) => ({ ...prev, error: 'Spotify login could not be verified (state mismatch) - please try connecting again.' }));
            return;
        }
        exchangeSpotifyCode(code, verifier);
    }, [exchangeSpotifyCode]);

    // Schedule a proactive refresh ~60s before the access token expires,
    // rather than waiting for a request to fail.
    useEffect(() => {
        if (spotifyRefreshTimeoutRef.current) clearTimeout(spotifyRefreshTimeoutRef.current);
        if (!spotifyAuth.connected || !spotifyAuth.expiresAt) return undefined;
        const msUntilRefresh = Math.max(5000, spotifyAuth.expiresAt - Date.now() - 60000);
        spotifyRefreshTimeoutRef.current = setTimeout(refreshSpotifyToken, msUntilRefresh);
        return () => clearTimeout(spotifyRefreshTimeoutRef.current);
    }, [spotifyAuth.connected, spotifyAuth.expiresAt, refreshSpotifyToken]);

    const disconnectSpotify = useCallback(() => {
        if (spotifyRefreshTimeoutRef.current) clearTimeout(spotifyRefreshTimeoutRef.current);
        if (spotifyPlayerRef.current) {
            try { spotifyPlayerRef.current.disconnect(); } catch (e) { /* best-effort */ }
            spotifyPlayerRef.current = null;
        }
        setSpotifyDeviceId(null);
        setSpotifyAuth({ connected: false, accessToken: null, refreshToken: null, expiresAt: null, profileName: null, error: null });
        setActiveSourceState((prev) => (prev === 'spotify' ? 'local' : prev));
    }, []);

    // --- Spotify Web Playback SDK: genuinely separate from the auth flow
    // above (auth only gets tokens; actually CONTROLLING playback needs
    // this SDK's own Player instance, registered as a real playback device
    // on the user's Spotify account). Lazily created only once Spotify is
    // both connected AND selected as the active source - no reason to spin
    // up a player device nobody's using yet. ---
    const loadSpotifySdkScript = () =>
        new Promise((resolve, reject) => {
            if (window.Spotify) { resolve(window.Spotify); return; }
            const existing = document.getElementById('spotify-web-playback-sdk');
            if (existing) {
                window.onSpotifyWebPlaybackSDKReady = () => resolve(window.Spotify);
                return;
            }
            window.onSpotifyWebPlaybackSDKReady = () => resolve(window.Spotify);
            const script = document.createElement('script');
            script.id = 'spotify-web-playback-sdk';
            script.src = 'https://sdk.scdn.co/spotify-player.js';
            script.async = true;
            script.onerror = () => reject(new Error('Could not load the Spotify Web Playback SDK (network/ad-blocker?)'));
            document.head.appendChild(script);
        });

    useEffect(() => {
        if (activeSource !== 'spotify' || !spotifyAuth.connected || !spotifyAuth.accessToken) return undefined;
        let cancelled = false;
        loadSpotifySdkScript()
            .then((Spotify) => {
                if (cancelled || spotifyPlayerRef.current) return;
                // Web Playback SDK requires a Spotify PREMIUM account - this
                // is a restriction of Spotify's own SDK, not something this
                // app can change; a Free-tier account will connect fine
                // above but get an "authentication_error"/"account_error"
                // here, surfaced into spotifyAuth.error below.
                const player = new Spotify.Player({
                    name: 'Nexus Life OS',
                    getOAuthToken: (cb) => cb(spotifyAuth.accessToken),
                    volume: 0.8,
                });
                player.addListener('ready', ({ device_id }) => { if (!cancelled) setSpotifyDeviceId(device_id); });
                player.addListener('not_ready', () => { if (!cancelled) setSpotifyDeviceId(null); });
                // All three failure paths below stop Spotify from actually
                // being able to play - each falls activeSource back to
                // 'local' if it was pointing at spotify, so the app can
                // never keep claiming Spotify is the active playback
                // source once it's stopped functioning. Only
                // authentication_error also marks the account itself
                // disconnected (connected: false) - that one specifically
                // means the token is bad and genuinely needs re-auth;
                // account_error (e.g. a Free-tier account, an SDK
                // restriction this app can't change) and
                // initialization_error (a transient player-setup failure)
                // both leave the account connection itself intact, since
                // the OAuth token is still perfectly valid in those cases.
                player.addListener('initialization_error', ({ message }) => {
                    setSpotifyAuth((prev) => ({ ...prev, error: `Spotify player init failed: ${message}` }));
                    setActiveSourceState((prevSource) => (prevSource === 'spotify' ? 'local' : prevSource));
                });
                player.addListener('authentication_error', ({ message }) => {
                    setSpotifyAuth((prev) => ({ ...prev, connected: false, error: `Spotify auth error: ${message}` }));
                    setActiveSourceState((prevSource) => (prevSource === 'spotify' ? 'local' : prevSource));
                });
                player.addListener('account_error', ({ message }) => {
                    setSpotifyAuth((prev) => ({ ...prev, error: `Spotify account error (Premium required for playback): ${message}` }));
                    setActiveSourceState((prevSource) => (prevSource === 'spotify' ? 'local' : prevSource));
                });
                player.connect();
                spotifyPlayerRef.current = player;
            })
            .catch((err) => setSpotifyAuth((prev) => ({ ...prev, error: err.message })));
        // Deliberately does NOT disconnect the player when activeSource
        // changes away from 'spotify' - only disconnectSpotify() (an
        // explicit account disconnect) does that. Keeping the SDK
        // connection alive while the user is just toggling which service
        // is "active" is what makes switching straight back to Spotify
        // instant rather than re-running the whole device-registration
        // handshake again.
        return () => { cancelled = true; };
    }, [activeSource, spotifyAuth.connected, spotifyAuth.accessToken]);

    // Real playback-control functions, routed to by AudioPlayerContext
    // whenever activeSource is the matching service. Both check the
    // relevant connected/ready state first and no-op rather than throw if
    // called while not actually available.
    const spotifyTogglePlay = useCallback(() => { spotifyPlayerRef.current?.togglePlay?.(); }, []);
    const spotifyNext = useCallback(() => { spotifyPlayerRef.current?.nextTrack?.(); }, []);
    const spotifyPrevious = useCallback(() => { spotifyPlayerRef.current?.previousTrack?.(); }, []);
    // Starts a specific track by Spotify URI on this device - requires
    // transferring playback to our Web Playback SDK device_id first via
    // the regular Web API (the SDK player itself has no "play this URI"
    // method; it can only control whatever is already playing on it).
    const spotifyPlayUri = useCallback(async (uri) => {
        if (!spotifyDeviceId || !spotifyAuth.accessToken) return;
        try {
            await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${spotifyAuth.accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ uris: [uri] }),
            });
        } catch (e) {
            setSpotifyAuth((prev) => ({ ...prev, error: 'Could not start Spotify playback' }));
        }
    }, [spotifyDeviceId, spotifyAuth.accessToken]);

    // ========================================================================
    // APPLE MUSIC: MusicKit JS
    // ========================================================================
    const loadMusicKitScript = () =>
        new Promise((resolve, reject) => {
            if (window.MusicKit) { resolve(window.MusicKit); return; }
            const existing = document.getElementById('musickit-js-sdk');
            if (existing) {
                document.addEventListener('musickitloaded', () => resolve(window.MusicKit), { once: true });
                return;
            }
            const script = document.createElement('script');
            script.id = 'musickit-js-sdk';
            script.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
            script.async = true;
            script.onerror = () => reject(new Error('Could not load the MusicKit JS SDK (network/ad-blocker?)'));
            document.addEventListener('musickitloaded', () => resolve(window.MusicKit), { once: true });
            document.head.appendChild(script);
        });

    const connectAppleMusic = useCallback(async () => {
        if (!isAppleMusicConfigured()) {
            setAppleMusicAuth((prev) => ({ ...prev, error: 'Apple MusicKit developer token not configured - add it in Settings > Security & API, or see src/config/streamingConfig.js' }));
            return;
        }
        try {
            const MusicKit = await loadMusicKitScript();
            if (!musicKitRef.current) {
                MusicKit.configure({
                    developerToken: getAppleMusicToken(),
                    app: { name: APPLE_MUSICKIT_APP_NAME, build: APPLE_MUSICKIT_APP_BUILD },
                });
                musicKitRef.current = MusicKit.getInstance();
            }
            const musicUserToken = await musicKitRef.current.authorize();
            setAppleMusicAuth({ connected: true, musicUserToken, error: null });
        } catch (err) {
            setAppleMusicAuth((prev) => ({ ...prev, connected: false, error: err.message || 'Apple Music authorization failed or was cancelled' }));
        }
    }, []);

    const disconnectAppleMusic = useCallback(() => {
        try { musicKitRef.current?.unauthorize?.(); } catch (e) { /* best-effort - state below is the source of truth either way */ }
        setAppleMusicAuth({ connected: false, musicUserToken: null, error: null });
        setActiveSourceState((prev) => (prev === 'apple' ? 'local' : prev));
    }, []);

    const appleMusicTogglePlay = useCallback(() => {
        const instance = musicKitRef.current;
        if (!instance) return;
        if (instance.isPlaying) instance.pause(); else instance.play();
    }, []);
    const appleMusicNext = useCallback(() => { musicKitRef.current?.skipToNextItem?.(); }, []);
    const appleMusicPrevious = useCallback(() => { musicKitRef.current?.skipToPreviousItem?.(); }, []);
    const appleMusicPlayTrack = useCallback(async (catalogId) => {
        const instance = musicKitRef.current;
        if (!instance) return;
        try {
            await instance.setQueue({ song: catalogId });
            await instance.play();
        } catch (e) {
            setAppleMusicAuth((prev) => ({ ...prev, error: 'Could not start Apple Music playback' }));
        }
    }, []);

    const value = {
        spotifyAuth,
        connectSpotify,
        disconnectSpotify,
        spotifyDeviceId,
        spotifyTogglePlay,
        spotifyNext,
        spotifyPrevious,
        spotifyPlayUri,
        appleMusicAuth,
        connectAppleMusic,
        disconnectAppleMusic,
        appleMusicTogglePlay,
        appleMusicNext,
        appleMusicPrevious,
        appleMusicPlayTrack,
        activeSource,
        setActiveSource,
        isSpotifyConfigured: isSpotifyConfigured(),
        isAppleMusicConfigured: isAppleMusicConfigured(),
    };

    return <StreamingContext.Provider value={value}>{children}</StreamingContext.Provider>;
};

export const useStreaming = () => {
    const ctx = useContext(StreamingContext);
    if (!ctx) {
        // Defensive fallback so a consumer rendered outside the provider
        // degrades to "everything disconnected, local source only" rather
        // than throwing.
        return {
            spotifyAuth: { connected: false, accessToken: null, refreshToken: null, expiresAt: null, profileName: null, error: null },
            connectSpotify: () => {}, disconnectSpotify: () => {},
            spotifyDeviceId: null, spotifyTogglePlay: () => {}, spotifyNext: () => {}, spotifyPrevious: () => {}, spotifyPlayUri: () => {},
            appleMusicAuth: { connected: false, musicUserToken: null, error: null },
            connectAppleMusic: () => {}, disconnectAppleMusic: () => {},
            appleMusicTogglePlay: () => {}, appleMusicNext: () => {}, appleMusicPrevious: () => {}, appleMusicPlayTrack: () => {},
            activeSource: 'local', setActiveSource: () => {},
            isSpotifyConfigured: false, isAppleMusicConfigured: false,
        };
    }
    return ctx;
};
