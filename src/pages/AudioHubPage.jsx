// src/pages/AudioHubPage.jsx
//
// The Audio & Focus Hub: a persistent player console + reorderable queue at
// the top, with four browsable sub-tabs beneath it (Library/Playlists,
// Global Search, Ambient Focus, Local Files). Structured so a real
// streaming API (e.g. Apple Music/MusicKit) can later replace
// src/data/audioLibraryMock.js's mock catalog and the search tab's local
// filtering with real endpoint calls, without this file's rendering or
// queueing logic needing to change - see the shape documentation at the
// top of audioLibraryMock.js for exactly what that swap would touch.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Play, Pause, SkipForward, SkipBack, Music, Trash2, Volume2, VolumeX,
    Disc, ArrowUp, ArrowDown, UploadCloud, CloudRain, TreePine, Coffee, Wind,
    Search, Shuffle, Heart, Library, ListMusic, FolderOpen, X, ChevronLeft, Radio,
    Repeat, Repeat1, Apple, Check, Loader2, CheckCircle2,
} from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext.jsx';
import { useStreaming } from '../context/StreamingContext.jsx';
import { getSynthPresetUrl } from '../utils/noiseSynth.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { AUDIO_LIBRARY, getAllLibraryTracks } from '../data/audioLibraryMock.js';

const ACCEPTED_EXTENSIONS = ['mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg'];

const isSupportedAudioFile = (file) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ACCEPTED_EXTENSIONS.includes(ext)) return true;
    return !!(file.type && file.type.startsWith('audio/'));
};

const deriveTitle = (filename) => {
    const withoutExt = filename.replace(/\.[^/.]+$/, '');
    const cleaned = withoutExt.replace(/[_-]+/g, ' ').trim();
    return cleaned || filename;
};

const formatTime = (seconds) => {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

// A deterministic placeholder gradient per playlist id, so cards without
// real artwork still look distinct from each other rather than identical -
// swapped for real artworkUrl images the moment a real API provides one.
const GRADIENT_PALETTE = [
    ['#6366F1', '#8B5CF6'], ['#F97316', '#EC4899'], ['#10B981', '#3B82F6'],
    ['#EAB308', '#F97316'], ['#8B5CF6', '#EC4899'], ['#06B6D4', '#6366F1'],
];
const gradientForId = (id) => {
    const safeId = id && typeof id === 'string' && id.length > 0 ? id : 'default';
    let hash = 0;
    for (let i = 0; i < safeId.length; i++) hash = (hash * 31 + safeId.charCodeAt(i)) >>> 0;
    const [a, b] = GRADIENT_PALETTE[hash % GRADIENT_PALETTE.length];
    return `linear-gradient(135deg, ${a}, ${b})`;
};

// Strict display truncation for compact card labels (e.g. Recently Played):
// only the first `maxWords` words, with a trailing ellipsis whenever
// anything was actually cut. A full, untruncated title is still available
// via the card's own title="" tooltip and is always what's used for
// playback - this only ever changes what's rendered on screen.
const shortTitle = (title, maxWords = 2) => {
    if (!title) return '';
    const words = title.trim().split(/\s+/);
    if (words.length <= maxWords) return title;
    return `${words.slice(0, maxWords).join(' ')}...`;
};

// A small animated equalizer - bars only animate while isPlaying is
// genuinely true (paused via CSS animation-play-state, not remounted),
// so it starts/stops in exact sync with actual playback rather than
// looping regardless of state.
const EqualizerBars = React.memo(({ isPlaying, size = 'normal' }) => {
    const barCount = 4;
    const heightPx = size === 'small' ? 14 : 20;
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2.5px', height: `${heightPx}px` }}>
            {Array.from({ length: barCount }, (_, i) => (
                <div
                    key={i}
                    style={{
                        width: '3px', borderRadius: '2px', background: 'var(--primary)',
                        height: '100%',
                        animation: `nexusEqBar${i % 3} ${0.7 + i * 0.15}s ease-in-out infinite`,
                        animationPlayState: isPlaying ? 'running' : 'paused',
                        opacity: isPlaying ? 1 : 0.35,
                        transformOrigin: 'bottom',
                    }}
                />
            ))}
            <style>{`
                @keyframes nexusEqBar0 { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
                @keyframes nexusEqBar1 { 0%, 100% { transform: scaleY(0.9); } 50% { transform: scaleY(0.25); } }
                @keyframes nexusEqBar2 { 0%, 100% { transform: scaleY(0.5); } 50% { transform: scaleY(1); } }
            `}</style>
        </div>
    );
});

// Quick-launch ambient loops for background focus. Synthesized in-browser
// (see src/utils/noiseSynth.js) - zero network dependency, so they can
// never 404 or go dead, unlike the external hotlink URLs used previously.
const AMBIENT_PRESETS = [
    { title: 'Rain', icon: CloudRain, profileKey: 'rain' },
    { title: 'Forest', icon: TreePine, profileKey: 'forest' },
    { title: 'Coffee Shop', icon: Coffee, profileKey: 'coffeeShop' },
    { title: 'White Noise', icon: Wind, profileKey: 'whiteNoise' },
];

