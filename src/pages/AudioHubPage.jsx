// src/pages/AudioHubPage.jsx
//
// The Audio & Focus Hub: a persistent player console + reorderable queue at
// the top, with browsable sub-tabs beneath it (Library/Playlists, Global
// Search, Local Files - Ambient Focus was removed per explicit request).
// Structured so a real streaming API (e.g. Apple Music/MusicKit) can later
// replace src/data/audioLibraryMock.js's mock catalog and the search tab's
// local filtering with real endpoint calls, without this file's rendering
// or queueing logic needing to change - see the shape documentation at the
// top of audioLibraryMock.js for exactly what that swap would touch.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Play, Pause, Music, Trash2,
    Disc, ArrowUp, ArrowDown, UploadCloud,
    Search, Shuffle, Heart, ListMusic, X, ChevronLeft, Radio,
    Apple, Check, Loader2, Video, Music2, Pin, Mic2, Clock, Home, FolderOpen,
    Library, ChevronRight,
} from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext.jsx';
import { useStreaming } from '../context/StreamingContext.jsx';
import { searchSaavnSongs } from '../utils/saavnClient.js';
import { searchYoutubeTracks } from '../utils/youtubeMusicClient.js';
import { searchSpotifyTracks, searchManySpotifyTracks, getSpotifyPlaylists, getSpotifyPlaylistTracks, getSpotifyLikedSongs, getSpotifyNewReleases, getSpotifyAlbumTracks } from '../utils/spotifyClient.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { useResizableSidebar } from '../hooks/useResizableSidebar.js';
import { AUDIO_LIBRARY, getAllLibraryTracks } from '../data/audioLibraryMock.js';
import EqualizerBars from '../components/audio/EqualizerBars.jsx';
import AudioSidebar from '../components/audio/AudioSidebar.jsx';
import ProfileMenu from '../components/audio/ProfileMenu.jsx';
import StreamingSetupModal from '../components/audio/StreamingSetupModal.jsx';
import AudioSettingsView from '../components/audio/AudioSettingsView.jsx';

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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// Sized to exactly match the Recently Played / Quick Mix cards below it
// (same flex-basis, artwork square, padding, single-line title, no
// separate description row) - these used to be a visibly different, much
// larger card shape (160x212px vs Recently Played's 134x160px: 18px
// padding, a full aspect-ratio-square artwork, and a two-line title+
// description), which made the two rows look like they belonged to two
// different apps stacked on top of each other. The playlist's own
// description is still real and available - it's just shown on
// PlaylistDetailView once opened, not doubled up here too.
//
// Mobile gets its own, smaller size (96px vs desktop's 132px) - per
// explicit request, the desktop 132px card was cropping mid-card at
// mobile's own narrower width, leaving only ~2 full cards plus a chopped-
// off sliver of a 3rd. This isn't just a smaller version of the same
// card - the artwork/icon/button sizes below are proportionally reduced
// too so it stays a clean miniature, not the same card simply clipped
// tighter.
const PlaylistCard = React.memo(({ playlist, isFavorite, onOpen, onToggleFavorite, onShufflePlay, isMobile }) => {
    // No boxed card wrapper (no background/border/padding) - a plain
    // floating tile (artwork + title only), matching Apple Music's own
    // playlist tiles exactly, per explicit side-by-side comparison request:
    // the previous bordered card read as "cut/lined" next to Apple's clean,
    // borderless squares. Artwork now fills the tile's own full width
    // (no padding eating into it) rather than sitting smaller inside one.
    const tileWidth = isMobile ? 96 : 150;
    return (
    <div
        style={{
            flex: `0 0 ${tileWidth}px`, display: 'flex', flexDirection: 'column', gap: isMobile ? '6px' : '8px', cursor: 'pointer',
        }}
        onClick={() => onOpen(playlist)}
    >
        <div style={{ position: 'relative', width: `${tileWidth}px`, height: `${tileWidth}px`, borderRadius: '10px', overflow: 'hidden', background: gradientForId(playlist.id), flexShrink: 0, transition: 'transform 0.15s ease', boxShadow: '0 6px 18px rgba(0,0,0,0.22)' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Disc size={isMobile ? 22 : 32} color="rgba(255,255,255,0.85)" />
            </div>
            <button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(playlist.id); }}
                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                style={{
                    position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.55)',
                    border: 'none', borderRadius: '50%', width: isMobile ? '18px' : '24px', height: isMobile ? '18px' : '24px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer',
                }}
            >
                <Heart size={isMobile ? 9 : 12} color={isFavorite ? '#F43F5E' : '#fff'} fill={isFavorite ? '#F43F5E' : 'none'} />
            </button>
            {!isMobile && (
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
            )}
        </div>
        <span style={{ fontSize: isMobile ? '11px' : '12px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 1px' }} title={playlist.title}>
            {playlist.title}
        </span>
    </div>
    );
});

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

// Real card for a genuine Spotify playlist (id/name/images/track count) -
// separate from PlaylistCard above rather than reusing it, since that one
// assumes the demo catalog's own shape (a synchronous trackRefs()
// function, a stable numeric-ish id safe for gradientForId) which a real
// Spotify playlist doesn't have (its tracks are fetched lazily on open -
// see SpotifyPlaylistDetailView).
// isFavorite/onToggleFavorite added per a real, reported gap: "Pins" only
// ever pinned from the demo/mock catalog (AUDIO_LIBRARY) - once Spotify was
// connected, this card fully replaced those demo cards, but had no pin
// button of its own, so Pins became silently unreachable for any connected
// user ("PIN wala working hona chahiye"). Spotify's own client-local "Pin"
// feature has no public Web API - not honestly buildable as a real sync -
// so this is a real, working, app-local equivalent instead: the exact same
// favoritePlaylistIds mechanism the demo catalog already used, now
// available here too.
const SpotifyPlaylistCard = React.memo(({ playlist, isFavorite, onOpen, onToggleFavorite, isMobile }) => {
    const tileWidth = isMobile ? 96 : 150;
    return (
        <div style={{ flex: `0 0 ${tileWidth}px`, display: 'flex', flexDirection: 'column', gap: isMobile ? '6px' : '8px', cursor: 'pointer' }} onClick={() => onOpen(playlist)}>
            <div style={{
                position: 'relative', width: `${tileWidth}px`, height: `${tileWidth}px`, borderRadius: '10px', overflow: 'hidden', flexShrink: 0, boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
                // A real Spotify playlist without a cover image (some
                // genuinely have none - empty/auto-generated playlists,
                // confirmed via the live API response, not a bug this app
                // can fix by fabricating one) gets a plain, neutral dark
                // tile here instead of the demo catalog's own loud,
                // per-id-colored gradient - a real, reported "looks like a
                // mismatched mess" complaint when real cover photos and
                // fallback tiles sat side by side using two different
                // visual languages.
                background: playlist.artworkUrl ? 'transparent' : 'var(--widget-bg)',
            }}>
                {playlist.artworkUrl ? (
                    <img src={playlist.artworkUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Disc size={isMobile ? 22 : 32} color="var(--text-muted)" />
                    </div>
                )}
                {typeof onToggleFavorite === 'function' && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleFavorite(playlist.id); }}
                        title={isFavorite ? 'Unpin' : 'Pin'}
                        style={{
                            position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.55)',
                            border: 'none', borderRadius: '50%', width: isMobile ? '18px' : '24px', height: isMobile ? '18px' : '24px', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', cursor: 'pointer',
                        }}
                    >
                        <Heart size={isMobile ? 9 : 12} color={isFavorite ? '#F43F5E' : '#fff'} fill={isFavorite ? '#F43F5E' : 'none'} />
                    </button>
                )}
            </div>
            <span style={{ fontSize: isMobile ? '11px' : '12px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 1px' }} title={playlist.title}>{playlist.title}</span>
        </div>
    );
});

// Fisher-Yates - used only by PlaylistPlayButtons' Shuffle Play below, to
// send Spotify's device a genuinely randomized queue (not just a fake
// "shuffle" label on the same fixed order).
const shuffleArray = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

// Real "Play" / "Shuffle Play" row, matched against the Apple Music
// reference screenshots (a big Play pill + a separate round shuffle
// button, above the track list) - shared by every Spotify list/detail
// view below (Genre/Playlist/Album) rather than tripling the same JSX.
// Genuinely queues every track on Spotify's own device via
// spotifyPlayUri's queueUris arg (see StreamingContext.jsx) - this is
// what actually makes Next/Previous work afterward, not just a visual
// addition. Only rendered once there's a real device + tracks to queue;
// local-preview-only playback has no equivalent "hand the whole list to
// the device" concept to offer.
const PlaylistPlayButtons = ({ tracks, spotifyDeviceId, spotifyAuth, activeSource, setActiveSource, spotifyPlayUri }) => {
    // Capped at 100 - Spotify's own /player/play endpoint rejects a
    // longer `uris` array; most real playlists here are well under that,
    // but a genre search (up to 200) or a large real Spotify playlist
    // isn't guaranteed to be.
    const uris = useMemo(() => tracks.map((t) => t.uri).filter(Boolean).slice(0, 100), [tracks]);
    if (!spotifyDeviceId || !spotifyAuth.connected || uris.length === 0) return null;
    const start = (list) => {
        if (activeSource !== 'spotify') setActiveSource('spotify');
        spotifyPlayUri(list[0], list);
    };
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
                onClick={() => start(uris)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', borderRadius: '9999px', border: 'none', background: 'var(--primary)', color: 'var(--text-on-primary)', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}
            >
                <Play size={14} fill="currentColor" /> Play
            </button>
            <button
                onClick={() => start(shuffleArray(uris))}
                title="Shuffle Play" aria-label="Shuffle Play"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '50%', border: '1px solid var(--border-premium)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
                <Shuffle size={16} />
            </button>
        </div>
    );
};

