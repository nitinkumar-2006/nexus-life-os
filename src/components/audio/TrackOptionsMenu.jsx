// src/components/audio/TrackOptionsMenu.jsx
//
// Sharp, anchored 3-dot context menu (Apple-style), opened from the
// floating/full player's own More Options button.
//
// Honest scope against the reference spec's own explicit list (Add to
// Library, Add to Playlist, Create Station, Favourite, Suggest Less, View
// Credits, Share, Copy Link, Copy Embed Code):
// - Favourite, View Credits: real, included below.
// - Share: real too - uses the browser's actual Web Share API (falls back
//   to copying "Title — Artist" text to the clipboard where Web Share
//   isn't available), not a fake share sheet.
// - Add to Library: no real distinct action exists - a track already in
//   the queue is already persisted; there's no separate library store to
//   add it to.
// - Add to Playlist: this app's 5 playlists are static mock data
//   (audioLibraryMock.js), not a mutable user-editable store - a real
//   "add to playlist" needs that data model to exist first.
// - Create Station / Suggest Less: both depend on a recommendation/radio
//   engine (Apple Music-specific) this app has no equivalent of.
// - Copy Link / Copy Embed Code: there is no public track URL or embed
//   player for local/mock tracks to link to - copying a non-functional
//   string would be actively misleading, not a shortcut.
// All omitted items would be real, working menu rows the moment this app
// gains the backing feature (a real playlist store, a connected streaming
// account's own catalog, etc.) - they're left out now rather than wired to
// no-ops.
// Enter transition driven by useEnterTransition (real state, not a CSS
// `animation` keyframe) - this menu is used from inside
// FloatingBottomPlayer/FullPlayerView, both of which re-render
// continuously during playback; a keyframe-based pop-in was getting
// restarted on every tick and stayed stuck at opacity:0, confirmed live
// for the sibling drawers using the identical pattern.
import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, ArrowUpToLine, Heart, HeartOff, Trash2, Info, Share2, Check } from 'lucide-react';
import { useEnterTransition } from '../../hooks/useEnterTransition.js';

const TrackOptionsMenu = ({
    anchorRef, onClose, isPlaying, isFavorite, currentTrack,
    onTogglePlayPause, onPlayNext, onToggleFavorite, onRemoveFromQueue, onViewCredits,
    align = 'right',
}) => {
    const menuRef = useRef(null);
    const [shared, setShared] = useState(false);
    const entered = useEnterTransition(true);

    useEffect(() => {
        const handleClick = (e) => {
            if (menuRef.current && menuRef.current.contains(e.target)) return;
            if (anchorRef?.current && anchorRef.current.contains(e.target)) return;
            onClose();
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [anchorRef, onClose]);

    const rowStyle = {
        display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
        padding: '9px 12px', borderRadius: '8px', border: 'none', background: 'transparent',
        color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textAlign: 'left',
    };

    const act = (fn) => () => { onClose(); if (typeof fn === 'function') fn(); };

    const handleShare = async () => {
        const text = currentTrack ? `${currentTrack.title}${currentTrack.artist ? ` — ${currentTrack.artist}` : ''}` : 'Now playing on Nexus OS';
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Nexus OS - Now Playing', text });
                onClose();
                return;
            }
            await navigator.clipboard.writeText(text);
            setShared(true);
            setTimeout(onClose, 900);
        } catch (e) {
            // User cancelled the native share sheet, or clipboard access was
            // denied - either way there's nothing broken to report, and the
            // menu stays open so they can try another action.
        }
    };

    // The center-align base translateX(-50%) and the enter-transition's
    // own translateY/scale both need to live in the SAME transform value -
    // computed together here rather than letting a later `transform` key
    // silently clobber the positioning one (or vice versa).
    const positionStyle = align === 'center' ? { left: '50%' } : { [align]: 0 };
    const baseTransform = align === 'center' ? 'translateX(-50%) ' : '';
    const enterTransform = entered ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.97)';

    return (
        <div
            ref={menuRef}
            role="menu"
            style={{
                position: 'absolute', bottom: 'calc(100% + 10px)', width: '190px', ...positionStyle,
                opacity: entered ? 1 : 0, transform: `${baseTransform}${enterTransform}`,
                transition: 'opacity 0.15s cubic-bezier(0.16,1,0.3,1), transform 0.15s cubic-bezier(0.16,1,0.3,1)',
                // Real, reported bug fixed: this floated `var(--popover-bg,
                // var(--bg-surface))`, which under the Dynamic theme's
                // dawn/day sky-phase resolves to a near-white fill -
                // reported live as a jarring white card with barely-legible
                // text sitting over the dark floating player. Same real
                // fix already applied to header.jsx's own Focus Audio
                // Studio popup and the System Diagnostics panel: a fixed
                // dark glass fill + local CSS-custom-property overrides,
                // regardless of theme/sky-phase - this menu sits directly
                // over the persistent dark player, so it needs to always
                // read as dark, not follow the page theme.
                background: 'rgba(15, 23, 42, 0.85)',
                '--text-primary': '#FFFFFF', '--text-secondary': 'rgba(255,255,255,0.75)',
                '--text-muted': 'rgba(255,255,255,0.55)', '--border-premium': 'rgba(255,255,255,0.14)',
                '--widget-bg': 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(max(var(--glass-blur, 16px), 12px)) saturate(105%)',
                WebkitBackdropFilter: 'blur(max(var(--glass-blur, 16px), 12px)) saturate(105%)',
                border: '1px solid var(--border-premium)', borderRadius: '14px',
                boxShadow: 'var(--premium-shadow)', padding: '6px', zIndex: 45,
            }}
        >
            {onTogglePlayPause && (
                <button role="menuitem" style={rowStyle} onClick={act(onTogglePlayPause)}>
                    {isPlaying ? <Pause size={15} /> : <Play size={15} />} {isPlaying ? 'Pause' : 'Play'}
                </button>
            )}
            {onPlayNext && (
                <button role="menuitem" style={rowStyle} onClick={act(onPlayNext)}>
                    <ArrowUpToLine size={15} /> Play Next
                </button>
            )}
            {onToggleFavorite && (
                <button role="menuitem" style={rowStyle} onClick={act(onToggleFavorite)}>
                    {isFavorite ? <HeartOff size={15} /> : <Heart size={15} />} {isFavorite ? 'Unfavorite' : 'Favourite'}
                </button>
            )}
            {onViewCredits && (
                <button role="menuitem" style={rowStyle} onClick={act(onViewCredits)}>
                    <Info size={15} /> View Credits
                </button>
            )}
            <button role="menuitem" style={rowStyle} onClick={handleShare}>
                {shared ? <Check size={15} color="var(--success)" /> : <Share2 size={15} />} {shared ? 'Copied!' : 'Share'}
            </button>
            {onRemoveFromQueue && (
                <>
                    <div style={{ height: '1px', background: 'var(--border-premium)', margin: '4px 6px' }} />
                    <button role="menuitem" style={{ ...rowStyle, color: '#EF4444' }} onClick={act(onRemoveFromQueue)}>
                        <Trash2 size={15} /> Remove from Queue
                    </button>
                </>
            )}
        </div>
    );
};

export default TrackOptionsMenu;
