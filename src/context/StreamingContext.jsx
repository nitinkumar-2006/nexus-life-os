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
    isYoutubeConfigured, isSaavnConfigured,
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
    // Live playback state from the SDK's own 'player_state_changed' event -
    // a real, reported gap this closes: FloatingBottomPlayer previously had
    // NO way to know what Spotify was actually playing (title/artist/
    // artwork/progress/paused-or-not), since Spotify's SDK plays audio
    // through its own internal context, entirely separate from this app's
    // local <audio> elements - the bottom card looked "disconnected" (blank/
    // stale) even while real Spotify audio was audibly playing. Mirrors the
    // exact same shape/pattern already used for YouTube's
    // youtubeNowPlaying/youtubeIsPlaying/youtubeCurrentTime/youtubeDuration
    // below, for the same reason (a second, genuinely separate playback
    // engine the UI needs to reflect).
    const [spotifyNowPlaying, setSpotifyNowPlaying] = useState(null); // { title, artist, artworkUrl, uri } | null
    const [spotifyIsPlaying, setSpotifyIsPlaying] = useState(false);
    const [spotifyCurrentTime, setSpotifyCurrentTime] = useState(0);
    const [spotifyDuration, setSpotifyDuration] = useState(0);

    // Real, reported bug fixed: spotifyCurrentTime only ever updated from
    // the SDK's own 'player_state_changed' event, which fires on
    // play/pause/seek/track-change - NOT once a second while a track is
    // simply playing. The bottom player's timer/progress bar looked
    // "stuck"/broken between those events even though the actual audio was
    // advancing fine ("song toh chalta rehta hai but timer... properly
    // kaam nahi kar raha"). This ticks the DISPLAYED position locally once
    // a second while playing, clamped to the known duration - the SDK's
    // own event still remains the real resync point on every actual state
    // change, this just fills the visual gap between them.
    useEffect(() => {
        if (!spotifyIsPlaying) return undefined;
        const id = setInterval(() => {
            setSpotifyCurrentTime((prev) => Math.min(prev + 1, spotifyDuration || prev + 1));
        }, 1000);
        return () => clearInterval(id);
    }, [spotifyIsPlaying, spotifyDuration]);

    // --- Apple Music: fully isolated state ---
    const [appleMusicAuth, setAppleMusicAuth] = useState(() => loadJson(APPLE_MUSIC_KEY, {
        connected: false, musicUserToken: null, error: null,
    }));
    const musicKitRef = useRef(null);

    // --- YouTube: key-based (Data API v3), no per-user OAuth - a
    // confirmed key (Settings > API Integrations, shared with the
    // Syllabus Hub) IS the connection, there's no separate handshake.
    // "Connected" therefore just mirrors isYoutubeConfigured() rather
    // than being its own independently-earned state. ---
    const [youtubeAuth, setYoutubeAuth] = useState(() => ({ connected: isYoutubeConfigured(), error: null }));
    const youtubePlayerRef = useRef(null); // YT.Player instance (hidden IFrame)
    const [youtubePlayerReady, setYoutubePlayerReady] = useState(false);

    // --- Saavn: no credentials at all (every public mirror of this
    // unofficial API is unauthenticated) - "connected" is purely the
    // user's own on/off preference (saavnEnabled in Settings), not a real
    // auth state. Saavn tracks resolve to a normal, direct, playable URL
    // (see saavnClient.js), so they play through the SAME <audio>
    // elements every local/imported track already uses - Saavn never
    // becomes an activeSource value the way Spotify/Apple/YouTube do. ---
    const [saavnAuth, setSaavnAuth] = useState(() => ({ connected: isSaavnConfigured(), error: null }));

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
        const handleSettingsUpdated = () => {
            forceCredentialRecheck((n) => n + 1);
            // YouTube/Saavn have no OAuth callback of their own to update
            // their `connected` flag from (unlike Spotify/Apple, which set
            // it inside exchangeSpotifyCode/connectAppleMusic) - it's
            // derived straight from Settings, so it has to be re-derived
            // here whenever Settings changes, including a change made
            // directly on the Settings page rather than via the Audio Hub
            // connect button.
            setYoutubeAuth((prev) => ({ ...prev, connected: isYoutubeConfigured() }));
            setSaavnAuth((prev) => ({ ...prev, connected: isSaavnConfigured() }));
        };
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
        if (source === 'youtube' && !youtubeAuth.connected) return;
        // Saavn is deliberately never a valid activeSource value - see the
        // comment on saavnAuth above; its tracks play through the normal
        // 'local' <audio> pathway, so there's nothing for this switch to
        // steer for it.
        setActiveSourceState(source);
    }, [spotifyAuth.connected, appleMusicAuth.connected, youtubeAuth.connected]);

    // ========================================================================
    // SPOTIFY: Authorization Code + PKCE
    // ========================================================================
    const connectSpotify = useCallback(async () => {
        if (!isSpotifyConfigured()) {
            setSpotifyAuth((prev) => ({ ...prev, error: 'Spotify Client ID not configured - add it in Settings > Security & API, or see src/config/streamingConfig.js' }));
            return;
        }
        // Real, reported bug caught before it happens: opening this app on
        // a PHONE by pointing it at the dev machine's LAN IP (e.g.
        // http://192.168.x.x:5174 - the only way a phone can reach a
        // laptop's own dev server at all) makes SPOTIFY_REDIRECT_URI
        // compute to that LAN address too (window.location.origin), which
        // almost certainly isn't the exact URI registered in the Spotify
        // Dashboard (that's near-always just the desktop's own
        // 127.0.0.1:PORT, per SPOTIFY_REDIRECT_URI's own comment) -
        // Spotify then rejects the whole login with a bare "redirect_uri:
        // Not matching configuration" page, live-confirmed, that gives no
        // hint at all about what to actually do. Genuinely fixable only on
        // Spotify's own Dashboard (adding a second Redirect URI there is
        // real account access this app can't do on someone's behalf) - so
        // this catches it BEFORE the redirect and tells them precisely
        // which exact string to add, instead of sending them into that
        // dead end.
        const isLikelyLanHost = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(window.location.hostname);
        if (isLikelyLanHost) {
            setSpotifyAuth((prev) => ({
                ...prev,
                error: `This device is on ${window.location.origin} - Spotify will reject login unless that exact address is added as a Redirect URI in your Spotify Dashboard. Add "${SPOTIFY_REDIRECT_URI}" there (developer.spotify.com/dashboard -> your app -> Settings -> Redirect URIs), or connect from the same computer running the dev server instead (127.0.0.1).`,
            }));
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
                    name: 'Nexus OS',
                    getOAuthToken: (cb) => cb(spotifyAuth.accessToken),
                    volume: 0.8,
                });
                player.addListener('ready', ({ device_id }) => { if (!cancelled) setSpotifyDeviceId(device_id); });
                player.addListener('not_ready', () => { if (!cancelled) setSpotifyDeviceId(null); });
                // The real source of truth for "what is Spotify actually
                // doing right now" - fires on every play/pause/seek/track
                // change. A null state (nothing loaded on this device yet)
                // is handled explicitly rather than crashing on
                // state.track_window.
                player.addListener('player_state_changed', (state) => {
                    if (cancelled) return;
                    if (!state) {
                        setSpotifyNowPlaying(null);
                        setSpotifyIsPlaying(false);
                        return;
                    }
                    const track = state.track_window?.current_track;
                    if (track) {
                        setSpotifyNowPlaying({
                            title: track.name || 'Unknown Title',
                            artist: Array.isArray(track.artists) ? track.artists.map((a) => a.name).filter(Boolean).join(', ') : '',
                            artworkUrl: track.album?.images?.[0]?.url || '',
                            // Real fix for a real, reported gap: without this,
                            // a Spotify track that reached Recently Played
                            // had no stable identifier at all to replay it
                            // from that list later - clicking it did
                            // nothing, honestly shown as "not replayable"
                            // rather than a dead click, but that's a real
                            // gap, not the actual desired behavior. The SDK's
                            // own track object always carries this.
                            uri: track.uri || '',
                        });
                    }
                    setSpotifyIsPlaying(!state.paused);
                    setSpotifyCurrentTime((state.position || 0) / 1000);
                    setSpotifyDuration((state.duration || 0) / 1000);
                });
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

    // Real, reported bug: spotifyIsPlaying/spotifyCurrentTime/spotifyDuration
    // above were updated ONLY by the SDK's own 'player_state_changed' event
    // - genuinely correct while this device stays the active one and every
    // event actually arrives, but Spotify's own SDK is well known to miss
    // that event after a backgrounded tab is throttled, or - more likely
    // day to day - once playback is controlled from a DIFFERENT device
    // (the phone's real Spotify app, a speaker, etc. via Spotify Connect):
    // this Web Playback device stops hearing state changes at all, and the
    // last isPlaying/currentTime it knew about just sits there - matching
    // exactly what was reported ("kabhi kabhi song rukta hai to bar aage
    // badhte rehta hai", "kabhi kabhi freeze ho jata hai", Play/Next/Prev
    // occasionally doing nothing). A periodic getCurrentState() poll is
    // the standard fix: it re-asks the SDK directly rather than only
    // waiting for a push event, so drift self-corrects within a few
    // seconds instead of staying stuck for the rest of the session. A
    // null state means this device genuinely isn't Spotify's active
    // player right now (control is elsewhere) - reflected as "not
    // playing" here rather than left showing stale, increasingly wrong
    // progress.
    useEffect(() => {
        if (activeSource !== 'spotify' || !spotifyDeviceId) return undefined;
        const id = setInterval(() => {
            const player = spotifyPlayerRef.current;
            if (!player) return;
            player.getCurrentState().then((state) => {
                if (!state) {
                    setSpotifyIsPlaying(false);
                    return;
                }
                setSpotifyIsPlaying(!state.paused);
                setSpotifyCurrentTime((state.position || 0) / 1000);
                setSpotifyDuration((state.duration || 0) / 1000);
            }).catch(() => {});
        }, 3000);
        return () => clearInterval(id);
    }, [activeSource, spotifyDeviceId]);

    // Real playback-control functions, routed to by AudioPlayerContext
    // whenever activeSource is the matching service. Both check the
    // relevant connected/ready state first and no-op rather than throw if
    // called while not actually available.
    const spotifyTogglePlay = useCallback(() => { spotifyPlayerRef.current?.togglePlay?.(); }, []);
    const spotifyNext = useCallback(() => { spotifyPlayerRef.current?.nextTrack?.(); }, []);
    const spotifyPrevious = useCallback(() => { spotifyPlayerRef.current?.previousTrack?.(); }, []);
    // seek() takes milliseconds - callers (FloatingBottomPlayer's scrubber)
    // work in seconds like every other source here, so the conversion
    // happens at this one boundary rather than leaking ms into the UI.
    const spotifySeek = useCallback((seconds) => { spotifyPlayerRef.current?.seek?.(Math.max(0, seconds) * 1000); }, []);
    // Real, reported bug: the Master Volume slider (Settings) and the
    // player's own volume slider both only ever touched the local <audio>
    // element's volume - Spotify's Web Playback SDK has its own, entirely
    // separate volume (the player instance was created with a fixed
    // `volume: 0.8` above and never updated again), so neither slider had
    // any effect while Spotify was the active, playing source. `v` is a
    // 0-1 float, matching every other volume value already used in this
    // app - the SDK's own setVolume() takes the exact same range.
    const spotifySetVolume = useCallback((v) => { spotifyPlayerRef.current?.setVolume?.(Math.min(1, Math.max(0, v))); }, []);
    // Starts a specific track by Spotify URI on this device - requires
    // transferring playback to our Web Playback SDK device_id first via
    // the regular Web API (the SDK player itself has no "play this URI"
    // method; it can only control whatever is already playing on it).
    //
    // Real, reported bug fixed: every caller here used to send only
    // `{ uris: [uri] }` - a single-track play with nothing queued after
    // it. Spotify's own Web Playback SDK device then genuinely has
    // nothing to advance to, so tapping Next (nextTrack()) silently did
    // nothing - "एक ही song play हो रहा है, Next करने पर कोई song play
    // नहीं होता", live-confirmed against a real 50-track genre list. The
    // fix is real Spotify API behavior, not a workaround: `uris` accepts
    // the WHOLE track list, and `offset` tells it which one to actually
    // start on - Spotify's own device then owns the rest of the queue,
    // and Next/Previous (already wired to the SDK's real nextTrack()/
    // previousTrack()) work exactly like tapping a song inside a real
    // Spotify playlist. Optional third arg, so every existing single-
    // track caller (Recently Played tiles, More Like Artist, etc. - where
    // there's no real ordered "playlist" backing the click anyway) keeps
    // working completely unchanged.
    //
    // Real, live-confirmed follow-up bug fixed (a real Premium account's
    // own browser console showed a real, repeated `PUT .../player/play`
    // 400 Bad Request - one per click, every single click): the queue fix
    // above used `offset: { uri }`, but Spotify's API requires that exact
    // uri to actually be present INSIDE the `uris` array it was just sent
    // - and every caller here caps that array at 100 entries (Spotify's
    // own hard limit) before calling this, so clicking anything past
    // position 100 in a longer list sent an offset Spotify could never
    // find, and the whole request was rejected. Finding the real index
    // via indexOf and sending `offset: { position }` instead is immune to
    // that (a valid array index needs no string match at all); if the
    // clicked uri genuinely isn't in the sent queue (index -1), the
    // offset is dropped entirely rather than sending an invalid one - the
    // queue still plays, just from its own first track instead of
    // silently failing outright. This also now actually checks the
    // response and surfaces a real failure (status + Spotify's own error
    // detail) instead of the previous silent swallow - a non-2xx response
    // from fetch() never throws, so the old try/catch never saw these 400s
    // at all; the user only ever saw "nothing happens" with the real
    // reason sitting undiscoverable in the browser's own console.
    const spotifyPlayUri = useCallback(async (uri, queueUris = null) => {
        if (!spotifyDeviceId || !spotifyAuth.accessToken) return;
        try {
            let body;
            if (Array.isArray(queueUris) && queueUris.length > 0) {
                const position = queueUris.indexOf(uri);
                body = position >= 0 ? { uris: queueUris, offset: { position } } : { uris: queueUris };
            } else {
                body = { uris: [uri] };
            }
            const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${spotifyAuth.accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                let detail = '';
                try { detail = (await res.json())?.error?.message || ''; } catch (parseErr) { /* non-JSON error body */ }
                setSpotifyAuth((prev) => ({ ...prev, error: `Spotify playback failed (${res.status})${detail ? `: ${detail}` : ''}` }));
            }
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

    // ========================================================================
    // YOUTUBE: hidden IFrame Player. There is no direct, playable audio URL
    // for a YouTube video (that's specifically why this needs a real player
    // instance instead of just handing a URL to an <audio> element) - the
    // IFrame Player API is the standard, Google-documented way to get
    // programmatic play/pause/seek/getCurrentTime control over a video
    // without showing its player chrome; a 1x1, off-screen, pointer-events:
    // none container is enough, visibility has no effect on audio output.
    // ========================================================================
    const [youtubeNowPlaying, setYoutubeNowPlaying] = useState(null); // { videoId, title, artist, artworkUrl } | null
    const [youtubeIsPlaying, setYoutubeIsPlaying] = useState(false);
    const [youtubeCurrentTime, setYoutubeCurrentTime] = useState(0);
    const [youtubeDuration, setYoutubeDuration] = useState(0);
    // Refs are the real source of truth for the imperative next/prev logic
    // below (avoids stale-closure issues inside useCallback) - a linear
    // browsable queue for next/prev over a set of search results, same idea
    // as AudioPlayerContext's own playlist/currentSongIndex but
    // intentionally separate (YouTube's queue is its own thing, not
    // spliced into the local <audio> playlist). Mirrored into real React
    // state alongside (youtubeQueue/youtubeQueueIndex below) purely so
    // "Up Next" can actually display it reactively - explicit, reported
    // gap: Up Next only ever showed the local queue, even while YouTube
    // was the genuinely active, audible source.
    const youtubeQueueRef = useRef([]);
    const youtubeQueueIndexRef = useRef(-1);
    const [youtubeQueue, setYoutubeQueueDisplay] = useState([]);
    const [youtubeQueueIndex, setYoutubeQueueIndexDisplay] = useState(-1);

    const loadYoutubeIframeApi = () =>
        new Promise((resolve) => {
            if (window.YT?.Player) { resolve(window.YT); return; }
            const previousCallback = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => { previousCallback?.(); resolve(window.YT); };
            if (document.getElementById('youtube-iframe-api')) return; // script already loading, the callback above will still fire
            const script = document.createElement('script');
            script.id = 'youtube-iframe-api';
            script.src = 'https://www.youtube.com/iframe_api';
            script.async = true;
            document.head.appendChild(script);
        });

    const ensureYoutubePlayer = useCallback(async () => {
        if (youtubePlayerRef.current) return youtubePlayerRef.current;
        let container = document.getElementById('nexus-youtube-hidden-player');
        if (!container) {
            container = document.createElement('div');
            container.id = 'nexus-youtube-hidden-player';
            // Genuinely hidden, not just visually - 1x1 off-screen and
            // non-interactive, so it can never intercept a click meant for
            // real UI underneath/around it.
            container.style.cssText = 'position:fixed; width:1px; height:1px; overflow:hidden; opacity:0; pointer-events:none; left:-9999px; top:-9999px;';
            document.body.appendChild(container);
        }
        const YT = await loadYoutubeIframeApi();
        return new Promise((resolve) => {
            const player = new YT.Player(container.id, {
                height: '1', width: '1',
                playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, modestbranding: 1 },
                events: {
                    onReady: () => { setYoutubePlayerReady(true); resolve(player); },
                    onStateChange: (e) => {
                        if (e.data === YT.PlayerState.PLAYING) setYoutubeIsPlaying(true);
                        else if (e.data === YT.PlayerState.PAUSED) setYoutubeIsPlaying(false);
                        else if (e.data === YT.PlayerState.ENDED) {
                            setYoutubeIsPlaying(false);
                            // Mirrors the local <audio> elements' own onEnded
                            // -> next() behavior, so "track finishes ->
                            // advance the queue" works identically
                            // regardless of which source is playing.
                            youtubeNext();
                        }
                    },
                    onError: () => {
                        setYoutubeAuth((prev) => ({ ...prev, error: 'This YouTube video is unavailable, region-blocked, or the uploader has disabled embedding.' }));
                        setYoutubeIsPlaying(false);
                    },
                },
            });
            youtubePlayerRef.current = player;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const playYoutubeTrack = useCallback(async (track) => {
        if (!isYoutubeConfigured()) {
            setYoutubeAuth({ connected: false, error: 'YouTube Data API key not configured or not confirmed - add it in Settings > API Integrations.' });
            return;
        }
        try {
            const player = await ensureYoutubePlayer();
            player.loadVideoById(track.videoId);
            setYoutubeNowPlaying({ videoId: track.videoId, title: track.title, artist: track.artist || '', artworkUrl: track.artworkUrl || '' });
            setYoutubeCurrentTime(0);
            setYoutubeDuration(0);
            setYoutubeAuth({ connected: true, error: null });
            setActiveSourceState('youtube');
        } catch (e) {
            setYoutubeAuth((prev) => ({ ...prev, error: 'Could not start YouTube playback (network issue loading the player, or an ad-blocker is blocking youtube.com).' }));
        }
    }, [ensureYoutubePlayer]);

    // Loads a full result list as a browsable queue and starts playing the
    // given index - the YouTube equivalent of AudioPlayerContext's own
    // queuePlaylistTracks, kept deliberately separate from it (see the
    // queue-ref comment above).
    const setYoutubeQueue = useCallback((tracks, startIndex = 0) => {
        const list = Array.isArray(tracks) ? tracks : [];
        youtubeQueueRef.current = list;
        youtubeQueueIndexRef.current = startIndex;
        setYoutubeQueueDisplay(list);
        setYoutubeQueueIndexDisplay(startIndex);
        const track = list[startIndex];
        if (track) playYoutubeTrack(track);
    }, [playYoutubeTrack]);

    const youtubeTogglePlay = useCallback(() => {
        const player = youtubePlayerRef.current;
        if (!player) return;
        if (youtubeIsPlaying) player.pauseVideo(); else player.playVideo();
        // No optimistic setYoutubeIsPlaying here, deliberately - onStateChange
        // above is the single source of truth, same reasoning as the local
        // <audio> elements' own onPlay/onPause (see togglePlay's comment in
        // AudioPlayerContext.jsx): this guarantees the UI can never drift
        // out of sync with what the player is actually doing.
    }, [youtubeIsPlaying]);

    const youtubeNext = useCallback(() => {
        const queue = youtubeQueueRef.current;
        const nextIndex = youtubeQueueIndexRef.current + 1;
        if (!queue.length || nextIndex >= queue.length) return; // end of queue - nothing to advance to
        youtubeQueueIndexRef.current = nextIndex;
        setYoutubeQueueIndexDisplay(nextIndex);
        playYoutubeTrack(queue[nextIndex]);
    }, [playYoutubeTrack]);

    const youtubePrevious = useCallback(() => {
        const queue = youtubeQueueRef.current;
        const prevIndex = youtubeQueueIndexRef.current - 1;
        if (!queue.length || prevIndex < 0) return;
        youtubeQueueIndexRef.current = prevIndex;
        setYoutubeQueueIndexDisplay(prevIndex);
        playYoutubeTrack(queue[prevIndex]);
    }, [playYoutubeTrack]);

    const youtubeSeek = useCallback((time) => {
        youtubePlayerRef.current?.seekTo(time, true);
        setYoutubeCurrentTime(time);
    }, []);

    // Polls getCurrentTime()/getDuration() while YouTube is the active
    // source - the IFrame Player API has no native "timeupdate" event the
    // way HTML5 <audio> does, so polling is the standard, documented way
    // every YouTube-as-audio-backend integration surfaces live progress.
    useEffect(() => {
        if (activeSource !== 'youtube' || !youtubePlayerReady) return undefined;
        const interval = setInterval(() => {
            const player = youtubePlayerRef.current;
            if (!player?.getCurrentTime) return;
            setYoutubeCurrentTime(player.getCurrentTime() || 0);
            const d = player.getDuration ? player.getDuration() || 0 : 0;
            if (d > 0) setYoutubeDuration(d);
        }, 500);
        return () => clearInterval(interval);
    }, [activeSource, youtubePlayerReady]);

    const connectYoutube = useCallback(() => {
        if (!isYoutubeConfigured()) {
            setYoutubeAuth({ connected: false, error: 'YouTube Data API key not configured or not confirmed - add it in Settings > API Integrations.' });
            return;
        }
        setYoutubeAuth({ connected: true, error: null });
        // "Connecting" here just means "make YouTube the active playback
        // source" - unlike Spotify/Apple there's no separate OAuth step to
        // complete first, a confirmed API key already IS the connection.
        setActiveSourceState('youtube');
    }, []);

    const disconnectYoutube = useCallback(() => {
        try { youtubePlayerRef.current?.stopVideo?.(); } catch (e) { /* best-effort */ }
        setYoutubeIsPlaying(false);
        setYoutubeNowPlaying(null);
        setYoutubeAuth((prev) => ({ ...prev, connected: false }));
        setActiveSourceState((prev) => (prev === 'youtube' ? 'local' : prev));
        // Deliberately does NOT clear youtubeApiKey/youtubeApiKeyConfirmed
        // in Settings - that field is shared with the Syllabus Hub's own
        // video search, "disconnecting" here only stops using it for Audio
        // Hub playback, exactly like disconnectSpotify/disconnectAppleMusic
        // only ever touch their own isolated auth state, never credentials.
    }, []);

    // ========================================================================
    // SAAVN: no credentials at all (see streamingConfig.js), but exactly
    // like YouTube, "connected" here mirrors isSaavnConfigured() rather
    // than being its own independently-earned state - it's just held to a
    // stricter bar (both saavnEnabled AND a real, test-search-verified
    // saavnApiBaseUrlConfirmed, not merely "the toggle is on") after an
    // earlier version of this let the badge show "Connected" the instant
    // the toggle flipped, with no check that the configured mirror
    // actually responds. Saavn tracks resolve to a normal, direct,
    // playable URL, so playback itself goes through AudioPlayerContext's
    // existing playTrackNow(), NOT a dedicated activeSource branch the
    // way Spotify/Apple/YouTube need - there's nothing here to steer.
    // ========================================================================
    const connectSaavn = useCallback(() => {
        if (!isSaavnConfigured()) {
            setSaavnAuth({ connected: false, error: 'Saavn is not verified yet - turn it on and confirm a working API mirror in Settings > API Integrations first.' });
            return;
        }
        setSaavnAuth({ connected: true, error: null });
    }, []);

    const disconnectSaavn = useCallback(() => {
        // Only turns Saavn off for search/playback in THIS session - does
        // NOT touch saavnEnabled/saavnApiBaseUrlConfirmed in Settings, the
        // same way disconnectYoutube never touches the YouTube API key it
        // reads. Re-enabling reconnects instantly without re-verifying,
        // since the mirror's own reachability hasn't changed.
        setSaavnAuth({ connected: false, error: null });
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
        spotifySeek,
        spotifySetVolume,
        spotifyNowPlaying,
        spotifyIsPlaying,
        spotifyCurrentTime,
        spotifyDuration,
        appleMusicAuth,
        connectAppleMusic,
        disconnectAppleMusic,
        appleMusicTogglePlay,
        appleMusicNext,
        appleMusicPrevious,
        appleMusicPlayTrack,
        youtubeAuth,
        connectYoutube,
        disconnectYoutube,
        youtubeNowPlaying,
        youtubeIsPlaying,
        youtubeCurrentTime,
        youtubeDuration,
        youtubeTogglePlay,
        youtubeNext,
        youtubePrevious,
        youtubeSeek,
        playYoutubeTrack,
        setYoutubeQueue,
        youtubeQueue,
        youtubeQueueIndex,
        saavnAuth,
        connectSaavn,
        disconnectSaavn,
        activeSource,
        setActiveSource,
        isSpotifyConfigured: isSpotifyConfigured(),
        isAppleMusicConfigured: isAppleMusicConfigured(),
        isYoutubeConfigured: isYoutubeConfigured(),
        isSaavnConfigured: isSaavnConfigured(),
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
            spotifyDeviceId: null, spotifyTogglePlay: () => {}, spotifyNext: () => {}, spotifyPrevious: () => {}, spotifyPlayUri: () => {}, spotifySeek: () => {}, spotifySetVolume: () => {},
            spotifyNowPlaying: null, spotifyIsPlaying: false, spotifyCurrentTime: 0, spotifyDuration: 0,
            appleMusicAuth: { connected: false, musicUserToken: null, error: null },
            connectAppleMusic: () => {}, disconnectAppleMusic: () => {},
            appleMusicTogglePlay: () => {}, appleMusicNext: () => {}, appleMusicPrevious: () => {}, appleMusicPlayTrack: () => {},
            youtubeAuth: { connected: false, error: null },
            connectYoutube: () => {}, disconnectYoutube: () => {},
            youtubeNowPlaying: null, youtubeIsPlaying: false, youtubeCurrentTime: 0, youtubeDuration: 0,
            youtubeTogglePlay: () => {}, youtubeNext: () => {}, youtubePrevious: () => {}, youtubeSeek: () => {},
            playYoutubeTrack: () => {}, setYoutubeQueue: () => {},
            youtubeQueue: [], youtubeQueueIndex: -1,
            saavnAuth: { connected: false, error: null },
            connectSaavn: () => {}, disconnectSaavn: () => {},
            activeSource: 'local', setActiveSource: () => {},
            isSpotifyConfigured: false, isAppleMusicConfigured: false, isYoutubeConfigured: false, isSaavnConfigured: false,
        };
    }
    return ctx;
};
