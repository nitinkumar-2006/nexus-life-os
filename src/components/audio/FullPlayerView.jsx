// src/components/audio/FullPlayerView.jsx
//
// The "expand into a full-page player" destination hovering/clicking the
// mini player's album art opens - a real, full-viewport now-playing view
// built entirely from AudioPlayerContext's own live state (big artwork,
// title/artist, transport, progress, and the same Lyrics/Queue/Volume/
// More utilities the mini player has), not a fabricated "Song Profile"
// page with content this app has no real source for.
//
// Rendered via a portal into document.body - see QueueDrawer.jsx's own
// comment for why: FloatingBottomPlayer's transformed outer wrapper
// otherwise traps `position: fixed` descendants inside the small pill
// instead of the real viewport (confirmed live: without the portal this
// view rendered as a ~660x72px box, not a real full-screen overlay).
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    X, Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Repeat1,
    Disc, MessageSquare, ListMusic, Volume2, VolumeX, Volume1, MoreHorizontal, Heart,
} from 'lucide-react';
import VolumePopup from './VolumePopup.jsx';
import QueueDrawer from './QueueDrawer.jsx';
import LyricsOverlay from './LyricsOverlay.jsx';
import TrackOptionsMenu from './TrackOptionsMenu.jsx';
import { useEnterTransition } from '../../hooks/useEnterTransition.js';
import { makeFavoriteKey } from '../../context/AudioPlayerContext.jsx';

