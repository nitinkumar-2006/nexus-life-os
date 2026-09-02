// src/components/audio/QueueDrawer.jsx
//
// "Up Next" - clicking the queue icon must NOT change page routing, per
// the redesign spec; instead this slides open as a floating right-side
// drawer wrapping the real QueueManager list (extracted, unchanged logic)
// over a dimming backdrop. A drawer is a real modal-adjacent surface (it
// covers real page width), unlike the small anchored popups elsewhere in
// this app, so a backdrop here is consistent with QuickNotesModal's own
// genuine-modal pattern rather than the popover exception.
//
// Rendered via a portal into document.body (not inline where it's
// invoked) - FloatingBottomPlayer's own outer wrapper has a real CSS
// `transform` on it (for centering), which makes IT the containing block
// for any `position: fixed` descendant instead of the viewport. Without
// the portal this drawer gets trapped inside that small pill instead of
// covering the real right edge of the screen - a real, confirmed bug.
//
// Enter transition driven by useEnterTransition (real state, not a CSS
// `animation` keyframe) - see that hook's own comment for the real bug it
// fixes: FloatingBottomPlayer re-renders continuously during playback
// (currentTime ticks ~once/sec), which was restarting a keyframe-based
// slide-in on every tick and left this drawer permanently stuck OFF-SCREEN
// at its own starting position - genuinely invisible, confirmed live.
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ListMusic } from 'lucide-react';
import QueueManager from './QueueManager.jsx';
import { useEnterTransition } from '../../hooks/useEnterTransition.js';

const QueueDrawer = ({ isOpen, onClose, ...queueProps }) => {
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
                style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1200,
                    opacity: entered ? 1 : 0, transition: 'opacity 0.2s ease',
                }}
            />
            <div
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
                        <ListMusic size={17} color="var(--accent)" />
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>Up Next</h3>
                    </div>
                    <button onClick={onClose} aria-label="Close queue" style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '8px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <X size={15} />
                    </button>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px' }}>
                    <QueueManager {...queueProps} compact />
                </div>
            </div>
        </>,
        document.body
    );
};

export default QueueDrawer;
