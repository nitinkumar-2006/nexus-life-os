// src/components/audio/VolumePopup.jsx
//
// The volume slider is no longer permanently visible on the floating
// player - per the redesign spec, clicking the speaker icon opens this
// small anchored popup instead. Same var(--popover-bg) pattern as every
// other small popup in this app (not a full-page backdrop).
//
// Enter transition driven by useEnterTransition (real state, not a CSS
// `animation` keyframe) - this popup is used from inside
// FloatingBottomPlayer/FullPlayerView, both of which re-render
// continuously during playback; a keyframe-based pop-in was getting
// restarted on every tick and stayed stuck at opacity:0, confirmed live
// for the sibling drawers using the identical pattern.
import React, { useEffect, useRef } from 'react';
import { Volume2, VolumeX, Volume1 } from 'lucide-react';
import { useEnterTransition } from '../../hooks/useEnterTransition.js';

const VolumePopup = ({ anchorRef, volume, isMuted, setVolume, toggleMute, onClose, placement = 'above' }) => {
    const popupRef = useRef(null);
    const entered = useEnterTransition(true);

    useEffect(() => {
        const handleClick = (e) => {
            if (popupRef.current && popupRef.current.contains(e.target)) return;
            if (anchorRef?.current && anchorRef.current.contains(e.target)) return;
            onClose();
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [anchorRef, onClose]);

    const VolIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

    // Two shapes, chosen by `placement`:
    // - 'above' (default): a small pill popping up above the anchor icon -
    //   used by FullPlayerView and the mobile bottom-row volume button,
    //   where there's no horizontal room to the button's own left/right.
    // - 'left': matches Apple Music's own real desktop mechanism exactly,
    //   confirmed by live-inspecting music.apple.com's actual DOM/CSS
    //   (`.chrome-volume__slider`: `position:absolute; inset-inline-end:
    //   -4px; transform-origin: right center`, toggled via a
    //   `.chrome-volume--expanded` class, `transform: scaleX(0→1)`) - the
    //   button itself never moves; a pill-shaped track fans out
    //   horizontally to its LEFT, vertically centered on the button, and
    //   the artist-line text next to it is never touched or replaced.
    const isLeft = placement === 'left';
    // Real, reported bug in the 'left' variant: it rendered its OWN mute
    // icon button, positioned before (left of) the slider - but Apple's
    // real structure has NO icon inside this sliding piece at all. The
    // already-visible, persistent volume button that opened this popup
    // (a real sibling in FloatingBottomPlayer.jsx, outside this component)
    // IS the only icon - it never moves, and this popup is just a bare
    // track that fans out to its LEFT and butts up against it. Having a
    // second, redundant icon inside the popup itself (on the wrong side of
    // the track relative to that real button) is exactly what read as
    // "the volume icon is on the wrong side".
    return (
        <div
            ref={popupRef}
            style={isLeft ? {
                position: 'absolute', top: '50%', right: 0,
                display: 'flex', alignItems: 'center',
                background: 'var(--widget-bg)',
                backdropFilter: 'blur(max(var(--glass-blur, 16px), 12px)) saturate(105%)',
                WebkitBackdropFilter: 'blur(max(var(--glass-blur, 16px), 12px)) saturate(105%)',
                border: '1px solid var(--border-premium)', borderRadius: '9999px',
                boxShadow: 'var(--premium-shadow)', padding: '0 14px', height: '32px', zIndex: 40,
                transformOrigin: 'right center',
                opacity: entered ? 1 : 0, transform: entered ? 'translateY(-50%) scaleX(1)' : 'translateY(-50%) scaleX(0.6)',
                transition: 'opacity 0.15s cubic-bezier(0.16,1,0.3,1), transform 0.15s cubic-bezier(0.16,1,0.3,1)',
            } : {
                position: 'absolute', bottom: 'calc(100% + 10px)', right: 0,
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'var(--popover-bg, var(--bg-surface))',
                backdropFilter: 'blur(max(var(--glass-blur, 16px), 12px)) saturate(105%)',
                WebkitBackdropFilter: 'blur(max(var(--glass-blur, 16px), 12px)) saturate(105%)',
                border: '1px solid var(--border-premium)', borderRadius: '9999px',
                boxShadow: 'var(--premium-shadow)', padding: '10px 16px', zIndex: 40,
                opacity: entered ? 1 : 0, transform: entered ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.97)',
                transition: 'opacity 0.15s cubic-bezier(0.16,1,0.3,1), transform 0.15s cubic-bezier(0.16,1,0.3,1)',
            }}
        >
            {/* 'above' variant keeps its own mute icon (there's no separate
                persistent button doubling as one in that context) - only
                'left' drops it, per the real Apple structure above. */}
            {!isLeft && (
                <button onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: 0 }}>
                    <VolIcon size={15} />
                </button>
            )}
            <input
                type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                aria-label="Volume"
                className="nexus-volume-range"
                style={{ width: '110px', accentColor: 'var(--primary)' }}
            />
        </div>
    );
};

export default VolumePopup;