// Real playlist detail view for a genuine Spotify playlist - fetches its
// actual tracks lazily (only once opened), and plays them through the
// exact same mechanism GlobalSearchTab's own Spotify results already use
// (full SDK playback if a device is ready, else the track's real 30s
// preview) rather than a second, parallel implementation.
const SpotifyPlaylistDetailView = React.memo(({ playlist, onBack, playTrackNow, spotifyAuth, spotifyDeviceId, spotifyPlayUri, activeSource, setActiveSource }) => {
    const [tracks, setTracks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        getSpotifyPlaylistTracks(spotifyAuth.accessToken, playlist.id)
            .then((results) => { if (!cancelled) setTracks(results); })
            .catch((err) => { if (!cancelled) setError(err.message || 'Could not load this playlist'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [playlist.id, spotifyAuth.accessToken]);

    // Real bug fixed: used to always start Spotify's device on JUST this
    // one track (no queue) - Next then genuinely had nothing to advance
    // to. Now hands the device the WHOLE playlist + which one to start
    // on, so tapping any row also queues everything after it.
    const handleTrackClick = (track) => {
        if (spotifyDeviceId && spotifyAuth.connected) {
            if (activeSource !== 'spotify') setActiveSource('spotify');
            spotifyPlayUri(track.uri, tracks.map((t) => t.uri).filter(Boolean).slice(0, 100));
        } else if (track.previewUrl) {
            playTrackNow(track.title, track.previewUrl);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <button onClick={onBack} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '10px', padding: '8px', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex' }}><ChevronLeft size={18} /></button>
                {playlist.artworkUrl ? (
                    <img src={playlist.artworkUrl} alt="" style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                    <div style={{ width: '64px', height: '64px', borderRadius: '12px', background: gradientForId(playlist.id), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Disc size={28} color="rgba(255,255,255,0.85)" />
                    </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{playlist.title}</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>{playlist.trackCount} tracks · Spotify</p>
                </div>
            </div>
            {!loading && !error && (
                <PlaylistPlayButtons tracks={tracks} spotifyDeviceId={spotifyDeviceId} spotifyAuth={spotifyAuth} activeSource={activeSource} setActiveSource={setActiveSource} spotifyPlayUri={spotifyPlayUri} />
            )}
            {loading && <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Loading tracks…</p>}
            {error && <p style={{ fontSize: '13px', color: '#fca5a5', textAlign: 'center', padding: '20px 0' }}>{error}</p>}
            {!loading && !error && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {tracks.map((t, i) => {
                        const playable = (spotifyDeviceId && spotifyAuth.connected) || t.previewUrl;
                        return (
                            <div key={t.id} onClick={() => playable && handleTrackClick(t)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', cursor: playable ? 'pointer' : 'default', opacity: playable ? 1 : 0.6 }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', width: '18px' }}>{i + 1}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.artist}</div>
                                </div>
                                {!playable && <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>No preview</span>}
                                <Play size={14} color="var(--text-muted)" />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
});

// Real, explicitly-requested "New Releases" detail view - a genuine
// Spotify album (via GET /v1/browse/new-releases), not a playlist. Reuses
// SpotifyPlaylistDetailView's exact same layout/interaction, just backed
// by getSpotifyAlbumTracks instead (an album's tracks endpoint has a
// slightly different response shape - see that function's own comment).
const AlbumDetailView = React.memo(({ album, onBack, playTrackNow, spotifyAuth, spotifyDeviceId, spotifyPlayUri, activeSource, setActiveSource }) => {
    const [tracks, setTracks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        getSpotifyAlbumTracks(spotifyAuth.accessToken, album.id, album.artworkUrl)
            .then((results) => { if (!cancelled) setTracks(results); })
            .catch((err) => { if (!cancelled) setError(err.message || 'Could not load this album'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [album.id, album.artworkUrl, spotifyAuth.accessToken]);

    // Same real fix as SpotifyPlaylistDetailView/GenreDetailView - queues
    // the whole album on Spotify's device instead of just one track.
    const handleTrackClick = (track) => {
        if (spotifyDeviceId && spotifyAuth.connected) {
            if (activeSource !== 'spotify') setActiveSource('spotify');
            spotifyPlayUri(track.uri, tracks.map((t) => t.uri).filter(Boolean).slice(0, 100));
        } else if (track.previewUrl) {
            playTrackNow(track.title, track.previewUrl);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <button onClick={onBack} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '10px', padding: '8px', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex' }}><ChevronLeft size={18} /></button>
                {album.artworkUrl ? (
                    <img src={album.artworkUrl} alt="" style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                    <div style={{ width: '64px', height: '64px', borderRadius: '12px', background: gradientForId(album.id), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Disc size={28} color="rgba(255,255,255,0.85)" />
                    </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{album.title}</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>{album.artist} · New Release</p>
                </div>
            </div>
            {!loading && !error && (
                <PlaylistPlayButtons tracks={tracks} spotifyDeviceId={spotifyDeviceId} spotifyAuth={spotifyAuth} activeSource={activeSource} setActiveSource={setActiveSource} spotifyPlayUri={spotifyPlayUri} />
            )}
            {loading && <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Loading tracks…</p>}
            {error && <p style={{ fontSize: '13px', color: '#fca5a5', textAlign: 'center', padding: '20px 0' }}>{error}</p>}
            {!loading && !error && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {tracks.map((t, i) => {
                        const playable = (spotifyDeviceId && spotifyAuth.connected) || t.previewUrl;
                        return (
                            <div key={t.id} onClick={() => playable && handleTrackClick(t)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', cursor: playable ? 'pointer' : 'default', opacity: playable ? 1 : 0.6 }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', width: '18px' }}>{i + 1}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.artist}</div>
                                </div>
                                {!playable && <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>No preview</span>}
                                <Play size={14} color="var(--text-muted)" />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
});

// Explicit request: Spotify's public Web API has no real endpoint for
// "user-created playlists that reliably contain a lot of tracks" - many
// real accounts (this user's included) have few or none, and even the
// ones that exist can 403 (Spotify-owned/editorial playlists, see
// describeSpotifyError's own note). Rather than a sparse or broken-looking
// "Playlists & Albums" row, this is a hand-curated set of genre/mood tiles
// - each one is just a real Spotify search query, run live (via the same
// searchSpotifyTracks already used everywhere else), so it always returns
// real, current tracks rather than a fixed list that goes stale. Genuinely
// "rotating over time" in the honest sense of this being a small, plain
// array a person (or a future scheduled task) can edit - not a fabricated
// auto-rotation mechanism this app doesn't have data to drive honestly.
const CURATED_GENRE_TILES = [
    { id: 'genre-punjabi', title: 'Punjabi Hits', query: 'Punjabi hits', gradient: 'linear-gradient(135deg, #F97316, #DC2626)' },
    { id: 'genre-bollywood', title: 'Bollywood', query: 'Bollywood top hits', gradient: 'linear-gradient(135deg, #DB2777, #7C3AED)' },
    { id: 'genre-hindi', title: 'Hindi Chill', query: 'Hindi chill songs', gradient: 'linear-gradient(135deg, #059669, #0D9488)' },
    { id: 'genre-gym', title: 'Gym Workout', query: 'gym workout motivation', gradient: 'linear-gradient(135deg, #EA580C, #B91C1C)' },
    { id: 'genre-lofi', title: 'Lofi Focus', query: 'lofi focus beats', gradient: 'linear-gradient(135deg, #4338CA, #6D28D9)' },
    { id: 'genre-party', title: 'Party Anthems', query: 'party anthems', gradient: 'linear-gradient(135deg, #DB2777, #F59E0B)' },
    { id: 'genre-romantic', title: 'Romantic', query: 'romantic hindi songs', gradient: 'linear-gradient(135deg, #E11D48, #DB2777)' },
    { id: 'genre-sleep', title: 'Sleep & Calm', query: 'calm sleep music', gradient: 'linear-gradient(135deg, #1E3A8A, #4C1D95)' },
    // Added per explicit request for more sections/variety once the
    // real-Spotify-playlists row (constantly 403ing) was removed entirely.
    { id: 'genre-trending', title: 'Trending Now', query: 'trending songs 2026', gradient: 'linear-gradient(135deg, #16A34A, #065F46)' },
    { id: 'genre-english', title: 'English Pop', query: 'English pop hits', gradient: 'linear-gradient(135deg, #2563EB, #0891B2)' },
    { id: 'genre-hiphop', title: 'Hip-Hop & Rap', query: 'hip hop rap hits', gradient: 'linear-gradient(135deg, #78350F, #B45309)' },
    { id: 'genre-retro', title: 'Old Is Gold', query: 'old Hindi classic songs', gradient: 'linear-gradient(135deg, #92400E, #7C2D12)' },
    { id: 'genre-devotional', title: 'Devotional', query: 'Hindi devotional bhajan', gradient: 'linear-gradient(135deg, #B45309, #C2410C)' },
    { id: 'genre-roadtrip', title: 'Road Trip', query: 'road trip driving songs', gradient: 'linear-gradient(135deg, #0EA5E9, #1D4ED8)' },
];

// Real, reported gap fixed ("daily refresh hona chahiye... refresh pe
// change hote rehna chahiye"): a plain live search returns the SAME
// Spotify-ranked top results every time it's run, since nothing about a
// bare query changes day to day - it LOOKED live but never actually
// varied. This derives a real, deterministic-per-day starting page (0-9,
// i.e. offset 0/20/40.../180) from the current date, so every open on the
// same day shows the same set (cacheable, not flickering per click) but a
// new day genuinely shows a different slice of Spotify's own results -
// real variety, not fabricated shuffling.
const dailyGenreOffset = () => {
    const dayIndex = Math.floor(Date.now() / 86400000);
    return (dayIndex % 10) * 20;
};

// Explicit request, styled directly against a real Spotify home-page
// screenshot: small rectangular "quick access" chips (a square swatch +
// title, side by side) in a WRAPPING GRID - not the big square tiles in a
// horizontal-scroll row this used to be. Real Spotify's own equivalent row
// (Liked Songs/Mega Punjabi Hits/etc.) is exactly this shape.
const GenreTileCard = React.memo(({ tile, isMobile, onOpen }) => (
    <div
        onClick={() => onOpen(tile)}
        style={{
            display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
            background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '8px',
            overflow: 'hidden', height: isMobile ? '52px' : '56px', transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface-hover, var(--widget-bg))'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--widget-bg)'; }}
    >
        <div style={{
            width: isMobile ? '52px' : '56px', height: '100%', flexShrink: 0,
            background: tile.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <Disc size={20} color="rgba(255,255,255,0.85)" />
        </div>
        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '12px' }}>{tile.title}</span>
    </div>
));

// Apple Music's own real "Browse Categories" tile shape (large, colorful,
// name pinned to the bottom-left corner over a full-bleed color) - used
// only by the Search tab's own Browse grid (GlobalSearchTab), a
// deliberately different visual weight from GenreTileCard's small
// "quick access" chip used on Home, matching each reference app's own
// actual layout for that specific section rather than reusing one shape
// everywhere.
const BrowseCategoryTile = React.memo(({ tile, onOpen }) => (
    <div
        onClick={() => onOpen(tile)}
        style={{
            position: 'relative', aspectRatio: '1 / 1', borderRadius: '12px', cursor: 'pointer',
            background: tile.gradient, overflow: 'hidden', boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
            transition: 'transform 0.15s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
        <Disc size={26} color="rgba(255,255,255,0.35)" style={{ position: 'absolute', top: '10px', right: '10px' }} />
        <span style={{ position: 'absolute', left: '12px', bottom: '12px', right: '12px', fontSize: '15px', fontWeight: '800', color: '#fff', textShadow: '0 2px 6px rgba(0,0,0,0.35)' }}>{tile.title}</span>
    </div>
));

// Detail view for one curated genre/mood tile - runs its query live
// against real Spotify search (not a stored track list) so it's never
// stale, using the exact same play mechanism (SDK if a device is ready,
// else the real 30s preview) every other Spotify surface in this file
// already uses.
const GenreDetailView = React.memo(({ tile, onBack, playTrackNow, spotifyAuth, spotifyDeviceId, spotifyPlayUri, activeSource, setActiveSource }) => {
    const [tracks, setTracks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        // Real fix for a real, reported gap: a single search call only
        // ever returned Spotify's own default page (~20 tracks, read as
        // "sirf 4-5 song aa raha hai" once filtered) - searchManySpotifyTracks
        // pages through real results up to a genuine 200-track target, and
        // dailyGenreOffset() makes which 200 change once a day for real
        // variety instead of the exact same set forever.
        searchManySpotifyTracks(spotifyAuth.accessToken, tile.query, { targetCount: 200, startOffset: dailyGenreOffset() })
            .then((results) => { if (!cancelled) setTracks(results); })
            .catch((err) => { if (!cancelled) setError(err.message || 'Could not load this genre'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [tile.query, spotifyAuth.accessToken]);

    // Same real fix as the other detail views - queues the rest of this
    // genre's tracks on Spotify's device instead of just the one clicked.
    // Spotify's own /player/play endpoint caps `uris` at 100 - this list
    // can run up to 200 (see searchManySpotifyTracks above), so it's
    // capped here too rather than sending a request Spotify would reject.
    const handleTrackClick = (track) => {
        if (spotifyDeviceId && spotifyAuth.connected) {
            if (activeSource !== 'spotify') setActiveSource('spotify');
            spotifyPlayUri(track.uri, tracks.map((t) => t.uri).filter(Boolean).slice(0, 100));
        } else if (track.previewUrl) {
            playTrackNow(track.title, track.previewUrl);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <button onClick={onBack} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '10px', padding: '8px', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex' }}><ChevronLeft size={18} /></button>
                <div style={{ width: '64px', height: '64px', borderRadius: '12px', background: tile.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Disc size={28} color="rgba(255,255,255,0.85)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tile.title}</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>Live Spotify search · {tracks.length || '…'} tracks</p>
                </div>
            </div>
            {!loading && !error && (
                <PlaylistPlayButtons tracks={tracks.slice(0, 100)} spotifyDeviceId={spotifyDeviceId} spotifyAuth={spotifyAuth} activeSource={activeSource} setActiveSource={setActiveSource} spotifyPlayUri={spotifyPlayUri} />
            )}
            {loading && <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Searching…</p>}
            {error && <p style={{ fontSize: '13px', color: '#fca5a5', textAlign: 'center', padding: '20px 0' }}>{error}</p>}
            {!loading && !error && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {tracks.map((t, i) => {
                        const playable = (spotifyDeviceId && spotifyAuth.connected) || t.previewUrl;
                        return (
                            <div key={t.id} onClick={() => playable && handleTrackClick(t)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', cursor: playable ? 'pointer' : 'default', opacity: playable ? 1 : 0.6 }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', width: '18px' }}>{i + 1}</span>
                                {t.artworkUrl ? (
                                    <img src={t.artworkUrl} alt="" style={{ width: '34px', height: '34px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                                ) : (
                                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: gradientForId(t.title), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Disc size={15} color="rgba(255,255,255,0.85)" />
                                    </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.artist}</div>
                                </div>
                                {!playable && <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>No preview</span>}
                                <Play size={14} color="var(--text-muted)" />
                            </div>
                        );
                    })}
                </div>
            )}
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
    // Saavn is the one service here that never becomes a real
    // activeSource (its tracks always play through the normal 'local'
    // <audio> pathway, see StreamingContext.jsx) - showing a "Set Active"
    // toggle that can't meaningfully do anything for it would be
    // misleading, so it opts out; every existing caller (Apple/Spotify/
    // YouTube) is unaffected by this defaulting to true.
    showActiveToggle = true,
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
                    // Connected state mirrors the AI chat header's own
                    // provider-connection styling (.ai-provider-pill-group
                    // .is-active in aiChat.css: rgba(16,185,129,0.12) fill,
                    // rgba(16,185,129,0.3) border, #10B981 text) - a clear,
                    // consistent "this is really connected" signal reused
                    // here rather than invented fresh for this button.
                    background: connected ? 'rgba(16,185,129,0.12)' : (configured ? brandGradient : 'var(--widget-bg)'),
                    border: `1px solid ${connected ? 'rgba(16,185,129,0.4)' : (configured ? 'transparent' : 'var(--border-premium)')}`,
                    color: connected ? 'var(--success)' : (configured ? '#fff' : 'var(--text-muted)'),
                    fontWeight: '700', fontSize: '13px', cursor: connecting ? 'wait' : 'pointer',
                    opacity: configured ? 1 : 0.75,
                    minWidth: isMobile ? 0 : '176px', width: isMobile ? '100%' : 'auto', flex: isMobile ? '1 1 0' : 'none',
                    justifyContent: 'center', boxSizing: 'border-box',
                    // Signature brand glow on hover, only while the button is
                    // actually its branded self (configured, not yet
                    // connected) - once connected it shows the green
                    // connected treatment above instead, so the glow only
                    // ever appears on the "come connect me" state it's meant
                    // to invite.
                    boxShadow: isHovered && configured && !connected ? `0 6px 24px ${brandGlowColor}` : 'none',
                    transform: isHovered && configured && !connected ? 'translateY(-1px)' : 'none',
                    transition: 'box-shadow 0.25s ease, transform 0.2s ease, background 0.25s ease, border-color 0.25s ease, color 0.25s ease',
                }}
            >
                {connecting ? <Loader2 size={15} className="nexus-spin" /> : icon}
                {connecting ? 'Connecting...' : connected ? `Connected ${label}` : `Connect ${label}`}
                {/* Pulsing dot - the same "this is genuinely live right now"
                    signal used throughout this app (the header's own
                    System Active badge), reused here rather than a new
                    visual language for the same concept. */}
                {connected && !connecting && (
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px var(--success)', flexShrink: 0, animation: 'nexusConnectedPulse 1.8s ease-in-out infinite' }} />
                )}
            </button>

            {/* Active-source toggle - only meaningful (and only shown) once
                actually connected. Clicking it when already active hands
                playback back to the local library rather than leaving no
                way to turn a source "off". */}
            {connected && showActiveToggle && (
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

// Real, reported gap closed: the 4 streaming-service connect buttons used
// to sit inline in LibraryTab's own header row, right next to "Playlists &
// Albums" - a real, fair complaint that once 2+ were configured/connected
// (e.g. Spotify + YouTube) that row visibly cluttered/overlapped the
// page's own content. Moved into a real modal, opened from AudioSidebar's
// own footer (a "Connections" button) - genuinely self-contained (reads
// useStreaming() directly), so LibraryTab no longer needs to own any of
// this connection state/logic at all.
const ConnectionsPanel = React.memo(({ onClose }) => {
    const isMobile = useIsMobile();
    const {
        spotifyAuth, connectSpotify, disconnectSpotify,
        appleMusicAuth, connectAppleMusic, disconnectAppleMusic,
        youtubeAuth, connectYoutube, disconnectYoutube,
        saavnAuth, connectSaavn, disconnectSaavn,
        activeSource, setActiveSource,
        isSpotifyConfigured, isAppleMusicConfigured, isYoutubeConfigured, isSaavnConfigured,
    } = useStreaming();
    const [connectingService, setConnectingService] = useState(null);
    const [setupModalService, setSetupModalService] = useState(null);

    const handleConnectApple = async () => {
        setConnectingService('apple');
        try { await connectAppleMusic(); } finally { setConnectingService(null); }
    };
    const handleConnectSpotify = () => {
        setConnectingService('spotify');
        connectSpotify();
    };
    const handleConnectYoutube = () => connectYoutube();
    const handleConnectSaavn = () => connectSaavn();

    const anyConfigured = isAppleMusicConfigured || isSpotifyConfigured || isYoutubeConfigured || isSaavnConfigured;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }} onClick={onClose}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '380px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Connections</h3>
                    <button onClick={onClose} title="Close" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}><X size={18} /></button>
                </div>
                {!anyConfigured && (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>No music service is configured yet - add a Spotify/Apple Music/YouTube credential in Settings &gt; API Integrations to connect one.</p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {isAppleMusicConfigured && (
                        <StreamingServiceControl
                            label="Apple Music" icon={<Apple size={15} />}
                            brandGradient="linear-gradient(135deg, #FA233B, #FB5C74)" brandGlowColor="rgba(250, 35, 59, 0.45)"
                            connected={appleMusicAuth.connected} connecting={connectingService === 'apple'} error={appleMusicAuth.error} configured={isAppleMusicConfigured}
                            onConnect={handleConnectApple} onDisconnect={disconnectAppleMusic} onNeedsSetup={() => setSetupModalService('apple')}
                            isActive={activeSource === 'apple'} onSetActive={(explicit) => setActiveSource(explicit || 'apple')} isMobile={isMobile}
                        />
                    )}
                    {isSpotifyConfigured && (
                        <StreamingServiceControl
                            label="Spotify" icon={<Disc size={15} />}
                            brandGradient="linear-gradient(135deg, #1DB954, #1ed760)" brandGlowColor="rgba(29, 185, 84, 0.5)"
                            connected={spotifyAuth.connected} connecting={connectingService === 'spotify'} error={spotifyAuth.error} configured={isSpotifyConfigured}
                            onConnect={handleConnectSpotify} onDisconnect={disconnectSpotify} onNeedsSetup={() => setSetupModalService('spotify')}
                            isActive={activeSource === 'spotify'} onSetActive={(explicit) => setActiveSource(explicit || 'spotify')} isMobile={isMobile}
                        />
                    )}
                    {isYoutubeConfigured && (
                        <StreamingServiceControl
                            label="YouTube" icon={<Video size={15} />}
                            brandGradient="linear-gradient(135deg, #FF0000, #FF4E45)" brandGlowColor="rgba(255, 0, 0, 0.45)"
                            connected={youtubeAuth.connected} connecting={connectingService === 'youtube'} error={youtubeAuth.error} configured={isYoutubeConfigured}
                            onConnect={handleConnectYoutube} onDisconnect={disconnectYoutube} onNeedsSetup={() => setSetupModalService('youtube')}
                            isActive={activeSource === 'youtube'} onSetActive={(explicit) => setActiveSource(explicit || 'youtube')} isMobile={isMobile}
                        />
                    )}
                    {isSaavnConfigured && (
                        <StreamingServiceControl
                            label="Saavn" icon={<Music2 size={15} />}
                            brandGradient="linear-gradient(135deg, #2BC5B4, #0DB4B9)" brandGlowColor="rgba(43, 197, 180, 0.45)"
                            connected={saavnAuth.connected} connecting={false} error={saavnAuth.error} configured={isSaavnConfigured}
                            onConnect={handleConnectSaavn} onDisconnect={disconnectSaavn} onNeedsSetup={() => setSetupModalService('saavn')}
                            isActive={false} onSetActive={() => {}} showActiveToggle={false} isMobile={isMobile}
                        />
                    )}
                </div>
                <style>{`
                    @keyframes nexusSpin { to { transform: rotate(360deg); } } .nexus-spin { animation: nexusSpin 0.8s linear infinite; }
                    @keyframes nexusFadeInDown { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
                    @keyframes nexusConnectedPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
                `}</style>
                {setupModalService && (
                    <StreamingSetupModal service={setupModalService} onClose={() => setSetupModalService(null)} />
                )}
            </div>
        </div>
    );
});

// Real, reported gap fixed: "Playlists & Albums" (real Spotify playlists
// via SpotifyPlaylistCard, or the demo catalog when not connected) was
// removed ENTIRELY - explicit user feedback that it was constantly 403ing
// on this account (Spotify-owned/editorial playlists the account follows -
// see describeSpotifyError's own note - not something this app can fix,
// since it's Spotify's own permission model) and the demo cards behind it
// were fake data nobody wanted either. "Genres & Moods" (a real, live
// Spotify search per tile - see CURATED_GENRE_TILES) is now the ONLY
// browsing entry point on this tab, moved to the top where Playlists &
// Albums used to be, with more tiles added.
const LibraryTab = React.memo(({ playTrackNow, recentlyPlayed, currentTrack, isPlaying, togglePlay }) => {
    const isMobile = useIsMobile();
    const [openGenre, setOpenGenre] = useState(null);
    const [openAlbum, setOpenAlbum] = useState(null);
    // Connection state/handlers for all 4 services moved into
    // ConnectionsPanel (opened from AudioSidebar's own footer) - this
    // component only still needs Spotify's own auth state, since Genres &
    // Moods needs a real connected account to search.
    const { spotifyAuth, activeSource, setActiveSource, spotifyDeviceId, spotifyPlayUri } = useStreaming();
    // Real seed for MoreLikeArtistRow below - the most recent Recently
    // Played entry that actually has a known artist (real user data,
    // nothing fabricated).
    const topArtist = useMemo(() => recentlyPlayed.find((t) => t.artist)?.artist || null, [recentlyPlayed]);

    if (openGenre) {
        return (
            <GenreDetailView
                tile={openGenre}
                onBack={() => setOpenGenre(null)}
                playTrackNow={playTrackNow}
                spotifyAuth={spotifyAuth} spotifyDeviceId={spotifyDeviceId} spotifyPlayUri={spotifyPlayUri}
                activeSource={activeSource} setActiveSource={setActiveSource}
            />
        );
    }

    if (openAlbum) {
        return (
            <AlbumDetailView
                album={openAlbum}
                onBack={() => setOpenAlbum(null)}
                playTrackNow={playTrackNow}
                spotifyAuth={spotifyAuth} spotifyDeviceId={spotifyDeviceId} spotifyPlayUri={spotifyPlayUri}
                activeSource={activeSource} setActiveSource={setActiveSource}
            />
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {spotifyAuth.connected ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-secondary)', margin: 0 }}>Genres & Moods</h3>
                    {/* Explicit request, matched directly against a real
                        Spotify home-page screenshot: a wrapping GRID of
                        small rectangular "quick access" chips (not a
                        horizontal-scroll row of big square tiles - the
                        curated rows further down keep that bigger-card
                        treatment instead). */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: isMobile ? '8px' : '10px' }}>
                        {CURATED_GENRE_TILES.map((tile) => (
                            <GenreTileCard key={tile.id} tile={tile} onOpen={setOpenGenre} isMobile={isMobile} />
                        ))}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '40px 20px', textAlign: 'center' }}>
                    <Disc size={26} color="var(--text-muted)" />
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Connect Spotify (Connections in the sidebar) to browse real Genres & Moods.</p>
                </div>
            )}

            {recentlyPlayed.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-secondary)', margin: 0 }}>Recently Played / Quick Mix</h3>
                    {/* Small padding on the scroll track itself (not just
                        gap between cards) so hover borders and shadows have
                        breathing room and never look clipped flush against
                        the container edge. */}
                    <div style={{ display: 'flex', gap: isMobile ? '10px' : '16px', overflowX: 'auto', overflowY: 'hidden', padding: '4px 4px 14px 4px' }}>
                        {recentlyPlayed.map((t, i) => {
                            const isThisTrackActive = currentTrack && currentTrack.title === t.title && (currentTrack.url === t.url || (t.uri && currentTrack.uri === t.uri));
                            const isThisTrackPlaying = isThisTrackActive && isPlaying;
                            // Real fix for the reported "Play पर click करो
                            // तो play नहीं हो रहा है" bug: a Spotify entry
                            // has no `url` (the SDK plays through its own
                            // engine, not a normal <audio src>), but DOES
                            // now carry a real `uri` (see
                            // AudioPlayerContext.jsx's effectiveCurrentTrack)
                            // that spotifyPlayUri can genuinely replay, once
                            // a Spotify device is ready. Only a track with
                            // neither (an older entry saved before this fix,
                            // or a YouTube entry) stays honestly non-playable
                            // from this list.
                            const canPlaySpotify = t.source === 'spotify' && !!t.uri && spotifyDeviceId && spotifyAuth.connected;
                            const playable = !!t.url || canPlaySpotify;
                            const doPlay = () => {
                                if (canPlaySpotify) {
                                    if (activeSource !== 'spotify') setActiveSource('spotify');
                                    spotifyPlayUri(t.uri);
                                } else if (t.url) {
                                    playTrackNow(t.title, t.url);
                                }
                            };
                            // Same borderless floating-tile treatment as
                            // PlaylistCard above (tileWidth matches its own
                            // sizing exactly) - no boxed card wrapper.
                            const tileWidth = isMobile ? 96 : 150;
                            return (
                                <div
                                    key={t.title + i}
                                    onClick={() => { if (playable) doPlay(); }}
                                    title={playable ? `Play ${t.title}` : `${t.title} - open Search to replay this ${SOURCE_BADGE_STYLE[t.source]?.label || t.source} track`}
                                    style={{
                                        flex: `0 0 ${tileWidth}px`, display: 'flex', flexDirection: 'column', gap: isMobile ? '6px' : '8px',
                                        cursor: playable ? 'pointer' : 'default', opacity: playable ? 1 : 0.6,
                                    }}
                                >
                                    <div style={{
                                        position: 'relative', width: `${tileWidth}px`, height: `${tileWidth}px`, borderRadius: '10px',
                                        background: t.artworkUrl ? `url(${t.artworkUrl}) center/cover` : gradientForId(t.title),
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        boxShadow: isThisTrackActive ? '0 0 0 2px var(--primary), 0 6px 18px rgba(0,0,0,0.22)' : '0 6px 18px rgba(0,0,0,0.22)',
                                    }}>
                                        {playable ? (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (isThisTrackActive) {
                                                        togglePlay();
                                                    } else {
                                                        doPlay();
                                                    }
                                                }}
                                                title={isThisTrackPlaying ? `Pause ${t.title}` : `Play ${t.title}`}
                                                style={{
                                                    background: t.artworkUrl ? 'rgba(0,0,0,0.28)' : 'transparent', border: 'none', color: 'rgba(255,255,255,0.9)',
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    width: '100%', height: '100%', padding: 0, borderRadius: '10px',
                                                }}
                                            >
                                                {isThisTrackPlaying ? <Pause size={isMobile ? 18 : 24} fill="currentColor" /> : <Play size={isMobile ? 18 : 24} fill="currentColor" />}
                                            </button>
                                        ) : (!t.artworkUrl && <Disc size={isMobile ? 18 : 24} color="rgba(255,255,255,0.85)" />)}
                                    </div>
                                    <span style={{ fontSize: isMobile ? '11px' : '12px', fontWeight: '700', color: isThisTrackActive ? 'var(--primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 1px' }}>
                                        {shortTitle(t.title)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Explicit request: "more like", "discover more from [artist]"
                - real Spotify/Apple Music home sections this app had none
                of. Built honestly: this app has no real recommendation
                engine or access to Spotify's own (largely deprecated for
                new apps) recommendation endpoints, so rather than fabricate
                a fake "for you" claim, this derives a REAL seed from the
                user's own actual Recently Played (the most recent track
                with a known artist) and runs a real, live Spotify search
                for that artist - genuinely reflects their own listening,
                not invented. */}
            {spotifyAuth.connected && topArtist && (
                <MoreLikeArtistRow
                    artistName={topArtist}
                    playTrackNow={playTrackNow}
                    spotifyAuth={spotifyAuth} spotifyDeviceId={spotifyDeviceId} spotifyPlayUri={spotifyPlayUri}
                    activeSource={activeSource} setActiveSource={setActiveSource}
                    isMobile={isMobile}
                    currentTrack={currentTrack} isPlaying={isPlaying} togglePlay={togglePlay}
                />
            )}

            {spotifyAuth.connected && (
                <NewReleasesRow spotifyAuth={spotifyAuth} onOpen={setOpenAlbum} isMobile={isMobile} />
            )}
        </div>
    );
});

// Real, honest "personalization" row: seeded from the most recent
// Recently Played track that has a known artist (real user data already
// in this app), running one live Spotify search for that artist - not a
// fabricated recommendation engine this app doesn't have. Same tile
// treatment as the Recently Played row just above, for visual consistency.
const MoreLikeArtistRow = React.memo(({ artistName, playTrackNow, spotifyAuth, spotifyDeviceId, spotifyPlayUri, activeSource, setActiveSource, isMobile, currentTrack, isPlaying, togglePlay }) => {
    const [tracks, setTracks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        searchSpotifyTracks(spotifyAuth.accessToken, artistName)
            .then((results) => { if (!cancelled) setTracks(results.filter((t) => t.artist?.toLowerCase().includes(artistName.toLowerCase())).slice(0, 12)); })
            .catch(() => { if (!cancelled) setTracks([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [artistName, spotifyAuth.accessToken]);

    const handleClick = (t) => {
        if (spotifyDeviceId && spotifyAuth.connected) {
            if (activeSource !== 'spotify') setActiveSource('spotify');
            spotifyPlayUri(t.uri);
        } else if (t.previewUrl) {
            playTrackNow(t.title, t.previewUrl);
        }
    };

    if (!loading && tracks.length === 0) return null;
    const tileWidth = isMobile ? 96 : 150;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-secondary)', margin: 0 }}>More Like {artistName}</h3>
            <div style={{ display: 'flex', gap: isMobile ? '10px' : '16px', overflowX: 'auto', overflowY: 'hidden', padding: '4px 4px 14px 4px' }}>
                {loading ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Searching…</p>
                ) : tracks.map((t) => {
                    const playable = (spotifyDeviceId && spotifyAuth.connected) || t.previewUrl;
                    // Real, reported gap fixed: these tiles had no visible
                    // Play/Pause affordance at all (unlike every other tile
                    // row in this file - Recently Played, Genre tiles) -
                    // "usme bhi play pause ka option nahi hai" - added the
                    // exact same hover/always-visible overlay button
                    // Recently Played's own tiles already use.
                    const isThisTrackActive = currentTrack && t.uri && currentTrack.uri === t.uri;
                    const isThisTrackPlaying = isThisTrackActive && isPlaying;
                    return (
                        <div key={t.id} title={playable ? `Play ${t.title}` : `${t.title} - no preview available`} style={{ flex: `0 0 ${tileWidth}px`, display: 'flex', flexDirection: 'column', gap: isMobile ? '6px' : '8px' }}>
                            <div style={{
                                position: 'relative', width: `${tileWidth}px`, height: `${tileWidth}px`, borderRadius: '10px',
                                background: t.artworkUrl ? `url(${t.artworkUrl}) center/cover` : gradientForId(t.title),
                                boxShadow: isThisTrackActive ? '0 0 0 2px var(--primary), 0 6px 18px rgba(0,0,0,0.22)' : '0 6px 18px rgba(0,0,0,0.22)',
                            }}>
                                {playable && (
                                    <button
                                        type="button"
                                        onClick={() => { if (isThisTrackActive && togglePlay) { togglePlay(); } else { handleClick(t); } }}
                                        title={isThisTrackPlaying ? `Pause ${t.title}` : `Play ${t.title}`}
                                        style={{
                                            position: 'absolute', inset: 0, background: t.artworkUrl ? 'rgba(0,0,0,0.28)' : 'transparent',
                                            border: 'none', color: 'rgba(255,255,255,0.9)', cursor: 'pointer', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: 0, borderRadius: '10px',
                                        }}
                                    >
                                        {isThisTrackPlaying ? <Pause size={isMobile ? 18 : 24} fill="currentColor" /> : <Play size={isMobile ? 18 : 24} fill="currentColor" />}
                                    </button>
                                )}
                            </div>
                            <span style={{ fontSize: isMobile ? '11px' : '12px', fontWeight: '700', color: isThisTrackActive ? 'var(--primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 1px' }}>{shortTitle(t.title)}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

// Real, explicitly-requested "New Releases" row - genuine Spotify albums
// via GET /v1/browse/new-releases (see spotifyClient.js's own comment: a
// plain, non-personalized catalog-browse endpoint, not one of the largely-
// restricted recommendation endpoints), fetched once per Home visit.
const NewReleasesRow = React.memo(({ spotifyAuth, onOpen, isMobile }) => {
    const [albums, setAlbums] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        getSpotifyNewReleases(spotifyAuth.accessToken)
            .then((results) => { if (!cancelled) setAlbums(results); })
            .catch(() => { if (!cancelled) setAlbums([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [spotifyAuth.accessToken]);

    if (!loading && albums.length === 0) return null;
    const tileWidth = isMobile ? 96 : 150;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-secondary)', margin: 0 }}>New Releases</h3>
            <div style={{ display: 'flex', gap: isMobile ? '10px' : '16px', overflowX: 'auto', overflowY: 'hidden', padding: '4px 4px 14px 4px', WebkitOverflowScrolling: 'touch' }}>
                {loading ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Loading…</p>
                ) : albums.map((a) => (
                    <div key={a.id} onClick={() => onOpen(a)} style={{ flex: `0 0 ${tileWidth}px`, display: 'flex', flexDirection: 'column', gap: isMobile ? '6px' : '8px', cursor: 'pointer' }}>
                        <div style={{
                            width: `${tileWidth}px`, height: `${tileWidth}px`, borderRadius: '10px', overflow: 'hidden', flexShrink: 0, boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
                            background: a.artworkUrl ? 'transparent' : 'var(--widget-bg)',
                        }}>
                            {a.artworkUrl ? (
                                <img src={a.artworkUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Disc size={isMobile ? 22 : 32} color="var(--text-muted)" />
                                </div>
                            )}
                        </div>
                        <span style={{ fontSize: isMobile ? '11px' : '12px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 1px' }}>{a.title}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 1px' }}>{a.artist}</span>
                    </div>
                ))}
            </div>
        </div>
    );
});

// Small, fixed-palette source badge - Local/Saavn/YouTube, matching
// QueueManager's own existing LOCAL/NEXUS badge pattern elsewhere in this
// file rather than inventing a new visual language for "where a track
// came from".
const SOURCE_BADGE_STYLE = {
    local: { label: 'LOCAL', color: 'var(--text-muted)' },
    saavn: { label: 'SAAVN', color: '#2BC5B4' },
    youtube: { label: 'YOUTUBE', color: '#FF4E45' },
    spotify: { label: 'SPOTIFY', color: '#1DB954' },
};

const GlobalSearchTab = React.memo(({ playlist: queue, playTrackNow }) => {
    const {
        isSaavnConfigured, isYoutubeConfigured, setYoutubeQueue,
        spotifyAuth, spotifyDeviceId, spotifyPlayUri, activeSource, setActiveSource,
    } = useStreaming();
    const [query, setQuery] = useState('');
    // Explicit request, matched directly against a real Apple Music
    // screenshot: their Search page isn't blank until you type - it opens
    // straight into a real "Browse Categories" grid. This reuses the exact
    // same real, live-search genre tiles Home's own "Genres & Moods"
    // already has (BrowseCategoryTile below is just a bigger, Apple-style
    // visual treatment of the same CURATED_GENRE_TILES data + GenreDetailView).
    const [openGenre, setOpenGenre] = useState(null);
    const allTracks = useMemo(getAllLibraryTracks, []);

    const localResults = useMemo(() => {
        if (!query.trim()) return [];
        const q = query.toLowerCase();
        const fromLibrary = allTracks.filter((t) => t.title.toLowerCase().includes(q) || (t.artist || '').toLowerCase().includes(q));
        const fromQueue = queue.filter((t) => t.title.toLowerCase().includes(q));
        const seen = new Set();
        return [...fromLibrary, ...fromQueue]
            .filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; })
            .map((t) => ({ ...t, source: 'local' }));
    }, [query, allTracks, queue]);

    // Saavn/YouTube results - fetched live, debounced, only while the
    // respective service is actually connected/configured. Each keeps its
    // own independent loading/error state so one provider being slow or
    // down never blocks the other, or the always-instant local results.
    const [saavnResults, setSaavnResults] = useState([]);
    const [saavnLoading, setSaavnLoading] = useState(false);
    const [saavnError, setSaavnError] = useState(null);
    const [youtubeResults, setYoutubeResults] = useState([]);
    const [youtubeLoading, setYoutubeLoading] = useState(false);
    const [youtubeError, setYoutubeError] = useState(null);
    // Spotify: only fires while a real, connected access token exists -
    // same "each source has its own independent loading/error state"
    // pattern as Saavn/YouTube above, so a Spotify hiccup never blocks the
    // others (or vice versa).
    const [spotifyResults, setSpotifyResults] = useState([]);
    const [spotifyLoading, setSpotifyLoading] = useState(false);
    const [spotifyError, setSpotifyError] = useState(null);

    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length < 2) {
            setSaavnResults([]); setSaavnError(null); setSaavnLoading(false);
            setYoutubeResults([]); setYoutubeError(null); setYoutubeLoading(false);
            setSpotifyResults([]); setSpotifyError(null); setSpotifyLoading(false);
            return undefined;
        }
        const controller = new AbortController();
        // A real, 450ms debounce - typing "lofi beats" would otherwise
        // fire a network request (and, for YouTube, burn API quota) on
        // every single keystroke.
        const timer = setTimeout(() => {
            if (isSaavnConfigured) {
                setSaavnLoading(true); setSaavnError(null);
                searchSaavnSongs(trimmed, { signal: controller.signal })
                    .then((results) => setSaavnResults(results.map((t) => ({ ...t, source: 'saavn' }))))
                    .catch((err) => { if (err?.name !== 'AbortError') setSaavnError(err.message || 'Saavn search failed'); })
                    .finally(() => setSaavnLoading(false));
            } else {
                setSaavnResults([]); setSaavnError(null);
            }
            if (isYoutubeConfigured) {
                setYoutubeLoading(true); setYoutubeError(null);
                searchYoutubeTracks(trimmed, { signal: controller.signal })
                    .then((results) => setYoutubeResults(results))
                    .catch((err) => { if (err?.name !== 'AbortError') setYoutubeError(err.message || 'YouTube search failed'); })
                    .finally(() => setYoutubeLoading(false));
            } else {
                setYoutubeResults([]); setYoutubeError(null);
            }
            if (spotifyAuth.connected && spotifyAuth.accessToken) {
                setSpotifyLoading(true); setSpotifyError(null);
                searchSpotifyTracks(spotifyAuth.accessToken, trimmed, { signal: controller.signal })
                    .then((results) => setSpotifyResults(results))
                    .catch((err) => { if (err?.name !== 'AbortError') setSpotifyError(err.message || 'Spotify search failed'); })
                    .finally(() => setSpotifyLoading(false));
            } else {
                setSpotifyResults([]); setSpotifyError(null);
            }
        }, 450);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [query, isSaavnConfigured, isYoutubeConfigured, spotifyAuth.connected, spotifyAuth.accessToken]);

    const handleResultClick = (track, indexInYoutubeResults) => {
        if (track.source === 'youtube') { setYoutubeQueue(youtubeResults, indexInYoutubeResults); return; }
        if (track.source === 'spotify') {
            // Full-length playback needs the Web Playback SDK's device to
            // already be registered (only happens once activeSource is
            // 'spotify' - see StreamingContext.jsx) AND a Premium account,
            // a real restriction of Spotify's own SDK. Falling back to the
            // track's own 30-second preview clip - a real, legal MP3 URL -
            // plays through the exact same local <audio> pathway every
            // other source here already uses, so a non-Premium account (or
            // one that hasn't set Spotify active yet) still gets SOMETHING
            // real to listen to instead of a dead click.
            if (spotifyDeviceId && spotifyAuth.connected) {
                if (activeSource !== 'spotify') setActiveSource('spotify');
                // Same real fix as the genre/playlist/album detail views -
                // queues the rest of the visible Spotify results too, so
                // Next actually has somewhere to go instead of stopping
                // dead after this one track.
                spotifyPlayUri(track.uri, spotifyResults.map((t) => t.uri).filter(Boolean).slice(0, 100));
            } else if (track.previewUrl) {
                playTrackNow(track.title, track.previewUrl);
            }
            return;
        }
        playTrackNow(track.title, track.url);
    };

    const anyLoading = saavnLoading || youtubeLoading || spotifyLoading;
    const combinedResults = [...localResults, ...spotifyResults, ...saavnResults, ...youtubeResults];

    if (openGenre) {
        return (
            <GenreDetailView
                tile={openGenre}
                onBack={() => setOpenGenre(null)}
                playTrackNow={playTrackNow}
                spotifyAuth={spotifyAuth} spotifyDeviceId={spotifyDeviceId} spotifyPlayUri={spotifyPlayUri}
                activeSource={activeSource} setActiveSource={setActiveSource}
            />
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--widget-bg)', padding: '12px 16px', borderRadius: '14px', border: '1px solid var(--border-premium)' }}>
                {anyLoading ? <Loader2 size={16} color="var(--text-muted)" className="nexus-spin" /> : <Search size={16} color="var(--text-muted)" />}
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
            {/* Explicit request, matched directly against a real Apple
                Music screenshot of their own Search page: this used to be
                one plain, empty sentence until you typed something -
                Apple's Search page instead opens straight into a real
                "Browse Categories" grid. Same real CURATED_GENRE_TILES
                data Home's own Genres & Moods uses, just the bigger,
                Apple-style visual treatment (BrowseCategoryTile). */}
            {!query.trim() && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-secondary)', margin: 0 }}>Browse Categories</h3>
                    {spotifyAuth.connected ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '14px' }}>
                            {CURATED_GENRE_TILES.map((tile) => (
                                <BrowseCategoryTile key={tile.id} tile={tile} onOpen={setOpenGenre} />
                            ))}
                        </div>
                    ) : (
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                            Search across your library, playlists, and current queue{(isSaavnConfigured || isYoutubeConfigured) ? `, plus ${[isSaavnConfigured && 'Saavn', isYoutubeConfigured && 'YouTube'].filter(Boolean).join('/')}` : ''}. Connect Spotify (Connections in the sidebar) to also browse real categories here without typing.
                        </p>
                    )}
                </div>
            )}
            {(saavnError || youtubeError || spotifyError) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px' }}>
                    {spotifyError && <span style={{ fontSize: '12px', color: '#fca5a5' }}>{spotifyError}</span>}
                    {saavnError && <span style={{ fontSize: '12px', color: '#fca5a5' }}>{saavnError}</span>}
                    {youtubeError && <span style={{ fontSize: '12px', color: '#fca5a5' }}>{youtubeError}</span>}
                </div>
            )}
            {query.trim() && !anyLoading && combinedResults.length === 0 && (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No tracks match "{query}".</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {combinedResults.map((t, i) => {
                    const badge = SOURCE_BADGE_STYLE[t.source] || SOURCE_BADGE_STYLE.local;
                    // Index of THIS track within youtubeResults specifically
                    // (not the combined list) - that's the array setYoutubeQueue
                    // needs, so next/prev browse the YouTube results only.
                    const youtubeIndex = t.source === 'youtube' ? youtubeResults.indexOf(t) : -1;
                    // A Spotify result is only actually playable here if
                    // EITHER a Web Playback SDK device is already up
                    // (full-length, Premium-only) OR it has a real
                    // preview_url (30s, works on any account) - Spotify has
                    // been removing preview_url from a growing share of
                    // tracks, so this is a genuine, honest "can't play
                    // this one" state rather than a silent dead click.
                    const spotifyUnplayable = t.source === 'spotify' && !(spotifyDeviceId && spotifyAuth.connected) && !t.previewUrl;
                    return (
                        <div
                            key={`${t.source}-${t.id}`}
                            onClick={() => { if (!spotifyUnplayable) handleResultClick(t, youtubeIndex); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
                                background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px',
                                cursor: spotifyUnplayable ? 'default' : 'pointer', opacity: spotifyUnplayable ? 0.5 : 1,
                            }}
                        >
                            {t.artworkUrl ? (
                                <img src={t.artworkUrl} alt="" style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
                            ) : (
                                <Radio size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                                {t.artist && <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.artist}</div>}
                            </div>
                            {spotifyUnplayable && <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>No preview</span>}
                            <span style={{ fontSize: '9px', fontWeight: '800', letterSpacing: '0.5px', color: badge.color, flexShrink: 0 }}>{badge.label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

const LocalFilesTab = React.memo(({ addSong, playlist, playTrackNow, currentTrack, isPlaying, togglePlay, deleteSong }) => {
    const localTracks = useMemo(() => playlist.filter((t) => t.isLocal), [playlist]);
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
        // Real de-duplication by title, checked against the actual current
        // queue - a real, reported bug: selecting the same file twice (or
        // re-adding a track already in the queue from an earlier import)
        // always appended a second, redundant copy with no check at all.
        // Seeded with every title already in the queue, then grown as each
        // file in THIS SAME selection is accepted, so picking the same
        // file multiple times in one go is also caught, not just repeats
        // across separate imports.
        const existingTitles = new Set(playlist.map((t) => t.title.toLowerCase()));
        let added = 0, skipped = 0, duplicates = 0;
        files.forEach((file) => {
            if (!isSupportedAudioFile(file)) { skipped += 1; return; }
            const title = deriveTitle(file.name);
            if (existingTitles.has(title.toLowerCase())) { duplicates += 1; return; }
            addSong(title, file);
            existingTitles.add(title.toLowerCase());
            added += 1;
        });
        const parts = [];
        if (added) parts.push(`Added ${added} track${added > 1 ? 's' : ''}`);
        if (duplicates) parts.push(`skipped ${duplicates} already in your queue`);
        if (skipped) parts.push(`skipped ${skipped} unsupported file${skipped > 1 ? 's' : ''}`);
        showImportMessage(parts.length > 0 ? `${parts.join(', ')}.` : 'No supported audio files found in that selection.');
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

            {/* The per-track cloud-sync status feed that used to render
                here was removed entirely, per explicit, direct feedback:
                it accumulated one card PER EVER-IMPORTED TRACK with no
                cleanup, so a real library of any size turned this into a
                long, cluttered scroll of "Sync failed" cards repeating
                the same message - real, but not useful to keep staring
                at. The underlying background sync itself (AudioPlayerContext's
                own addSong) is untouched and still runs exactly as
                before; a track that fails to sync to the cloud still
                stays fully saved locally and playable, it just no longer
                narrates that process here. */}
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
                Imported tracks stay in your queue permanently - across pages and reloads - until you delete them.
            </p>

            {/* Real, reported bug fixed: this whole tab only ever showed
                the dropzone itself - a track genuinely imported here (via
                addSong, confirmed added to the real playlist array) never
                actually appeared anywhere on this page afterward, "jo
                local song add karunga wo yahan dikhna chahiye" - the only
                way to ever see/play it again was navigating to a totally
                different tab (Songs). Shows every real isLocal track from
                the queue right here, where it was just added. */}
            {localTracks.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '640px', margin: '8px auto 0 auto' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-secondary)', margin: 0 }}>Your Local Files ({localTracks.length})</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {localTracks.map((t) => {
                            const isActive = currentTrack && currentTrack.title === t.title;
                            return (
                                <div
                                    key={t.id}
                                    onClick={() => (isActive ? togglePlay() : playTrackNow(t.title, t.url))}
                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: isActive ? 'var(--primary-muted)' : 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', cursor: 'pointer' }}
                                >
                                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'var(--widget-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Music size={15} color="var(--text-muted)" />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '13px', fontWeight: '700', color: isActive ? 'var(--primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                                    </div>
                                    {isActive && (isPlaying ? <Pause size={14} color="var(--primary)" /> : <Play size={14} color="var(--text-muted)" />)}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteSong(t.id); }}
                                        title="Remove"
                                        style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px', display: 'flex', flexShrink: 0 }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
});

// ---------------------------------------------------------------------------
// Sidebar library views (Pins / Recently Played / Artists / Songs)
// ---------------------------------------------------------------------------

// Real, reported bug fixed: this used to only ever pin from the demo/mock
// AUDIO_LIBRARY catalog - once Spotify was connected, LibraryTab fully
// replaces those demo cards with the user's real Spotify playlists, which
// (until now) had no pin button at all, so this view became silently
// unreachable for any connected user ("PIN wala working hona chahiye").
// Spotify itself has no public Web API for its own client-local Pin
// feature - not honestly syncable - so this fetches the user's real
// playlists the same way LibraryTab does and lets favoritePlaylistIds (the
// same mechanism the demo catalog already used) pin real ones too: a
// genuine, working, app-local Pins feature covering whatever the user
// actually has, not a fake sync of something this app can't read.
const PinsView = React.memo(({ favoritePlaylistIds, toggleFavoritePlaylist, queuePlaylistTracks, playTrackNow, isMobile }) => {
    const [openPlaylist, setOpenPlaylist] = useState(null);
    const { spotifyAuth, activeSource, setActiveSource, spotifyDeviceId, spotifyPlayUri } = useStreaming();
    const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
    useEffect(() => {
        if (!spotifyAuth.connected || !spotifyAuth.accessToken) { setSpotifyPlaylists([]); return undefined; }
        let cancelled = false;
        getSpotifyPlaylists(spotifyAuth.accessToken).then((results) => { if (!cancelled) setSpotifyPlaylists(results); }).catch(() => {});
        return () => { cancelled = true; };
    }, [spotifyAuth.connected, spotifyAuth.accessToken]);

    const pinnedDemo = useMemo(() => AUDIO_LIBRARY.filter((p) => favoritePlaylistIds.has(p.id)), [favoritePlaylistIds]);
    const pinnedSpotify = useMemo(() => spotifyPlaylists.filter((p) => favoritePlaylistIds.has(p.id)), [spotifyPlaylists, favoritePlaylistIds]);
    const handleShufflePlay = (playlist) => queuePlaylistTracks(playlist.trackRefs(), { shuffle: true });
    const handleQueueAll = (tracks) => queuePlaylistTracks(tracks, { shuffle: false });
    const handlePlayTrack = (track) => queuePlaylistTracks([track], { shuffle: false });

    if (openPlaylist) {
        return openPlaylist.source === 'spotify' ? (
            <SpotifyPlaylistDetailView
                playlist={openPlaylist}
                onBack={() => setOpenPlaylist(null)}
                playTrackNow={playTrackNow}
                spotifyAuth={spotifyAuth} spotifyDeviceId={spotifyDeviceId} spotifyPlayUri={spotifyPlayUri}
                activeSource={activeSource} setActiveSource={setActiveSource}
            />
        ) : (
            <PlaylistDetailView
                playlist={openPlaylist}
                onBack={() => setOpenPlaylist(null)}
                onPlayTrack={handlePlayTrack}
                onShufflePlay={handleShufflePlay}
                onQueueAll={handleQueueAll}
            />
        );
    }

    if (pinnedDemo.length === 0 && pinnedSpotify.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '40px 20px', textAlign: 'center' }}>
                <Pin size={26} color="var(--text-muted)" />
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>No pins yet - tap the heart on a playlist in Home to pin it here.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? '10px' : '16px' }}>
            {pinnedSpotify.map((playlist) => (
                <SpotifyPlaylistCard
                    key={playlist.id}
                    playlist={playlist}
                    isFavorite
                    onOpen={setOpenPlaylist}
                    onToggleFavorite={toggleFavoritePlaylist}
                    isMobile={isMobile}
                />
            ))}
            {pinnedDemo.map((playlist) => (
                <PlaylistCard
                    key={playlist.id}
                    playlist={playlist}
                    isFavorite
                    onOpen={setOpenPlaylist}
                    onToggleFavorite={toggleFavoritePlaylist}
                    onShufflePlay={handleShufflePlay}
                    isMobile={isMobile}
                />
            ))}
        </div>
    );
});

const RecentlyPlayedView = React.memo(({ recentlyPlayed, currentTrack, isPlaying, playTrackNow, togglePlay }) => {
    // Real fix for the reported "Play पर click करो तो play नहीं हो रहा है"
    // bug: a Spotify entry has no `url` but now carries a real `uri` (see
    // AudioPlayerContext.jsx's effectiveCurrentTrack) that spotifyPlayUri
    // can genuinely replay once a device is ready.
    const { spotifyAuth, activeSource, setActiveSource, spotifyDeviceId, spotifyPlayUri } = useStreaming();
    if (recentlyPlayed.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '40px 20px', textAlign: 'center' }}>
                <Clock size={26} color="var(--text-muted)" />
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Nothing played yet this session - your play history will show up here.</p>
            </div>
        );
    }
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {recentlyPlayed.map((t, i) => {
                const isActive = currentTrack && currentTrack.title === t.title && (currentTrack.url === t.url || (t.uri && currentTrack.uri === t.uri));
                const canPlaySpotify = t.source === 'spotify' && !!t.uri && spotifyDeviceId && spotifyAuth.connected;
                const playable = !!t.url || canPlaySpotify;
                const doPlay = () => {
                    if (canPlaySpotify) {
                        if (activeSource !== 'spotify') setActiveSource('spotify');
                        spotifyPlayUri(t.uri);
                    } else if (t.url) {
                        playTrackNow(t.title, t.url);
                    }
                };
                const badge = SOURCE_BADGE_STYLE[t.source] || SOURCE_BADGE_STYLE.local;
                return (
                    <div
                        key={t.title + i}
                        onClick={() => { if (playable) (isActive ? togglePlay() : doPlay()); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: isActive ? 'var(--primary-muted)' : 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', cursor: playable ? 'pointer' : 'default', opacity: playable ? 1 : 0.6 }}
                    >
                        {t.artworkUrl ? (
                            <img src={t.artworkUrl} alt="" style={{ width: '34px', height: '34px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: gradientForId(t.title), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Disc size={15} color="rgba(255,255,255,0.85)" />
                            </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: isActive ? 'var(--primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                            {t.artist && <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.artist}</div>}
                        </div>
                        {!playable && <span style={{ fontSize: '9px', color: 'var(--text-muted)', flexShrink: 0 }}>Search to replay</span>}
                        <span style={{ fontSize: '9px', fontWeight: '800', letterSpacing: '0.5px', color: badge.color, flexShrink: 0 }}>{badge.label}</span>
                        {playable && (isActive && isPlaying ? <Pause size={14} color="var(--primary)" /> : <Play size={14} color="var(--text-muted)" />)}
                    </div>
                );
            })}
        </div>
    );
});

// Real, reported gap closed: a track favorited anywhere in this app (the
// "..." menu, the full player's heart button) previously had nowhere to
// actually be seen as a list - the heart icons themselves always worked
// (see toggleFavoriteTrack), there was just no view for the result.
// favoriteTrackDetails (title -> {artist,url,source,artworkUrl}) only
// exists for tracks favorited AFTER this fix - older entries in
// favoriteTrackTitles (title-only, from before) still render honestly as
// a bare title with a LOCAL badge, resolved against the local library by
// title if possible (the only source with a stable, guessable url).
const FavoritesView = React.memo(({ favoriteTrackTitles, favoriteTrackDetails, toggleFavoriteTrack, playTrackNow, currentTrack, isPlaying, togglePlay }) => {
    const allTracks = useMemo(getAllLibraryTracks, []);
    // spotifyAuth/activeSource/setActiveSource/spotifyDeviceId/spotifyPlayUri
    // are already destructured from useStreaming() further down in this
    // same component (see handleSpotifyTrackClick's own block) - reused
    // here rather than a second, colliding declaration.
    // Real fix for a real bug ("bahut sara song gayab hai" - many
    // favorited songs missing): favoriteTrackTitles now holds composite
    // source+artist-aware KEYS for non-local tracks, not literal titles
    // (see makeFavoriteKey's own comment in AudioPlayerContext.jsx) - two
    // different tracks that happened to share a title used to collide into
    // one Set entry and silently overwrite each other. Each key's REAL
    // title is recovered from favoriteTrackDetails[key].title (always
    // stored there now), falling back to the key itself only for legacy
    // 'local' entries, where the key genuinely still IS the plain title.
    const rows = useMemo(() => {
        return [...favoriteTrackTitles].map((key) => {
            const details = favoriteTrackDetails[key];
            const title = details?.title || key;
            if (details) return { key, title, ...details };
            const localMatch = allTracks.find((t) => t.title === title);
            return localMatch
                ? { key, title, artist: localMatch.artist, url: localMatch.url, source: 'local' }
                : { key, title, artist: '', url: '', source: 'local' };
        });
    }, [favoriteTrackTitles, favoriteTrackDetails, allTracks]);

    // Real, explicitly-requested feature: the user's ACTUAL Spotify "Liked
    // Songs" library, not just tracks favorited from inside this app -
    // shown as its own clearly-labeled section above the app-local list.
    // Read-only here (no un-like) - that's a real, separate scope
    // (PUT/DELETE /v1/me/tracks) not yet built, kept honest rather than a
    // heart button that would silently do nothing.
    const { spotifyAuth, spotifyDeviceId, spotifyPlayUri, activeSource, setActiveSource } = useStreaming();
    const [spotifyLiked, setSpotifyLiked] = useState([]);
    const [spotifyLikedLoading, setSpotifyLikedLoading] = useState(false);
    const [spotifyLikedError, setSpotifyLikedError] = useState(null);
    useEffect(() => {
        if (!spotifyAuth.connected || !spotifyAuth.accessToken) { setSpotifyLiked([]); return undefined; }
        let cancelled = false;
        setSpotifyLikedLoading(true);
        setSpotifyLikedError(null);
        getSpotifyLikedSongs(spotifyAuth.accessToken)
            .then((results) => { if (!cancelled) setSpotifyLiked(results); })
            .catch((err) => { if (!cancelled) setSpotifyLikedError(err.message || 'Could not load your Spotify Liked Songs'); })
            .finally(() => { if (!cancelled) setSpotifyLikedLoading(false); });
        return () => { cancelled = true; };
    }, [spotifyAuth.connected, spotifyAuth.accessToken]);

    // Same real fix as the detail views - Liked Songs is a genuine
    // ordered playlist too, so it queues the same way instead of
    // stranding Next with nothing to advance to.
    const handleSpotifyTrackClick = (track) => {
        if (spotifyDeviceId && spotifyAuth.connected) {
            if (activeSource !== 'spotify') setActiveSource('spotify');
            spotifyPlayUri(track.uri, spotifyLiked.map((t) => t.uri).filter(Boolean).slice(0, 100));
        } else if (track.previewUrl) {
            playTrackNow(track.title, track.previewUrl);
        }
    };

    if (rows.length === 0 && spotifyLiked.length === 0 && !spotifyLikedLoading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '40px 20px', textAlign: 'center' }}>
                <Heart size={26} color="var(--text-muted)" />
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>No favourites yet - tap the heart on any track (the "..." menu, or the full player) to add it here.</p>
            </div>
        );
    }
    // Explicit request: split into two side-by-side columns (Spotify Liked
    // Songs / Favourited in Nexus) instead of one stacked on top of the
    // other - grid naturally collapses to a single column on a narrow
    // viewport instead of needing a separate isMobile check.
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'start' }}>
            {spotifyAuth.connected && (spotifyLiked.length > 0 || spotifyLikedLoading || spotifyLikedError) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-secondary)', margin: 0 }}>Spotify Liked Songs</h3>
                    {spotifyLikedLoading && <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Loading…</p>}
                    {spotifyLikedError && <p style={{ fontSize: '13px', color: '#fca5a5', margin: 0 }}>{spotifyLikedError}</p>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {spotifyLiked.map((t) => {
                            const isActive = currentTrack && currentTrack.title === t.title;
                            const playable = (spotifyDeviceId && spotifyAuth.connected) || t.previewUrl;
                            return (
                                <div
                                    key={t.id}
                                    onClick={() => playable && handleSpotifyTrackClick(t)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: isActive ? 'var(--primary-muted)' : 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', cursor: playable ? 'pointer' : 'default', opacity: playable ? 1 : 0.6 }}
                                >
                                    {t.artworkUrl ? (
                                        <img src={t.artworkUrl} alt="" style={{ width: '34px', height: '34px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                                    ) : (
                                        <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'var(--widget-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Disc size={15} color="var(--text-muted)" />
                                        </div>
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '13px', fontWeight: '700', color: isActive ? 'var(--primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                                        {t.artist && <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.artist}</div>}
                                    </div>
                                    {!playable && <span style={{ fontSize: '9px', color: 'var(--text-muted)', flexShrink: 0 }}>No preview</span>}
                                    <span style={{ fontSize: '9px', fontWeight: '800', letterSpacing: '0.5px', color: SOURCE_BADGE_STYLE.spotify.color, flexShrink: 0 }}>{SOURCE_BADGE_STYLE.spotify.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {rows.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {spotifyAuth.connected && <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-secondary)', margin: 0 }}>Favourited in Nexus</h3>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {rows.map((t) => {
                            const isActive = currentTrack && currentTrack.title === t.title;
                            // Real, reported bug fixed: a track favourited
                            // from Spotify (this app's own heart buttons on
                            // Recently Played/the header popup/etc.) never
                            // stored a `url` at all - Spotify plays through
                            // its own SDK, not a normal <audio src>. This
                            // row's own playability check only ever looked
                            // at `t.url`, so it honestly (if uselessly)
                            // showed "Search to replay" for every single
                            // Spotify favourite, even ones favourited
                            // moments ago. Same real canPlaySpotify pattern
                            // RecentlyPlayedView/LibraryTab's own Recently
                            // Played row already use.
                            const canPlaySpotify = t.source === 'spotify' && !!t.uri && spotifyDeviceId && spotifyAuth.connected;
                            const playable = !!t.url || canPlaySpotify;
                            const doPlay = () => {
                                if (canPlaySpotify) {
                                    if (activeSource !== 'spotify') setActiveSource('spotify');
                                    spotifyPlayUri(t.uri);
                                } else if (t.url) {
                                    playTrackNow(t.title, t.url);
                                }
                            };
                            const badge = SOURCE_BADGE_STYLE[t.source] || SOURCE_BADGE_STYLE.local;
                            return (
                                <div
                                    key={t.key}
                                    onClick={() => { if (playable) (isActive ? togglePlay() : doPlay()); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: isActive ? 'var(--primary-muted)' : 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', cursor: playable ? 'pointer' : 'default', opacity: playable ? 1 : 0.6 }}
                                >
                                    {t.artworkUrl ? (
                                        <img src={t.artworkUrl} alt="" style={{ width: '34px', height: '34px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                                    ) : (
                                        <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: gradientForId(t.title), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Disc size={15} color="rgba(255,255,255,0.85)" />
                                        </div>
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '13px', fontWeight: '700', color: isActive ? 'var(--primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                                        {t.artist && <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.artist}</div>}
                                    </div>
                                    {!playable && <span style={{ fontSize: '9px', color: 'var(--text-muted)', flexShrink: 0 }}>Search to replay</span>}
                                    <span style={{ fontSize: '9px', fontWeight: '800', letterSpacing: '0.5px', color: badge.color, flexShrink: 0 }}>{badge.label}</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleFavoriteTrack(t.title, { source: t.source, artist: t.artist }); }}
                                        title="Remove from favourites"
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}
                                    >
                                        <Heart size={14} color="#F43F5E" fill="#F43F5E" />
                                    </button>
                                    {isActive && (isPlaying ? <Pause size={14} color="var(--primary)" /> : <Play size={14} color="var(--text-muted)" />)}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
});

// Explicit request: remove every demo/mock entry that used to live here
// (this used to be getAllLibraryTracks() - the app's own placeholder
// catalog, e.g. "Focus Flow"/"Deep Work") and replace it with something
// real and necessary, left to this app's own judgment per the user's
// explicit delegation ("apni samajh se... zaroori cheez rakh sakte ho").
// Real Spotify's own "Songs" library entry is just Liked Songs, but
// FavoritesView already shows that clearly - repeating it here would be
// pure duplication, not something necessary. What's genuinely missing a
// home anywhere else: the user's OWN real uploaded local files
// (playlist entries with isLocal===true, from the Local Files tab) -
// currently only visible buried inside the live queue, never as a browsable
// list of their own.
const SongsView = React.memo(({ playlist, playTrackNow, currentTrack, isPlaying, togglePlay, setActiveView }) => {
    const localSongs = useMemo(() => (playlist || []).filter((t) => t.isLocal), [playlist]);
    if (localSongs.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '40px 20px', textAlign: 'center' }}>
                <Music2 size={26} color="var(--text-muted)" />
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>No local songs added yet - your own uploaded files show up here.</p>
                {typeof setActiveView === 'function' && (
                    <button onClick={() => setActiveView('local')} style={{ marginTop: '4px', padding: '8px 14px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', color: 'var(--text-secondary)', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Go to Local Files</button>
                )}
            </div>
        );
    }
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {localSongs.map((t, i) => {
                const isActive = currentTrack && currentTrack.title === t.title;
                return (
                    <div
                        key={t.id || t.title + i}
                        onClick={() => (isActive ? togglePlay() : playTrackNow(t.title, t.url))}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: isActive ? 'var(--primary-muted)' : 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', cursor: 'pointer' }}
                    >
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', width: '18px', flexShrink: 0 }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: isActive ? 'var(--primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                            {t.artist && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.artist}</div>}
                        </div>
                        {isActive && isPlaying ? <Pause size={14} color="var(--primary)" /> : <Play size={14} color="var(--text-muted)" />}
                    </div>
                );
            })}
        </div>
    );
});

const ArtistsView = React.memo(({ playTrackNow, currentTrack, isPlaying, togglePlay }) => {
    const allTracks = useMemo(getAllLibraryTracks, []);
    const [selectedArtist, setSelectedArtist] = useState(null);
    const artists = useMemo(() => {
        const map = new Map();
        allTracks.forEach((t) => {
            const name = t.artist || 'Unknown Artist';
            if (!map.has(name)) map.set(name, []);
            map.get(name).push(t);
        });
        return Array.from(map.entries());
    }, [allTracks]);

    if (selectedArtist) {
        const tracks = artists.find(([name]) => name === selectedArtist)?.[1] || [];
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button onClick={() => setSelectedArtist(null)} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '10px', padding: '8px', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex' }}><ChevronLeft size={18} /></button>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{selectedArtist}</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {tracks.map((t, i) => {
                        const isActive = currentTrack && currentTrack.title === t.title;
                        return (
                            <div
                                key={t.id || t.title + i}
                                onClick={() => (isActive ? togglePlay() : playTrackNow(t.title, t.url))}
                                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: isActive ? 'var(--primary-muted)' : 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', cursor: 'pointer' }}
                            >
                                <span style={{ fontSize: '13px', fontWeight: '700', color: isActive ? 'var(--primary)' : 'var(--text-primary)', flex: 1 }}>{t.title}</span>
                                {isActive && isPlaying ? <Pause size={14} color="var(--primary)" /> : <Play size={14} color="var(--text-muted)" />}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {artists.map(([name, tracks]) => (
                <div
                    key={name}
                    onClick={() => setSelectedArtist(name)}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', cursor: 'pointer' }}
                >
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--primary-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Mic2 size={15} color="var(--primary)" />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', flex: 1 }}>{name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tracks.length} track{tracks.length !== 1 ? 's' : ''}</span>
                </div>
            ))}
        </div>
    );
});

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

// Same 8 destinations AudioSidebar renders as a real vertical sidebar on
// desktop - reused here as a horizontal scrollable pill row on mobile,
// where a fixed 220px-wide sidebar would eat too much of the screen. This
// mirrors an established convention already used elsewhere in this app
// (e.g. Notifications' anchored dropdown becoming a full-width bottom
// sheet on mobile): the same real destinations, a layout suited to the
// viewport.
// Local Files removed from this row per explicit request - it now lives
// in the profile menu instead (see ProfileMenu's own onOpenLocalFiles),
// keeping this scrollable strip shorter/more relevant for the common
// case (browsing genres/playlists), the same real reasoning the profile
// avatar/Connections move above already follows.
//
// Cut down again, from 6 pills to 3 (Search/Home/Library), per explicit
// live confirmation against Apple Music's own mobile Library tab
// (screenshot reference) - Pins/Recent/Artists/Songs/Favourites are real
// destinations, not removed, just no longer flat top-level pills; they
// now live as rows inside the new 'library' view (see LibraryMenuView
// below), the same consolidation Apple Music/Spotify's own mobile nav
// uses (a single Library entry point, not one tab per collection type).
const MOBILE_NAV_ITEMS = [
    { id: 'search', label: 'Search', icon: Search },
    { id: 'home', label: 'Home', icon: Home },
    { id: 'library', label: 'Library', icon: Library },
];

// Any activeView reachable FROM the Library screen - used so the
// "Library" pill still reads as selected while browsing inside one of
// its rows (Pins/Recent/Artists/Songs/Favourites), not just when
// activeView is literally 'library' itself.
const LIBRARY_VIEWS = ['library', 'pins', 'recent', 'artists', 'songs', 'favorites'];

const VIEW_TITLES = {
    search: 'Search', home: 'Home', local: 'Local Files', library: 'Library',
    pins: 'Pins', favorites: 'Favourites', recent: 'Recently Played', artists: 'Artists', songs: 'Songs', settings: 'Music Settings',
};

// New mobile "Library" landing screen - the real replacement for the 4
// pills (Pins/Recent/Artists/Songs) this consolidates, plus Favourites
// which never had its own top-level pill at all before. Matches Apple
// Music's own Library tab shape from the reference screenshot: a row of
// featured square tiles up top (Favourite Songs / Recently Played -
// Apple's own reference shows 3 tiles, but the other two in that
// screenshot are "P-POP CULTURE" and "Replay All Time", a curated
// playlist and a Spotify-Wrapped-style yearly recap - neither has any
// real backing feature in this app, so only the two genuinely real ones
// are shown rather than inventing fake tiles just to fill the row), then
// a plain list below for the rest (Pins/Artists/Songs) - each row's
// count is a live number pulled from real app state, never fabricated.
// Local Files is deliberately NOT duplicated here - it already has a
// real, dedicated entry point in the profile menu (see ProfileMenu's
// onOpenLocalFiles) and listing it twice would just be redundant.
const LIBRARY_CARDS = [
    { id: 'favorites', label: 'Favourite Songs', icon: Heart, gradient: 'linear-gradient(135deg, #F43F5E, #EC4899)' },
    { id: 'recent', label: 'Recently Played', icon: Clock, gradient: 'linear-gradient(135deg, #6366F1, #3B82F6)' },
];
const LibraryMenuView = ({ setActiveView, favoritePlaylistIds, playlist }) => {
    const rows = [
        { id: 'pins', label: 'Pins', icon: Pin, count: favoritePlaylistIds?.length ?? 0 },
        { id: 'artists', label: 'Artists', icon: Mic2, count: null },
        { id: 'songs', label: 'Songs', icon: Music2, count: playlist?.length ?? 0 },
    ];
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {LIBRARY_CARDS.map((card) => {
                    const Icon = card.icon;
                    return (
                        <button
                            key={card.id}
                            onClick={() => setActiveView(card.id)}
                            style={{
                                aspectRatio: '1.6', borderRadius: '14px', border: 'none', cursor: 'pointer',
                                background: card.gradient, position: 'relative', overflow: 'hidden',
                                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                                padding: '12px', textAlign: 'left',
                            }}
                        >
                            <Icon size={20} color="rgba(255,255,255,0.95)" fill={card.id === 'favorites' ? 'rgba(255,255,255,0.95)' : 'none'} />
                            <span style={{ fontSize: '13px', fontWeight: '800', color: '#fff' }}>{card.label}</span>
                        </button>
                    );
                })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {rows.map((row) => {
                    const Icon = row.icon;
                    return (
                        <button
                            key={row.id}
                            onClick={() => setActiveView(row.id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '14px', width: '100%',
                                padding: '13px 4px', background: 'transparent', border: 'none',
                                borderBottom: '1px solid var(--border-premium)', cursor: 'pointer', textAlign: 'left',
                            }}
                        >
                            <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'var(--widget-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Icon size={16} color="var(--primary)" />
                            </div>
                            <span style={{ flex: 1, fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{row.label}</span>
                            {row.count !== null && (
                                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>{row.count}</span>
                            )}
                            <ChevronRight size={16} color="var(--text-muted)" />
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const AudioHubPage = ({ setActiveTab }) => {
    const isMobile = useIsMobile();
    useEffect(() => {
        localStorage.setItem('nexus_current_route', 'audio_hub');
    }, []);

    const {
        playlist, currentSongIndex, currentTrack, isPlaying, volume, isMuted, currentTime, duration,
        favoritePlaylistIds, favoriteTrackTitles, favoriteTrackDetails, shuffleEnabled, repeatMode, recentlyPlayed, durationsByUrl,
        setVolume: setLocalVolume, toggleMute, togglePlay, playAt, next, prev, addSong,
        addRemoteTrack, playTrackNow, queuePlaylistTracks, toggleFavoritePlaylist, toggleFavoriteTrack,
        toggleShuffle, cycleRepeatMode, deleteSong, moveSong, seek,
    } = useAudioPlayer();
    // currentTrack/isPlaying/currentTime/duration/seek above already
    // transparently reflect Spotify's real Web Playback SDK state when
    // it's the active source (AudioPlayerContext's own effectiveCurrentTrack
    // mechanism - the same one YouTube already used) - no local override
    // needed here anymore. Only volume still needs a small wrapper: the
    // SDK has its own separate volume the local <audio> element's setVolume
    // never touches.
    const { activeSource, spotifySetVolume, spotifyAuth, appleMusicAuth, youtubeAuth, saavnAuth } = useStreaming();
    const setVolume = (v) => {
        setLocalVolume(v);
        if (activeSource === 'spotify') spotifySetVolume(v);
    };

    const [activeView, setActiveView] = useState('home');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [connectionsPanelOpen, setConnectionsPanelOpen] = useState(false);
    const { width: sidebarWidth, isDragging: sidebarDragging, handleMouseDown: handleSidebarResizeMouseDown } = useResizableSidebar({
        storageKey: 'nexus_audio_sidebar_width', defaultWidth: 220, minWidth: 180, maxWidth: 320,
    });

    // Mobile has no room for AudioSidebar's own full footer, but Settings/
    // Sign Out still need to be reachable - DashboardLayout hides the main
    // app header/sidebar on this tab on mobile (see isHeaderHiddenOnMobile),
    // so without this there would be no path to either. A small profile
    // avatar button in the mobile nav row opens the exact same ProfileMenu.
    const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
    const mobileProfileBtnRef = useRef(null);
    const mobileProfileInitial = useMemo(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('nexus_user_profile') || '{}');
            const name = saved.name || 'New User';
            return name === 'New User' ? 'U' : name.charAt(0).toUpperCase();
        } catch (e) {
            return 'U';
        }
    }, []);
    // Real, reported bug: this avatar always showed the generic Nexus OS
    // "N" initial on a fixed purple/blue/pink gradient, even with a real
    // music account connected - desktop's own AudioSidebar footer already
    // shows which SERVICE is connected via a brand-colored icon, but
    // mobile had no such signal at all. Mirrors that same real connected-
    // service identity here instead, using each service's own real brand
    // color (matching TransferMusicModal/AudioSettingsView's own SERVICES
    // colors, so this can never drift from what those already show) and,
    // for Spotify, its own real profile name's first letter (the only
    // service this app actually has a real profile name for) rather than
    // a fabricated one for services that don't expose it.
    const mobileConnectedService = useMemo(() => {
        if (activeSource === 'spotify' && spotifyAuth.connected) return { name: spotifyAuth.profileName || 'Spotify', color: '#1DB954' };
        if (activeSource === 'apple' && appleMusicAuth.connected) return { name: 'Apple Music', color: '#FA233B' };
        if (activeSource === 'youtube' && youtubeAuth.connected) return { name: 'YouTube', color: '#FF0000' };
        if (spotifyAuth.connected) return { name: spotifyAuth.profileName || 'Spotify', color: '#1DB954' };
        if (appleMusicAuth.connected) return { name: 'Apple Music', color: '#FA233B' };
        if (youtubeAuth.connected) return { name: 'YouTube', color: '#FF0000' };
        if (saavnAuth.connected) return { name: 'Saavn', color: '#2BC5B4' };
        return null;
    }, [activeSource, spotifyAuth.connected, spotifyAuth.profileName, appleMusicAuth.connected, youtubeAuth.connected, saavnAuth.connected]);

    // Views render directly on the page background now (no per-view boxed
    // card wrapper) - real, explicit feedback that the "Playlists & Albums"
    // grid (and the rest of this page) had a "card within a card" look; a
    // shared object avoids repeating the same JSX for every activeView
    // branch below.
    const activeViewContent = (() => {
        switch (activeView) {
            case 'home': return (
                <LibraryTab
                    playTrackNow={playTrackNow}
                    recentlyPlayed={recentlyPlayed}
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    togglePlay={togglePlay}
                />
            );
            case 'search': return <GlobalSearchTab playlist={playlist} playTrackNow={playTrackNow} />;
            case 'library': return <LibraryMenuView setActiveView={setActiveView} favoritePlaylistIds={favoritePlaylistIds} playlist={playlist} />;
            case 'local': return <LocalFilesTab addSong={addSong} playlist={playlist} playTrackNow={playTrackNow} currentTrack={currentTrack} isPlaying={isPlaying} togglePlay={togglePlay} deleteSong={deleteSong} />;
            case 'pins': return <PinsView favoritePlaylistIds={favoritePlaylistIds} toggleFavoritePlaylist={toggleFavoritePlaylist} queuePlaylistTracks={queuePlaylistTracks} playTrackNow={playTrackNow} isMobile={isMobile} />;
            case 'favorites': return <FavoritesView favoriteTrackTitles={favoriteTrackTitles} favoriteTrackDetails={favoriteTrackDetails} toggleFavoriteTrack={toggleFavoriteTrack} playTrackNow={playTrackNow} currentTrack={currentTrack} isPlaying={isPlaying} togglePlay={togglePlay} />;
            case 'recent': return <RecentlyPlayedView recentlyPlayed={recentlyPlayed} currentTrack={currentTrack} isPlaying={isPlaying} playTrackNow={playTrackNow} togglePlay={togglePlay} />;
            case 'artists': return <ArtistsView playTrackNow={playTrackNow} currentTrack={currentTrack} isPlaying={isPlaying} togglePlay={togglePlay} />;
            case 'songs': return <SongsView playlist={playlist} playTrackNow={playTrackNow} currentTrack={currentTrack} isPlaying={isPlaying} togglePlay={togglePlay} setActiveView={setActiveView} />;
            case 'settings': return <AudioSettingsView />;
            default: return null;
        }
    })();

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', animation: 'fadeInScale 0.3s ease',
            width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box', minWidth: 0,
            // Real relative anchor for FloatingBottomPlayer's own absolute
            // positioning - it floats OVER this page's content rather than
            // pushing it, per the redesign spec.
            position: 'relative',
            height: '100%', minHeight: 0, overflow: 'hidden',
            // DashboardLayout gives this page zero glass-panel padding, so
            // it applies its own padding instead. Left padding dropped to 0
            // (was 24px) - explicit later feedback that the gap between the
            // Main App Sidebar and this page's OWN inner AudioSidebar was
            // way too large compared to the small, precise gap near the
            // Main Sidebar's own 'N' logo. AudioSidebar now sits flush at
            // this page's own true left edge, so the ONLY gap between the
            // two sidebars is the 10px resizer/spacer below - the exact
            // same value DashboardLayout's own shell now uses, so the two
            // gaps read as visually identical everywhere in the app.
            //
            // Right padding dropped to 0 too (was 24px) - a real, reported
            // bug: that padding sat on THIS outer wrapper, one level above
            // the actual scrolling container (see its own overflowY:'auto'
            // div further down), so the scrollbar rendered at the INNER
            // box's edge - 24px short of the page's true right edge -
            // leaving a visible dead strip of empty space between the
            // scrollbar and the window edge. The same 24px of breathing
            // room now lives as padding-right on the scroll container
            // itself instead, which keeps the content inset from the
            // scrollbar while letting the scrollbar itself sit flush
            // against the real edge, matching the left side.
            padding: isMobile ? 'calc(16px + env(safe-area-inset-top, 0px)) 12px 0 12px' : '8px 0 0 0',
        }}>
            {/* "Back to Home" MOVED here from inside AudioSidebar's own
                card, per explicit request - it now sits in the real, actual
                gap between the main app header and this page's sidebar
                (this page's own top padding above), not nested inside
                either card. A real text label now, not just a bare icon.
                Both the outer padding above and this button's own bottom
                padding were tightened - real, reported feedback that the
                first version left too much dead space here (and made the
                "Home" title below feel visually cramped/cut against it). */}
            {!isMobile && (
                <button
                    type="button"
                    onClick={() => typeof setActiveTab === 'function' && setActiveTab('Home')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start',
                        background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                        fontSize: '12px', fontWeight: '700', cursor: 'pointer', padding: '0 2px 6px 4px', flexShrink: 0,
                    }}
                >
                    <ChevronLeft size={15} /> Back to Home
                </button>
            )}
            {/* Real, confirmed fix: this used to be mounted only inside
                the !isMobile branch just below, alongside AudioSidebar's
                own desktop-only "Connections" button - the ONLY thing
                that ever opened it. Mobile's own ProfileMenu now has a
                real "Connections" entry too (see the mobile chrome
                above), but that route did nothing at all until this
                modal itself was moved out here to render regardless of
                isMobile - it's a real position:fixed full-screen overlay
                already, nothing about it actually depends on sitting
                inside the desktop sidebar's own DOM subtree. */}
            {connectionsPanelOpen && (
                <ConnectionsPanel onClose={() => setConnectionsPanelOpen(false)} />
            )}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '14px' : 0 }}>
                {!isMobile && (
                    <>
                        <AudioSidebar
                            activeView={activeView} onSelectView={setActiveView}
                            collapsed={sidebarCollapsed}
                            onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
                            width={sidebarWidth}
                            onOpenConnections={() => setConnectionsPanelOpen(true)}
                        />
                        {/* Drag-to-resize handle, same proven mechanism as
                            the AI page's own sidebar (useResizableSidebar) -
                            doubles as the sidebar's own "floating gap" from
                            the content column, so no separate CSS gap is
                            needed alongside it. Not rendered while
                            collapsed (nothing meaningful to resize in the
                            narrow icon rail); a plain spacer keeps the same
                            visual gap in that state instead. */}
                        {sidebarCollapsed ? (
                            <div style={{ width: '10px', flexShrink: 0 }} />
                        ) : (
                            <div
                                className={`nexus-sidebar-resizer${sidebarDragging ? ' is-dragging' : ''}`}
                                onMouseDown={handleSidebarResizeMouseDown}
                                role="separator" aria-orientation="vertical" aria-label="Resize sidebar"
                                style={{ width: '10px', margin: 0 }}
                            />
                        )}
                    </>
                )}

                <div style={{
                    flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0,
                    // Real, reported bug fixed: FloatingBottomPlayer's own
                    // `left: 50%` used to be positioned relative to the
                    // OUTER page wrapper further up (which spans the
                    // sidebar + resizer + this content column all
                    // together), so it centered across that whole width -
                    // visibly shifted toward the sidebar instead of sitting
                    // centered in the actual content area to its right.
                    // FloatingBottomPlayer is now rendered INSIDE this div
                    // instead (see below) and this is its real relative
                    // anchor, so `left: 50%` centers correctly between this
                    // page's own sidebar and the true right edge of the
                    // screen, matching the explicit reference screenshot
                    // (sidebar cropped out, centered in what's left).
                    position: 'relative',
                }}>
                    {/* Mobile-only chrome: back button + horizontally-
                        scrolling nav pill row standing in for the full
                        sidebar, plus a profile avatar. Pinned (not part of
                        the unified scroll below) since it functions as
                        real navigation, not page content - equivalent to
                        the desktop sidebar staying in place while content
                        scrolls past it. */}
                    {isMobile && (
                        // Real, reported bug fixed: the Back button AND the
                        // profile avatar used to be INSIDE the same
                        // overflowX:'auto' strip as the nav pills - "upar
                        // wala bhi scrollbar hota hai... profile picture ko
                        // scrollbar mein badal diya" - meaning the profile
                        // button (and Back) could scroll out of reach
                        // instead of staying put like real, fixed chrome.
                        // Only the middle nav-pill row (Recent/Artists/
                        // Songs/etc., genuinely more items than fit on a
                        // narrow screen) needs to scroll - Back and Profile
                        // are real navigation anchors that should always
                        // stay visible, never scrolled away.
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, padding: '0 0 10px 0' }}>
                            {/* Explicit "Back to Home" button removed - a
                                real, confirmed report: mobile already has
                                MobileTabBar's own Home tab always one tap
                                away at the bottom, and none of the real
                                reference apps (Spotify/Apple Music/
                                JioSaavn) put an extra in-page back button
                                in their own header either - they rely
                                entirely on the OS/tab-bar navigation
                                already available, same as this app's own
                                bottom tab bar. */}
                            {/* Profile avatar moved to the FRONT (before
                                the scrollable pills, not after them) - a
                                live, confirmed side-by-side comparison
                                against Spotify's own mobile header: its
                                profile circle sits first/leftmost and
                                stays fixed while the "All/Music/Podcasts"
                                pills scroll to its right. Still the same
                                real, fixed (never-scrolls) anchor it
                                already was - only its position in the row
                                changed, not its behavior. */}
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <button
                                    ref={mobileProfileBtnRef}
                                    onClick={() => setMobileProfileOpen((v) => !v)}
                                    aria-label="Profile menu"
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px',
                                        borderRadius: '50%', border: 'none', cursor: 'pointer',
                                        background: mobileConnectedService ? mobileConnectedService.color : 'linear-gradient(135deg, #3B82F6, #8B5CF6, #EC4899)',
                                        color: '#fff',
                                        fontSize: '13px', fontWeight: '800', overflow: 'hidden',
                                    }}
                                >
                                    {mobileConnectedService ? mobileConnectedService.name.charAt(0).toUpperCase() : mobileProfileInitial}
                                </button>
                                {mobileProfileOpen && (
                                    <ProfileMenu
                                        anchorRef={mobileProfileBtnRef} onClose={() => setMobileProfileOpen(false)}
                                        onOpenSettings={() => setActiveView('settings')}
                                        // Real, confirmed gap closed: ConnectionsPanel
                                        // (the only place "Set Active" actually lives)
                                        // used to be reachable only from AudioSidebar's
                                        // own desktop-only footer button - mobile had
                                        // no route to it at all, so a connected service
                                        // there could never actually become the active
                                        // playback source. Local Files also moved here
                                        // off the mobile nav pill row itself (see
                                        // MOBILE_NAV_ITEMS below), per explicit request.
                                        onOpenConnections={() => setConnectionsPanelOpen(true)}
                                        onOpenLocalFiles={() => setActiveView('local')}
                                        placement="bottom-left"
                                    />
                                )}
                            </div>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch',
                                // A real, confirmed follow-up to the fix
                                // above: Back/Profile no longer scroll away
                                // with the pills, but the pill row itself
                                // still visibly hard-clipped mid-label
                                // right at its trailing edge (live-
                                // confirmed: "Pins" cut to just "P") - no
                                // signal that there was more to swipe to,
                                // just an abrupt stop that read as broken/
                                // "boxed off" rather than a genuine
                                // horizontally-scrollable strip. A soft
                                // fade-out mask on the trailing edge is the
                                // standard fix for exactly this (same
                                // pattern iOS/Android's own scrollable chip
                                // rows use) - content now visibly fades
                                // out toward the true edge instead of
                                // being guillotined, reading as "swipe for
                                // more" rather than a rendering glitch.
                                WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
                                maskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
                            }}>
                                {MOBILE_NAV_ITEMS.map((item) => {
                                    const Icon = item.icon;
                                    // 'library' stays highlighted while browsing
                                    // any of its own sub-views (Pins/Recent/
                                    // Artists/Songs/Favourites), not just when
                                    // activeView is literally 'library' - those
                                    // are no longer separate top-level pills of
                                    // their own for this to fall out of naturally.
                                    const active = item.id === 'library' ? LIBRARY_VIEWS.includes(activeView) : activeView === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => setActiveView(item.id)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', flexShrink: 0,
                                                borderRadius: '9999px',
                                                fontWeight: '700', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap',
                                                // Only the active/selected
                                                // pill stays a real, solid
                                                // primary-color chip - the
                                                // same way Spotify/Apple
                                                // Music's own selected tab
                                                // is the one thing that gets
                                                // emphasis. Every INACTIVE
                                                // pill (and the Back button
                                                // above) now has NO fill/
                                                // border at all - a live,
                                                // confirmed report: even
                                                // with blur added,
                                                // var(--widget-bg) still
                                                // read as a distinct tinted
                                                // "box" against a flat
                                                // theme's own plain
                                                // background (blur has
                                                // nothing to diffuse when
                                                // what's behind is one flat
                                                // color) - none of the real
                                                // reference apps put a
                                                // colored chip behind an
                                                // unselected tab either,
                                                // just plain text/icon
                                                // directly on the page.
                                                ...(active
                                                    ? { background: 'var(--primary)', border: '1px solid var(--primary)', color: 'var(--text-on-primary)' }
                                                    : { background: 'transparent', border: 'none', color: 'var(--text-secondary)' }),
                                            }}
                                        >
                                            <Icon size={14} /> {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Unified scroll - the desktop view title now lives
                        INSIDE this same scrolling container (scrolls away
                        with the rest of the page) instead of a separate
                        pinned header row above it, per explicit "Home
                        should scroll with Playlists & Albums, not sit in
                        its own independent area" feedback. Bottom padding
                        reserves room for FloatingBottomPlayer so the last
                        row of content is never permanently hidden behind
                        it. */}
                    <div style={{
                        flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '18px',
                        paddingBottom: isMobile ? '160px' : '110px',
                        // Moved here from the outer page wrapper (was
                        // padding-right there) - see that wrapper's own
                        // comment. Right padding on THIS element (the actual
                        // overflowY:'auto' box) means the scrollbar renders
                        // at its outer edge, flush with the true page edge,
                        // while this padding still keeps the content itself
                        // inset from both the scrollbar and the window edge.
                        paddingRight: isMobile ? 0 : '24px',
                    }}>
                        {!isMobile && (
                            <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, flexShrink: 0 }}>{VIEW_TITLES[activeView]}</h2>
                        )}
                        {/* Real back-navigation gap closed: Pins/Recent/
                            Artists/Songs/Favourites are no longer their own
                            top-level mobile pills - they're only reachable
                            by drilling into the new "Library" pill now, so
                            without this there'd be no way back to that list
                            short of tapping Library again from scratch. Not
                            shown for 'library' itself (already the list,
                            nothing to go "back" to) or on desktop (the real
                            AudioSidebar there still lists every destination
                            as its own permanent row, so there's never a
                            "how do I get back" gap to begin with). */}
                        {isMobile && activeView !== 'library' && LIBRARY_VIEWS.includes(activeView) && (
                            <button
                                onClick={() => setActiveView('library')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '4px', alignSelf: 'flex-start',
                                    background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                                    fontSize: '13px', fontWeight: '700', cursor: 'pointer', padding: '0', flexShrink: 0,
                                }}
                            >
                                <ChevronLeft size={16} /> Library
                            </button>
                        )}
                        {activeViewContent}
                        {/* Real, reported gap closed: this "Playback Queue"
                            section used to render on EVERY browsing view
                            (Home, Search, Recently Played, etc.) - genuinely
                            confusing/redundant showing up everywhere the
                            user looked, since the exact same list is
                            already one tap away from the floating player's
                            own "Up Next" button (QueueDrawer) whenever it's
                            actually needed. Removed entirely rather than
                            scoped to just one view. */}
                    </div>

                    {/* Real, reported bug fixed: moved here (inside this
                        content column, a sibling of the scrolling div
                        above rather than the whole page's outer wrapper) so
                        its own `left: 50%` centers against JUST this
                        content area's real width - excluding the sidebar +
                        resizer to its left - matching the explicit
                        reference screenshot. It stays fixed in place
                        (position:absolute) while the scroll div above it
                        scrolls past underneath, exactly as before - only
                        its horizontal centering anchor changed. */}
                    {/* Real, reported bug fixed: FloatingBottomPlayer used
                        to mount HERE, only ever visible while actually on
                        this page - navigating to any other tab while a
                        track kept playing made it (and every transport
                        control) vanish entirely. It's now mounted once,
                        globally, in DashboardLayout.jsx's own
                        GlobalAudioMiniPlayer instead, so it stays visible
                        across the whole app - nothing left to render
                        here. */}
                </div>
            </div>
        </div>
    );
};

export default AudioHubPage;