const SUB_TABS = [
    { id: 'library', label: 'Library / Playlists', icon: Library },
    { id: 'search', label: 'Global Search', icon: Search },
    { id: 'ambient', label: 'Ambient Focus', icon: Wind },
    { id: 'local', label: 'Local Files', icon: FolderOpen },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// Sized to exactly match the Recently Played / Quick Mix cards below it
// (same 132px flex-basis, 112px fixed artwork square, 10px padding,
// single-line title, no separate description row) - these used to be a
// visibly different, much larger card shape (160x212px vs Recently
// Played's 134x160px: 18px padding, a full aspect-ratio-square artwork,
// and a two-line title+description), which made the two rows look like
// they belonged to two different apps stacked on top of each other. The
// playlist's own description is still real and available - it's just
// shown on PlaylistDetailView once opened, not doubled up here too.
const PlaylistCard = React.memo(({ playlist, isFavorite, onOpen, onToggleFavorite, onShufflePlay }) => (
    <div
        style={{
            flex: '0 0 132px', display: 'flex', flexDirection: 'column', gap: '10px', cursor: 'pointer',
            background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px',
            padding: '10px', transition: 'border-color 0.15s ease',
        }}
        onClick={() => onOpen(playlist)}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-premium)'; }}
    >
        <div style={{ position: 'relative', width: '112px', height: '112px', borderRadius: '12px', overflow: 'hidden', background: gradientForId(playlist.id), flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Disc size={32} color="rgba(255,255,255,0.85)" />
            </div>
            <button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(playlist.id); }}
                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                style={{
                    position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.55)',
                    border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer',
                }}
            >
                <Heart size={12} color={isFavorite ? '#F43F5E' : '#fff'} fill={isFavorite ? '#F43F5E' : 'none'} />
            </button>
            <button
                onClick={(e) => { e.stopPropagation(); onShufflePlay(playlist); }}
                title="Shuffle play"
                style={{
                    position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(0,0,0,0.65)',
                    border: 'none', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer', color: '#fff',
                }}
            >
                <Shuffle size={13} />
            </button>
        </div>
        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 1px' }} title={playlist.title}>
            {playlist.title}
        </span>
    </div>
));

const PlaylistDetailView = React.memo(({ playlist, onBack, onPlayTrack, onShufflePlay, onQueueAll }) => {
    const tracks = useMemo(() => playlist.trackRefs(), [playlist]);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <button onClick={onBack} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '10px', padding: '8px', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex' }}><ChevronLeft size={18} /></button>
                <div style={{ width: '64px', height: '64px', borderRadius: '12px', background: gradientForId(playlist.id), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Disc size={28} color="rgba(255,255,255,0.85)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{playlist.title}</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{playlist.description} · {tracks.length} tracks</p>
                </div>
                <button
                    onClick={() => onQueueAll(tracks)}
                    style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', color: 'var(--text-primary)', borderRadius: '10px', padding: '8px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    <ListMusic size={14} /> Play All
                </button>
                <button
                    onClick={() => onShufflePlay(playlist)}
                    style={{ background: 'var(--primary)', border: 'none', color: '#fff', borderRadius: '10px', padding: '8px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    <Shuffle size={14} /> Shuffle
                </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {tracks.map((t, i) => (
                    <div
                        key={t.id}
                        onClick={() => onPlayTrack(t)}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', cursor: 'pointer' }}
                    >
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', width: '18px' }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.artist}</div>
                        </div>
                        <Play size={14} color="var(--text-muted)" />
                    </div>
                ))}
            </div>
        </div>
    );
});

// One connect button + active-source toggle per streaming service. Same
// component drives both Apple Music and Spotify - only the branding
// (icon/color/label) and the auth state/handlers passed in differ, so the
// two buttons can never drift out of sync in behavior.
const StreamingServiceControl = ({
    label, icon, brandGradient, brandGlowColor,
    connected, connecting, error, configured,
    onConnect, onDisconnect, onNeedsSetup,
    isActive, onSetActive, isMobile,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [showError, setShowError] = useState(false);
    useEffect(() => {
        if (!error) return undefined;
        setShowError(true);
        const t = setTimeout(() => setShowError(false), 6000);
        return () => clearTimeout(t);
    }, [error]);

    // Graceful instead of abrupt: clicking an unconfigured service used to
    // attempt a real connection, which immediately failed and popped an
    // error box. Now it never even attempts that - it opens a clean,
    // informational setup modal instead, since "not configured yet" is a
    // known, expected state rather than a surprise failure.
    const handleClick = () => {
        if (connected) { onDisconnect(); return; }
        if (!configured) { onNeedsSetup(); return; }
        onConnect();
    };

    return (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '10px', width: isMobile ? '100%' : 'auto', minWidth: 0 }}>
            <button
                onClick={handleClick}
                disabled={connecting}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                title={!configured ? `${label}: tap to see setup steps` : (connected ? `Disconnect ${label}` : `Connect ${label}`)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 16px', borderRadius: '12px',
                    background: connected ? 'var(--widget-bg)' : (configured ? brandGradient : 'var(--widget-bg)'),
                    border: `1px solid ${connected ? 'var(--border-premium)' : (configured ? 'transparent' : 'var(--border-premium)')}`,
                    color: connected ? 'var(--text-primary)' : (configured ? '#fff' : 'var(--text-muted)'),
                    fontWeight: '700', fontSize: '13px', cursor: connecting ? 'wait' : 'pointer',
                    opacity: configured ? 1 : 0.75,
                    minWidth: isMobile ? 0 : '176px', width: isMobile ? '100%' : 'auto', flex: isMobile ? '1 1 0' : 'none',
                    justifyContent: 'center', boxSizing: 'border-box',
                    // Signature brand glow on hover, only while the button is
                    // actually its branded self (configured, not yet
                    // connected) - once connected it goes back to the
                    // neutral widget style, so the glow only ever appears on
                    // the "come connect me" state it's meant to invite.
                    boxShadow: isHovered && configured && !connected ? `0 6px 24px ${brandGlowColor}` : 'none',
                    transform: isHovered && configured && !connected ? 'translateY(-1px)' : 'none',
                    transition: 'box-shadow 0.25s ease, transform 0.2s ease',
                }}
            >
                {connecting ? <Loader2 size={15} className="nexus-spin" /> : icon}
                {connecting ? 'Connecting...' : connected ? `${label} Connected` : `Connect ${label}`}
            </button>

            {/* Active-source toggle - only meaningful (and only shown) once
                actually connected. Clicking it when already active hands
                playback back to the local library rather than leaving no
                way to turn a source "off". */}
            {connected && (
                <button
                    onClick={() => onSetActive(isActive ? 'local' : undefined)}
                    title={isActive ? `${label} is steering the queue - click to switch back to Local` : `Make ${label} the active source`}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '20px',
                        background: isActive ? 'rgba(16,185,129,0.15)' : 'var(--widget-bg)',
                        border: `1px solid ${isActive ? 'rgba(16,185,129,0.4)' : 'var(--border-premium)'}`,
                        color: isActive ? 'var(--success)' : 'var(--text-muted)',
                        fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}
                >
                    {isActive ? <Check size={12} /> : <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '1.5px solid currentColor' }} />}
                    {isActive ? 'Active' : 'Set Active'}
                </button>
            )}

            {/* Genuine runtime errors only now (a real, configured connection
                attempt that failed) - unconfigured services never reach this
                path anymore, they open the setup modal instead. Fades in
                smoothly and sits inline below the row rather than the
                abrupt, sharply-appearing absolute overlay this used to be. */}
            {showError && error && (
                <div style={{
                    position: 'absolute', top: '110%', left: 0, zIndex: 20, width: '260px',
                    background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '10px',
                    padding: '10px 12px', fontSize: '11px', color: '#fecaca', boxShadow: '0 10px 24px rgba(0,0,0,0.4)',
                    animation: 'nexusFadeInDown 0.25s ease',
                }}>
                    {error}
                </div>
            )}
        </div>
    );
};

