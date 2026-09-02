// src/components/audio/LyricsOverlay.jsx
//
// Right-side sliding drawer (same pattern/backdrop as QueueDrawer.jsx),
// not a centered modal - per explicit request, Lyrics must open on the
// right side of the screen and toggle closed on a second click, exactly
// like the Up Next drawer.
//
// Honest empty state: this app has no lyrics API or data source anywhere
// in the codebase, so this drawer never fabricates lyric text - it shows
// the current track/artist and a clear "not available" message instead of
// faking content. The toggle/drawer mechanics themselves are real and
// match the spec; only the actual lyrics content is honestly unavailable.
//
// Rendered via a portal into document.body - see QueueDrawer.jsx's own
// comment for why: FloatingBottomPlayer's transformed outer wrapper
// otherwise traps `position: fixed` descendants inside the small pill
// instead of the real viewport.
//
// Enter transition driven by useEnterTransition (real state, not a CSS
// `animation` keyframe) - see that hook's own comment: FloatingBottomPlayer
// re-renders continuously during playback, which was restarting a
// keyframe-based slide-in on every tick and left this drawer permanently
// stuck OFF-SCREEN, confirmed live.
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, MessageSquare } from 'lucide-react';
import { useEnterTransition } from '../../hooks/useEnterTransition.js';

const LyricsOverlay = ({ isOpen, onClose, currentTrack }) => {
    const entered = useEnterTransition(isOpen);

    useEffect(() => {
        if (!isOpen) return undefined;
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <>
            <div
                onClick={onClose}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1200, opacity: entered ? 1 : 0, transition: 'opacity 0.2s ease' }}
            />
            <div
                role="dialog" aria-label="Lyrics"
                style={{
                    position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(380px, 100vw)',
                    background: 'var(--popover-bg, var(--bg-surface))',
                    backdropFilter: 'blur(max(var(--glass-blur, 20px), 14px)) saturate(105%)',
                    WebkitBackdropFilter: 'blur(max(var(--glass-blur, 20px), 14px)) saturate(105%)',
                    borderLeft: '1px solid var(--border-premium)', boxShadow: '-8px 0 32px rgba(0,0,0,0.25)',
                    zIndex: 1201, display: 'flex', flexDirection: 'column',
                    transform: entered ? 'translateX(0)' : 'translateX(100%)',
                    transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border-premium)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MessageSquare size={17} color="var(--accent)" />
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>Lyrics</h3>
                    </div>
                    <button onClick={onClose} aria-label="Close lyrics" style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '8px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <X size={15} />
                    </button>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' }}>
                    <MessageSquare size={28} color="var(--text-muted)" style={{ marginBottom: '4px' }} />
                    <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{currentTrack?.title || 'No track playing'}</strong>
                    {currentTrack?.artist && (
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{currentTrack.artist}</span>
                    )}
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '10px 0 0 0', maxWidth: '280px' }}>
                        Lyrics aren't available for this track - Nexus OS doesn't have a lyrics data source connected yet.
                    </p>
                </div>
            </div>
        </>,
        document.body
    );
};

export default LyricsOverlay;