const formatTime = (seconds) => {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const GRADIENT_PALETTE = [
    ['#6366F1', '#8B5CF6'], ['#F97316', '#EC4899'], ['#10B981', '#3B82F6'],
    ['#EAB308', '#F97316'], ['#8B5CF6', '#EC4899'], ['#06B6D4', '#6366F1'],
];
const gradientForTrack = (title) => {
    const safe = title && typeof title === 'string' && title.length > 0 ? title : 'default';
    let hash = 0;
    for (let i = 0; i < safe.length; i++) hash = (hash * 31 + safe.charCodeAt(i)) >>> 0;
    const [a, b] = GRADIENT_PALETTE[hash % GRADIENT_PALETTE.length];
    return `linear-gradient(135deg, ${a}, ${b})`;
};

const iconBtn = (extra = {}) => ({
    background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '9px', borderRadius: '10px',
    ...extra,
});

const FullPlayerView = ({
    isOpen, onClose,
    currentTrack, isPlaying, togglePlay, next, prev,
    favoriteTrackTitles, toggleFavoriteTrack, volume, isMuted, toggleMute, setVolume,
    currentTime, duration, seek,
    shuffleEnabled, toggleShuffle, repeatMode, cycleRepeatMode,
    deleteSong, queueProps,
}) => {
    const [volumeOpen, setVolumeOpen] = useState(false);
    const [queueOpen, setQueueOpen] = useState(false);
    const [lyricsOpen, setLyricsOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const volumeBtnRef = useRef(null);
    const moreBtnRef = useRef(null);
    const entered = useEnterTransition(isOpen);

    useEffect(() => {
        if (!isOpen) return undefined;
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Real fix: must compute the exact same source/artist-aware key
    // toggleFavoriteTrack now stores (see makeFavoriteKey's own comment) -
    // checking bare title alone would show every same-titled track as
    // already favorited even when only one of them actually is.
    const isFav = favoriteTrackTitles.has(makeFavoriteKey(currentTrack.title, currentTrack.source || (currentTrack.isLocal ? 'local' : undefined), currentTrack.artist));
    const safeDuration = duration && isFinite(duration) ? duration : 0;
    const clampedTime = Math.min(currentTime, safeDuration);
    const progressPct = safeDuration > 0 ? (clampedTime / safeDuration) * 100 : 0;
    const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;
    const repeatActive = repeatMode === 'one' || repeatMode === 'all';
    const VolIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

    return createPortal(
        <div
            role="dialog" aria-label="Now Playing"
            style={{
                position: 'fixed', inset: 0, zIndex: 200,
                background: 'var(--popover-bg, var(--bg-surface))',
                backdropFilter: 'blur(max(var(--glass-blur, 20px), 24px)) saturate(180%)',
                WebkitBackdropFilter: 'blur(max(var(--glass-blur, 20px), 24px)) saturate(180%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                opacity: entered ? 1 : 0, transform: entered ? 'scale(1)' : 'scale(0.98)',
                transition: 'opacity 0.2s cubic-bezier(0.16,1,0.3,1), transform 0.2s cubic-bezier(0.16,1,0.3,1)',
            }}
        >
            <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', padding: '20px 24px' }}>
                <button onClick={onClose} aria-label="Close full player" style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '9999px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <X size={17} />
                </button>
            </div>

            <div style={{ flex: 1, minHeight: 0, width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px', boxSizing: 'border-box' }}>
                <div style={{
                    width: 'min(280px, 60vw)', height: 'min(280px, 60vw)', borderRadius: '20px',
                    // Same real fix as FloatingBottomPlayer.jsx's mini
                    // artwork tile - a real cover image (Spotify/Saavn/
                    // YouTube) was never once read here either, always the
                    // generated gradient + generic Disc icon regardless.
                    background: currentTrack.artworkUrl ? `url(${currentTrack.artworkUrl}) center/cover` : gradientForTrack(currentTrack.title),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'rgba(255,255,255,0.85)', boxShadow: '0 20px 50px rgba(0,0,0,0.35)', flexShrink: 0,
                }}>
                    {!currentTrack.artworkUrl && <Disc size={72} />}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '28px', width: '100%' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.title}</div>
                        {currentTrack.artist && <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.artist}</div>}
                    </div>
                    <button onClick={() => toggleFavoriteTrack(currentTrack.title, { artist: currentTrack.artist, url: currentTrack.url, uri: currentTrack.uri, source: currentTrack.source || (currentTrack.isLocal ? 'local' : undefined), artworkUrl: currentTrack.artworkUrl })} title={isFav ? 'Unfavorite' : 'Favorite'} style={iconBtn({ flexShrink: 0 })}>
                        <Heart size={20} color={isFav ? '#F43F5E' : 'var(--text-muted)'} fill={isFav ? '#F43F5E' : 'none'} />
                    </button>
                </div>

                <div style={{ width: '100%', marginTop: '18px' }}>
                    <div style={{ position: 'relative', height: '14px', display: 'flex', alignItems: 'center' }}>
                        <div style={{ position: 'absolute', left: 0, right: 0, height: '4px', borderRadius: '4px', background: 'var(--border-premium)', overflow: 'hidden' }}>
                            <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--primary)', transition: 'width 1s linear' }} />
                        </div>
                        <input
                            type="range" min={0} max={safeDuration} step="0.1" value={clampedTime}
                            onChange={(e) => seek(parseFloat(e.target.value))} aria-label="Seek"
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, opacity: 0, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none' }}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>{formatTime(clampedTime)}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>{safeDuration > 0 ? `-${formatTime(Math.max(0, safeDuration - clampedTime))}` : '--:--'}</span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '18px', marginTop: '22px' }}>
                    <button onClick={toggleShuffle} title="Shuffle" style={iconBtn(shuffleEnabled ? { color: 'var(--primary)' } : {})}><Shuffle size={19} /></button>
                    <button onClick={prev} title="Previous" style={iconBtn({ color: 'var(--text-primary)' })}><SkipBack size={22} /></button>
                    <button
                        onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}
                        style={{ background: 'var(--primary)', border: 'none', color: '#fff', borderRadius: '50%', width: '58px', height: '58px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 6px 20px rgba(var(--primary-rgb), 0.4)' }}
                    >
                        {isPlaying ? <Pause size={24} /> : <Play size={24} style={{ marginLeft: '3px' }} />}
                    </button>
                    <button onClick={next} title="Next" style={iconBtn({ color: 'var(--text-primary)' })}><SkipForward size={22} /></button>
                    <button onClick={cycleRepeatMode} title={`Repeat: ${repeatMode}`} style={iconBtn(repeatActive ? { color: 'var(--primary)' } : {})}><RepeatIcon size={19} /></button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '26px', position: 'relative' }}>
                    <button onClick={() => setLyricsOpen((v) => !v)} title="Lyrics" style={iconBtn(lyricsOpen ? { background: 'var(--widget-bg)' } : {})}><MessageSquare size={18} /></button>
                    <button onClick={() => setQueueOpen((v) => !v)} title="Up Next" style={iconBtn(queueOpen ? { background: 'var(--widget-bg)' } : {})}><ListMusic size={18} /></button>
                    {/* Real, reported bug fixed: the volume slider used to
                        render INSIDE this <button> - invalid HTML
                        (interactive content nested inside another
                        interactive element), and the real, concrete
                        symptom was exactly what got reported: dragging/
                        scrolling the range input didn't work reliably,
                        since the button's own hit-testing/click handling
                        can swallow pointer events meant for a nested
                        control. Popup is now a true sibling of the button,
                        inside a plain position:relative wrapper, matching
                        the same real fix applied to FloatingBottomPlayer's
                        own desktop volume button (which never had this bug)
                        and its mobile one (which did). */}
                    <div style={{ position: 'relative' }}>
                        <button ref={volumeBtnRef} onClick={() => setVolumeOpen((v) => !v)} title="Volume" style={iconBtn(volumeOpen ? { background: 'var(--widget-bg)' } : {})}>
                            <VolIcon size={18} />
                        </button>
                        {volumeOpen && (
                            <VolumePopup anchorRef={volumeBtnRef} volume={volume} isMuted={isMuted} setVolume={setVolume} toggleMute={toggleMute} onClose={() => setVolumeOpen(false)} />
                        )}
                    </div>
                    <button ref={moreBtnRef} onClick={() => setMoreOpen((v) => !v)} title="More Options" style={iconBtn(moreOpen ? { background: 'var(--widget-bg)' } : {})}>
                        <MoreHorizontal size={18} />
                    </button>
                    {moreOpen && (
                        <TrackOptionsMenu
                            anchorRef={moreBtnRef} onClose={() => setMoreOpen(false)} isFavorite={isFav}
                            onToggleFavorite={() => toggleFavoriteTrack(currentTrack.title, { artist: currentTrack.artist, url: currentTrack.url, uri: currentTrack.uri, source: currentTrack.source || (currentTrack.isLocal ? 'local' : undefined), artworkUrl: currentTrack.artworkUrl })}
                            onRemoveFromQueue={currentTrack.id ? () => deleteSong(currentTrack.id) : null}
                            onViewCredits={() => setLyricsOpen(true)}
                            currentTrack={currentTrack}
                            align="center"
                        />
                    )}
                </div>
            </div>

            <LyricsOverlay isOpen={lyricsOpen} onClose={() => setLyricsOpen(false)} currentTrack={currentTrack} />
            <QueueDrawer isOpen={queueOpen} onClose={() => setQueueOpen(false)} {...queueProps} />
        </div>,
        document.body
    );
};

export default FullPlayerView;