// Graceful "not configured yet" state - replaces what used to be an abrupt
// error box popping up the moment someone clicked an unconfigured
// service's connect button. This is an expected, known state (most people
// trying this app won't have their own Spotify/Apple Music credentials set
// up), not a failure, so it's presented as plain information rather than
// an error: what's needed, and exactly where to put it.
const STREAMING_SETUP_INFO = {
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
};

const StreamingSetupModal = ({ service, onClose }) => {
    const info = STREAMING_SETUP_INFO[service];
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
            onClick={onClose}
        >
            <div
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '24px', padding: '28px', width: '100%', maxWidth: '420px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{info.title}</h3>
                    <button onClick={onClose} title="Close" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                        <X size={18} />
                    </button>
                </div>
                <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {info.steps.map((step, i) => (
                        <li key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{step}</li>
                    ))}
                </ol>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Once saved, this button will connect for real - nothing else about the app needs to change.</span>
            </div>
        </div>
    );
};

const LibraryTab = React.memo(({ favoritePlaylistIds, toggleFavoritePlaylist, queuePlaylistTracks, playTrackNow, recentlyPlayed, currentTrack, isPlaying, togglePlay }) => {
    const isMobile = useIsMobile();
    const [openPlaylist, setOpenPlaylist] = useState(null);
    const {
        spotifyAuth, connectSpotify, disconnectSpotify,
        appleMusicAuth, connectAppleMusic, disconnectAppleMusic,
        activeSource, setActiveSource,
        isSpotifyConfigured, isAppleMusicConfigured,
    } = useStreaming();
    const [connectingService, setConnectingService] = useState(null); // null | 'apple' | 'spotify'
    const [setupModalService, setSetupModalService] = useState(null); // null | 'apple' | 'spotify'

    const handleConnectApple = async () => {
        setConnectingService('apple');
        try { await connectAppleMusic(); } finally { setConnectingService(null); }
    };
    // Spotify's connect performs a full-page redirect (window.location.assign),
    // so this component unmounts before connectingService would ever get
    // reset back to null - no finally-block cleanup needed the way Apple's
    // in-page popup flow needs above.
    const handleConnectSpotify = () => {
        setConnectingService('spotify');
        connectSpotify();
    };

    const handlePlayTrack = (track) => playTrackNow(track.title, track.url);
    const handleShufflePlay = (playlist) => queuePlaylistTracks(playlist.trackRefs(), { shuffle: true });
    const handleQueueAll = (tracks) => queuePlaylistTracks(tracks, { shuffle: false });

    if (openPlaylist) {
        return (
            <PlaylistDetailView
                playlist={openPlaylist}
                onBack={() => setOpenPlaylist(null)}
                onPlayTrack={handlePlayTrack}
                onShufflePlay={handleShufflePlay}
                onQueueAll={handleQueueAll}
            />
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* Header row: label + the two streaming connect buttons. On
                mobile this stacks into its own column with the buttons
                sharing one full-width row (flex:1 each in
                StreamingServiceControl) instead of the old flexWrap:'wrap'
                layout, which let a fixed 176px minWidth on each button
                force them onto separate stacked lines the moment both
                didn't fit beside the "Playlists & Albums" label. */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '12px' : '16px', minHeight: isMobile ? 'auto' : '40px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-secondary)', margin: 0 }}>Playlists & Albums</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '14px', flexWrap: 'nowrap', width: isMobile ? '100%' : 'auto' }}>
                    <StreamingServiceControl
                        label="Apple Music"
                        icon={<Apple size={15} />}
                        brandGradient="linear-gradient(135deg, #FA233B, #FB5C74)"
                        brandGlowColor="rgba(250, 35, 59, 0.45)"
                        connected={appleMusicAuth.connected}
                        connecting={connectingService === 'apple'}
                        error={appleMusicAuth.error}
                        configured={isAppleMusicConfigured}
                        onConnect={handleConnectApple}
                        onDisconnect={disconnectAppleMusic}
                        onNeedsSetup={() => setSetupModalService('apple')}
                        isActive={activeSource === 'apple'}
                        onSetActive={(explicit) => setActiveSource(explicit || 'apple')}
                        isMobile={isMobile}
                    />
                    <StreamingServiceControl
                        label="Spotify"
                        icon={<Disc size={15} />}
                        brandGradient="linear-gradient(135deg, #1DB954, #1ed760)"
                        brandGlowColor="rgba(29, 185, 84, 0.5)"
                        connected={spotifyAuth.connected}
                        connecting={connectingService === 'spotify'}
                        error={spotifyAuth.error}
                        configured={isSpotifyConfigured}
                        onConnect={handleConnectSpotify}
                        onDisconnect={disconnectSpotify}
                        onNeedsSetup={() => setSetupModalService('spotify')}
                        isActive={activeSource === 'spotify'}
                        onSetActive={(explicit) => setActiveSource(explicit || 'spotify')}
                        isMobile={isMobile}
                    />
                </div>
            </div>
            <style>{`
                @keyframes nexusSpin { to { transform: rotate(360deg); } } .nexus-spin { animation: nexusSpin 0.8s linear infinite; }
                @keyframes nexusFadeInDown { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
            {setupModalService && (
                <StreamingSetupModal service={setupModalService} onClose={() => setSetupModalService(null)} />
            )}
            {/* Always a horizontally-scrolling row, on both mobile and
                desktop now - the exact same layout (and the exact same
                132px card via PlaylistCard's own flex-basis) as Recently
                Played / Quick Mix below it, matching a real Spotify/Apple
                Music app's own playlist carousels rather than a wrapping
                grid that made this row look like a different, disconnected
                section. */}
            <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', overflowY: 'hidden', padding: '4px 4px 14px 4px', WebkitOverflowScrolling: 'touch' }}>
                {AUDIO_LIBRARY.map((playlist) => (
                    <PlaylistCard
                        key={playlist.id}
                        playlist={playlist}
                        isFavorite={favoritePlaylistIds.has(playlist.id)}
                        onOpen={setOpenPlaylist}
                        onToggleFavorite={toggleFavoritePlaylist}
                        onShufflePlay={handleShufflePlay}
                    />
                ))}
            </div>

            {recentlyPlayed.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-secondary)', margin: 0 }}>Recently Played / Quick Mix</h3>
                    {/* Small padding on the scroll track itself (not just
                        gap between cards) so hover borders and shadows have
                        breathing room and never look clipped flush against
                        the container edge. */}
                    <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', overflowY: 'hidden', padding: '4px 4px 14px 4px' }}>
                        {recentlyPlayed.map((t, i) => {
                            const isThisTrackActive = currentTrack && currentTrack.title === t.title && currentTrack.url === t.url;
                            const isThisTrackPlaying = isThisTrackActive && isPlaying;
                            return (
                                <div
                                    key={t.title + i}
                                    onClick={() => playTrackNow(t.title, t.url)}
                                    title={`Play ${t.title}`}
                                    style={{
                                        // Fixed flex-basis (not shrink/grow) plus an explicit
                                        // matching width below on the artwork square, so every
                                        // card always renders at its full intended size inside
                                        // the scroll row - nothing gets squeezed or cut off.
                                        flex: '0 0 132px', display: 'flex', flexDirection: 'column', gap: '10px',
                                        cursor: 'pointer', background: 'var(--bg-surface)',
                                        border: `1px solid ${isThisTrackActive ? 'var(--primary)' : 'var(--border-premium)'}`,
                                        borderRadius: '16px', padding: '10px', transition: 'border-color 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => { if (!isThisTrackActive) e.currentTarget.style.borderColor = 'var(--primary)'; }}
                                    onMouseLeave={(e) => { if (!isThisTrackActive) e.currentTarget.style.borderColor = 'var(--border-premium)'; }}
                                >
                                    <div style={{ position: 'relative', width: '112px', height: '112px', borderRadius: '12px', background: gradientForId(t.title), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isThisTrackActive) {
                                                    togglePlay();
                                                } else {
                                                    playTrackNow(t.title, t.url);
                                                }
                                            }}
                                            title={isThisTrackPlaying ? `Pause ${t.title}` : `Play ${t.title}`}
                                            style={{
                                                background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.9)',
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: '100%', height: '100%', padding: 0,
                                            }}
                                        >
                                            {isThisTrackPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                                        </button>
                                    </div>
                                    <span style={{ fontSize: '12px', fontWeight: '700', color: isThisTrackActive ? 'var(--primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 1px' }}>
                                        {shortTitle(t.title)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
});

const GlobalSearchTab = React.memo(({ playlist: queue, playTrackNow }) => {
    const [query, setQuery] = useState('');
    const allTracks = useMemo(getAllLibraryTracks, []);

    const results = useMemo(() => {
        if (!query.trim()) return [];
        const q = query.toLowerCase();
        const fromLibrary = allTracks.filter((t) => t.title.toLowerCase().includes(q) || (t.artist || '').toLowerCase().includes(q));
        const fromQueue = queue.filter((t) => t.title.toLowerCase().includes(q));
        // De-duplicate by title so a track already in the queue doesn't
        // also show as a separate library result for the same title.
        const seen = new Set();
        return [...fromLibrary, ...fromQueue].filter((t) => {
            if (seen.has(t.title)) return false;
            seen.add(t.title);
            return true;
        });
    }, [query, allTracks, queue]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--widget-bg)', padding: '12px 16px', borderRadius: '14px', border: '1px solid var(--border-premium)' }}>
                <Search size={16} color="var(--text-muted)" />
                <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search all tracks and playlists"
                    placeholder="Search all tracks and playlists..."
                    style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                />
                {query && <button onClick={() => setQuery('')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>}
            </div>
            {!query.trim() && (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                    Search across your library, playlists, and current queue.
                </p>
            )}
            {query.trim() && results.length === 0 && (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No tracks match "{query}".</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {results.map((t) => (
                    <div
                        key={t.id}
                        onClick={() => playTrackNow(t.title, t.url)}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', cursor: 'pointer' }}
                    >
                        <Radio size={14} color="var(--accent)" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                            {t.artist && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.artist}</div>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});

const AmbientTab = React.memo(({ currentTrack, isPlaying, playPreset }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {AMBIENT_PRESETS.map((preset) => {
                const Icon = preset.icon;
                const isActivePreset = currentTrack.title === preset.title && isPlaying;
                return (
                    <button
                        key={preset.title}
                        onClick={() => playPreset(preset.title, getSynthPresetUrl(preset.profileKey))}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '10px 16px', borderRadius: '14px',
                            background: isActivePreset ? 'var(--primary)' : 'var(--widget-bg)',
                            border: `1px solid ${isActivePreset ? 'var(--primary)' : 'var(--border-premium)'}`,
                            color: isActivePreset ? '#fff' : 'var(--text-primary)',
                            fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                            transition: 'background 0.2s ease, border-color 0.2s ease',
                        }}
                    >
                        <Icon size={16} />
                        {preset.title}
                    </button>
                );
            })}
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
            Click a preset to start it instantly, or click again to pause. Presets join your playback queue below, so they can mix alongside music tracks.
        </p>
    </div>
));

const LocalFilesTab = React.memo(({ addSong, cloudUploadStatus, playlist }) => {
    const [isDragActive, setIsDragActive] = useState(false);
    const [importMessage, setImportMessage] = useState('');
    const fileInputRef = useRef(null);
    const importMessageTimeoutRef = useRef(null);
    const dragCounterRef = useRef(0);

    useEffect(() => {
        return () => {
            if (importMessageTimeoutRef.current) clearTimeout(importMessageTimeoutRef.current);
        };
    }, []);

    const showImportMessage = (msg) => {
        setImportMessage(msg);
        if (importMessageTimeoutRef.current) clearTimeout(importMessageTimeoutRef.current);
        importMessageTimeoutRef.current = setTimeout(() => setImportMessage(''), 3500);
    };

    const importFiles = (fileList) => {
        const files = Array.from(fileList || []);
        if (files.length === 0) return;
        let added = 0, skipped = 0;
        files.forEach((file) => {
            if (isSupportedAudioFile(file)) {
                addSong(deriveTitle(file.name), file);
                added += 1;
            } else {
                skipped += 1;
            }
        });
        if (added && skipped) showImportMessage(`Added ${added} track${added > 1 ? 's' : ''}, skipped ${skipped} unsupported file${skipped > 1 ? 's' : ''}.`);
        else if (added) showImportMessage(`Added ${added} track${added > 1 ? 's' : ''} to the queue.`);
        else showImportMessage('No supported audio files found in that selection.');
    };

    const handleDrop = (e) => {
        e.preventDefault(); e.stopPropagation();
        dragCounterRef.current = 0;
        setIsDragActive(false);
        importFiles(e.dataTransfer.files);
    };
    const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); dragCounterRef.current += 1; setIsDragActive(true); };
    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
    const handleDragLeave = (e) => {
        e.preventDefault(); e.stopPropagation();
        dragCounterRef.current -= 1;
        if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setIsDragActive(false); }
    };
    const handleFileInputChange = (e) => { importFiles(e.target.files); e.target.value = ''; };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', boxSizing: 'border-box' }}>
            <input ref={fileInputRef} type="file" accept=".mp3,.wav,.m4a,.flac,.aac,.ogg,audio/*" multiple onChange={handleFileInputChange} aria-label="Upload audio files" style={{ display: 'none' }} />
            <div
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                onDrop={handleDrop} onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                role="button" tabIndex={0}
                style={{
                    border: `2px dashed ${isDragActive ? 'var(--primary)' : 'var(--border-premium)'}`,
                    borderRadius: '16px', padding: '36px 20px', maxWidth: '520px', margin: '0 auto', width: '100%', boxSizing: 'border-box',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                    cursor: 'pointer', background: isDragActive ? 'var(--primary-muted)' : 'var(--widget-bg)',
                    transition: 'background 0.2s ease, border-color 0.2s ease', textAlign: 'center',
                }}
            >
                <UploadCloud size={32} color={isDragActive ? 'var(--primary)' : 'var(--text-muted)'} />
                <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{isDragActive ? 'Drop to add to your queue' : 'Drag & drop audio files here'}</strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>or click to browse your device</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', marginTop: '4px', letterSpacing: '0.3px' }}>MP3 · WAV · M4A · FLAC · AAC · OGG</span>
            </div>
            {importMessage && <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '600', textAlign: 'center' }}>{importMessage}</div>}

            {/* Real Cloud Sync Status - live per-track upload progress,
                success, and error feedback. Driven directly by the real
                cloudUploadStatus state AudioPlayerContext's own addSong
                maintains during a real Firebase Storage upload - not a
                simulated/decorative progress bar. */}
            {cloudUploadStatus && Object.keys(cloudUploadStatus).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '520px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
                    {Object.entries(cloudUploadStatus).map(([trackId, status]) => {
                        const track = playlist.find((t) => t.id === trackId);
                        const label = track ? track.title : 'Track';
                        return (
                            <div key={trackId} style={{ background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(20px)', border: '1px solid var(--border-premium)', borderRadius: '12px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{label}</span>
                                    {status.status === 'uploading' && <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '700', flexShrink: 0 }}>{status.progress}%</span>}
                                    {status.status === 'success' && <span style={{ fontSize: '11px', color: '#10B981', fontWeight: '700', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={13} /> Synced to cloud</span>}
                                    {status.status === 'error' && <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: '700', flexShrink: 0 }}>Sync failed</span>}
                                </div>
                                {status.status === 'uploading' && (
                                    <div style={{ width: '100%', height: '5px', background: 'var(--surface-inset)', borderRadius: '10px', overflow: 'hidden' }}>
                                        <div style={{ width: `${status.progress}%`, height: '100%', background: 'var(--accent)', borderRadius: '10px', transition: 'width 0.2s ease' }} />
                                    </div>
                                )}
                                {status.status === 'error' && status.error && (
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{status.error} (the track is still saved locally and fully playable.)</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
                Imported tracks stay in your queue permanently - across pages and reloads - until you delete them.
            </p>
        </div>
    );
});

const QueueManager = React.memo(({ playlist, currentSongIndex, isPlaying, togglePlay, playAt, deleteSong, moveSong, favoriteTrackTitles, toggleFavoriteTrack, durationsByUrl }) => {
    const [search, setSearch] = useState('');
    const filtered = useMemo(
        () => playlist.map((song, idx) => ({ song, idx })).filter(({ song }) => song.title.toLowerCase().includes(search.toLowerCase())),
        [playlist, search]
    );

    return (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '24px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', boxSizing: 'border-box' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Music size={18} color="var(--accent)" /> Playback Queue ({playlist.length})
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--widget-bg)', padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-premium)' }}>
                <Search size={14} color="var(--text-muted)" />
                <input
                    type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search your queue"
                    placeholder="Search your queue..."
                    style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                />
                {search && <button onClick={() => setSearch('')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', padding: 0 }}>✕</button>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto', willChange: 'scroll-position' }}>
                {playlist.length === 0 && <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Your queue is empty. Add tracks from Library, Search, Ambient Focus, or Local Files.</div>}
                {playlist.length > 0 && filtered.length === 0 && <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No tracks match "{search}".</div>}
                {filtered.map(({ song, idx }) => {
                    const isFav = favoriteTrackTitles.has(song.title);
                    const isActive = idx === currentSongIndex;
                    const knownDuration = durationsByUrl[song.url];
                    return (
                        <div key={song.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: isActive ? 'var(--primary-muted)' : 'var(--widget-bg)', borderRadius: '12px', border: '1px solid var(--border-premium)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                                <button onClick={() => toggleFavoriteTrack(song.title)} title={isFav ? 'Unfavorite' : 'Favorite'} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', flexShrink: 0 }}>
                                    <Heart size={14} color={isFav ? '#F43F5E' : 'var(--text-muted)'} fill={isFav ? '#F43F5E' : 'none'} />
                                </button>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', flexShrink: 0 }}>#{idx + 1}</span>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: isActive ? 'var(--primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: '1 1 auto', minWidth: 0 }}>{song.title}</span>
                                {/* Honest source badge - this used to hardcode
                                    "Apple Music" for every non-local track,
                                    which was simply wrong for the mock
                                    library/ambient/search tracks that make
                                    up the overwhelming majority of the
                                    queue (genuine Apple Music playback only
                                    happens once that streaming source is
                                    actually connected and active). */}
                                <span style={{ fontSize: '9px', color: 'var(--text-muted)', border: '1px solid var(--border-premium)', borderRadius: '4px', padding: '1px 5px', flexShrink: 0, fontWeight: '700' }}>{song.isLocal ? 'LOCAL' : 'NEXUS'}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{knownDuration !== undefined ? (knownDuration > 0 ? formatTime(knownDuration) : '--:--') : '...'}</span>
                                {isActive && isPlaying && <EqualizerBars isPlaying size="small" />}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                <button onClick={() => moveSong(idx, 'up')} title="Move Up" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}><ArrowUp size={14} /></button>
                                <button onClick={() => moveSong(idx, 'down')} title="Move Down" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}><ArrowDown size={14} /></button>
                                <button onClick={() => (idx === currentSongIndex ? togglePlay() : playAt(idx))} style={{ padding: '4px 10px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                                    {idx === currentSongIndex && isPlaying ? 'Pause' : 'Play'}
                                </button>
                                <button onClick={() => deleteSong(song.id)} title="Delete Track" style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}><Trash2 size={14} /></button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

// Compact, persistent mini-player - the actual replacement for the old,
// oversized "Now Playing" hero that used to sit at the very top of the
// page (a 220px circular disc + full transport on mobile, an equally
// large horizontal console on desktop), pushing every real browsing
// surface (playlists, recently played, queue) below the fold before a
// user could even see them. A real streaming app's own main view is
// almost entirely the browsing surface; "what's playing" lives in one
// slim, always-visible bar pinned to the edge of the screen instead -
// this is that bar. flexShrink: 0 keeps it from ever being compressed by
// the scrollable content above it in the page's own flex column.
const MiniPlayerBar = ({
    currentTrack, isPlaying, togglePlay, next, prev, isMobile,
    favoriteTrackTitles, toggleFavoriteTrack, volume, isMuted, toggleMute, setVolume,
    currentTime, duration, seek,
}) => {
    const isFav = favoriteTrackTitles.has(currentTrack.title);
    const safeDuration = duration && isFinite(duration) ? duration : 0;
    const clampedTime = Math.min(currentTime, safeDuration);
    const progressPct = safeDuration > 0 ? (clampedTime / safeDuration) * 100 : 0;

    return (
        <div style={{
            flexShrink: 0, display: 'flex', flexDirection: 'column',
            // A real Spotify-style mini-player is always fully opaque - a
            // dedicated --player-bar-bg token (see variables.css) instead
            // of --bg-surface, since --bg-surface is exactly what the
            // Dynamic theme's own automatic glass/blur CSS selectors match
            // on. Using it here was the actual cause of this bar picking
            // up unwanted transparency/blur "leaking" from that theme.
            background: 'var(--player-bar-bg)', borderTop: '1px solid var(--border-premium)',
            // overflow: hidden clips the scrubber below to this card's own
            // rounded top corners rather than letting its flat edges
            // overhang past the curve. position: relative is what scopes
            // the scrubber's position: absolute below to THIS card
            // specifically (top: 0/left: 0/right: 0 becomes relative to
            // this element's own border box, not the page or any other
            // ancestor) - so it is structurally impossible for it to
            // render anywhere but pinned to this exact card's top edge,
            // regardless of any spacing a parent layout might introduce
            // above this bar.
            borderRadius: '20px 20px 0 0', boxShadow: '0 -8px 24px rgba(0,0,0,0.18)', boxSizing: 'border-box',
            overflow: 'hidden', position: 'relative',
        }}>
            {/* Thin, custom-painted Spotify-style progress line, absolutely
                pinned to this card's own top edge (position: absolute;
                top: 0; left: 0; right: 0) instead of relying on normal
                document flow to keep it first - this removes it from flow
                entirely, so no sibling spacing/gap above this bar can ever
                push it out of place. The hit-area stays a taller 14px for
                a real touch/click target, matching the actual 3px painted
                line centered at its very top. A plain native
                <input type="range"> here would render with real,
                inconsistent browser chrome (padding, a permanently-visible
                thumb) at a much taller footprint than a real mini-player
                scrubber ever uses - this paints only the slim colored fill
                for the visual, while a fully transparent range input the
                same size still handles every real interaction (click-to-
                seek, drag, keyboard, a11y). */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '14px', zIndex: 2 }}>
                <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '3px', background: 'var(--border-premium)', overflow: 'hidden' }}>
                    <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--primary)' }} />
                </div>
                <input
                    type="range" min={0} max={safeDuration} step="0.1"
                    value={clampedTime}
                    onChange={(e) => seek(parseFloat(e.target.value))}
                    aria-label="Seek"
                    style={{
                        position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0,
                        opacity: 0, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none',
                    }}
                />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '14px', padding: isMobile ? '16px 14px 12px 14px' : '14px 20px 14px 20px' }}>
                <div style={{
                    width: isMobile ? '40px' : '46px', height: isMobile ? '40px' : '46px', borderRadius: '12px', background: 'var(--primary-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0,
                }}>
                    <Disc size={isMobile ? 20 : 22} />
                </div>

                {/* Title only, single-lined, bold - no artist/"Nexus Audio"
                    subtitle row underneath it anymore, per this request's
                    own explicit "keep the track title clean, bold, and
                    single-lined" ask. The equalizer bars alone already
                    signal live playback; a crossfade in progress no longer
                    gets its own text label here (it still genuinely
                    happens - this only removes the second text row that
                    announced it). */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: isMobile ? '14px' : '15px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.title}</span>
                    <EqualizerBars isPlaying={isPlaying} size="small" />
                </div>

                <button
                    onClick={() => toggleFavoriteTrack(currentTrack.title)}
                    title={isFav ? 'Unfavorite' : 'Favorite'}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexShrink: 0, padding: '4px' }}
                >
                    <Heart size={17} color={isFav ? '#F43F5E' : 'var(--text-muted)'} fill={isFav ? '#F43F5E' : 'none'} />
                </button>

                {/* Previous - now always shown (not desktop-only): a real
                    media player needs both skip directions available
                    regardless of viewport, matching Next right beside it. */}
                <button onClick={prev} title="Previous" style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', color: 'var(--text-primary)', borderRadius: '50%', width: isMobile ? '34px' : '36px', height: isMobile ? '34px' : '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <SkipBack size={14} />
                </button>
                <button
                    onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}
                    style={{
                        background: 'var(--primary)', border: 'none', color: '#fff', borderRadius: '50%',
                        width: isMobile ? '42px' : '44px', height: isMobile ? '42px' : '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', boxShadow: '0 4px 15px rgba(var(--primary-rgb), 0.3)', flexShrink: 0,
                    }}
                >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: '2px' }} />}
                </button>
                <button onClick={next} title="Next" style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', color: 'var(--text-primary)', borderRadius: '50%', width: isMobile ? '34px' : '36px', height: isMobile ? '34px' : '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <SkipForward size={14} />
                </button>

                {!isMobile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '6px', background: 'var(--bg-main)', padding: '7px 12px', borderRadius: '12px', border: '1px solid var(--border-premium)', flexShrink: 0 }}>
                        <button onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                        </button>
                        <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} aria-label="Volume" style={{ width: '80px', accentColor: 'var(--primary)' }} />
                    </div>
                )}
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const AudioHubPage = () => {
    const isMobile = useIsMobile();
    useEffect(() => {
        localStorage.setItem('nexus_current_route', 'audio_hub');
    }, []);

    const {
        playlist, currentSongIndex, currentTrack, isPlaying, volume, isMuted, currentTime, duration,
        favoritePlaylistIds, favoriteTrackTitles, shuffleEnabled, repeatMode, recentlyPlayed, durationsByUrl,
        setVolume, toggleMute, togglePlay, playAt, next, prev, addSong,
        addRemoteTrack, playTrackNow, queuePlaylistTracks, toggleFavoritePlaylist, toggleFavoriteTrack,
        toggleShuffle, cycleRepeatMode, playPreset, deleteSong, moveSong, seek, cloudUploadStatus,
    } = useAudioPlayer();

    const [subTab, setSubTab] = useState('library');

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', animation: 'fadeInScale 0.3s ease',
            width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box', minWidth: 0,
            // Bounded to the real, available viewport height (minus the
            // fixed chrome genuinely around this page - see AIPage.jsx's
            // own identical fix for the exact same reasoning) so the
            // MiniPlayerBar below can sit as a normal, non-fixed last
            // flex child that's always visible, with only the middle
            // browsing area scrolling internally - not position:fixed/
            // sticky, which would need to know the sidebar's own dynamic
            // width or risk clipping inside an overflow:hidden ancestor.
            height: isMobile ? 'calc(100vh - 152px - env(safe-area-inset-bottom, 0px))' : 'calc(100vh - 164px)',
        }}>

            {/* Compact top bar - just the section tabs now (the back arrow
                that used to sit before them jumped straight to Home,
                which doesn't fit this page's own streaming-app tab
                layout - every other hub page reaches Home via the
                sidebar/bottom-nav, not a page-local back button). */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0,
                borderBottom: isMobile ? 'none' : '1px solid var(--border-premium)', paddingBottom: '2px',
                flexWrap: isMobile ? 'nowrap' : 'wrap',
                overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch',
            }}>
                {/* Mobile: clean, rounded pill tabs (Apple Music/Spotify
                    style) in a horizontally-scrolling row instead of
                    wrapping onto multiple lines. Desktop keeps its
                    existing underline-tab treatment unchanged. */}
                {SUB_TABS.map((t) => {
                    const Icon = t.icon;
                    const active = subTab === t.id;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setSubTab(t.id)}
                            style={isMobile ? {
                                display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', flexShrink: 0,
                                background: active ? 'var(--primary)' : 'var(--widget-bg)',
                                border: `1px solid ${active ? 'var(--primary)' : 'var(--border-premium)'}`,
                                borderRadius: '20px',
                                color: active ? 'var(--text-on-primary)' : 'var(--text-secondary)', fontWeight: '700', fontSize: '12px', cursor: 'pointer',
                                marginBottom: '8px', whiteSpace: 'nowrap',
                            } : {
                                display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 16px',
                                background: 'transparent', border: 'none', borderBottom: `2px solid ${active ? 'var(--primary)' : 'transparent'}`,
                                color: active ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                            }}
                        >
                            <Icon size={15} /> {t.label}
                        </button>
                    );
                })}
            </div>
            {/* Scrollable browsing area - tab content + queue are the
                actual main surface of this page now (a real streaming
                app's own main view is almost entirely this), scrolling
                independently in the space between the tab row above and
                the pinned MiniPlayerBar below. flex: 1, minHeight: 0 is
                what makes that internal scroll genuinely bounded instead
                of growing the whole page - see AIPage.jsx's own identical
                fix for why minHeight: 0 is required at every level of a
                nested flex-column chain like this one. */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px' }}>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '24px', padding: '28px', minHeight: '200px', width: '100%', boxSizing: 'border-box', overflow: 'hidden', minWidth: 0, flexShrink: 0 }}>
                    {subTab === 'library' && (
                        <LibraryTab
                            favoritePlaylistIds={favoritePlaylistIds}
                            toggleFavoritePlaylist={toggleFavoritePlaylist}
                            queuePlaylistTracks={queuePlaylistTracks}
                            playTrackNow={playTrackNow}
                            recentlyPlayed={recentlyPlayed}
                            currentTrack={currentTrack}
                            isPlaying={isPlaying}
                            togglePlay={togglePlay}
                        />
                    )}
                    {subTab === 'search' && <GlobalSearchTab playlist={playlist} playTrackNow={playTrackNow} />}
                    {subTab === 'ambient' && <AmbientTab currentTrack={currentTrack} isPlaying={isPlaying} playPreset={playPreset} />}
                    {subTab === 'local' && <LocalFilesTab addSong={addSong} cloudUploadStatus={cloudUploadStatus} playlist={playlist} />}
                </div>

                {/* Queue - still visible regardless of active sub-tab, just
                    now part of the same internally-scrolling area instead
                    of pushing the whole page taller. */}
                <QueueManager
                    playlist={playlist} currentSongIndex={currentSongIndex} isPlaying={isPlaying}
                    togglePlay={togglePlay} playAt={playAt} deleteSong={deleteSong} moveSong={moveSong}
                    favoriteTrackTitles={favoriteTrackTitles} toggleFavoriteTrack={toggleFavoriteTrack}
                    durationsByUrl={durationsByUrl}
                />
            </div>

            <MiniPlayerBar
                currentTrack={currentTrack} isPlaying={isPlaying} togglePlay={togglePlay} next={next} prev={prev} isMobile={isMobile}
                favoriteTrackTitles={favoriteTrackTitles} toggleFavoriteTrack={toggleFavoriteTrack}
                volume={volume} isMuted={isMuted} toggleMute={toggleMute} setVolume={setVolume}
                currentTime={currentTime} duration={duration} seek={seek}
            />
        </div>
    );
};

export default AudioHubPage;
