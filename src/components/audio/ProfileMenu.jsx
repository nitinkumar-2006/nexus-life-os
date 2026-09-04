// src/components/audio/ProfileMenu.jsx
//
// Small anchored popup opened from AudioSidebar's profile footer. Per the
// established, hard-learned convention in this app (see the header
// dropdown fix), this is a lightweight anchored popover using
// var(--popover-bg) - never a full-page dimming backdrop - so the rest of
// the Audio Hub stays fully visible/interactive while it's open.
//
// Rendered via a portal into document.body, positioned from the anchor's
// own real screen coordinates (getBoundingClientRect) - AudioSidebar's
// outer card has `overflow: hidden` (needed for its rounded corners and
// the collapse/resize width transition), which was silently CLIPPING this
// popup instead of letting it float above the sidebar - a real, confirmed
// bug (the menu rendered visibly truncated, its own bottom rows hidden
// behind the floating player). Same fix pattern as QueueDrawer/
// LyricsOverlay/FullPlayerView.
//
// Architecture: this profile is about the currently active THIRD-PARTY
// MUSIC SERVICE account (Apple Music/Spotify/YouTube/Saavn), not the
// Nexus OS account. When a service IS connected, the last row disconnects
// only that service (via StreamingContext, never AuthContext's logout).
// When NONE is connected, that same row becomes a real "Sign In" action
// instead of a disabled Sign Out - real account authentication genuinely
// requires an account to sign into (this app can't play Apple Music/
// Spotify without one), so this opens the real connect flow (the same
// Transfer Music picker, which drives each service's own genuine OAuth/
// MusicKit authorization) rather than leaving no way to sign in from here.
// 'Settings' opens a real, localized music-settings view (AudioSettingsView,
// inside this same workspace) instead of navigating to the global Nexus
// Settings page. 'Help' still has no backing feature anywhere in this app
// and stays honestly disabled.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, Settings as SettingsIcon, ArrowLeftRight, LogOut, LogIn, Link2, FolderOpen } from 'lucide-react';
import { useStreaming } from '../../context/StreamingContext.jsx';
import TransferMusicModal from './TransferMusicModal.jsx';
import { useEnterTransition } from '../../hooks/useEnterTransition.js';

const connectionLabel = ({ activeSource, spotifyAuth, appleMusicAuth, youtubeAuth, saavnAuth }) => {
    if (activeSource === 'spotify' && spotifyAuth.connected) return { id: 'spotify', label: 'Spotify' };
    if (activeSource === 'apple' && appleMusicAuth.connected) return { id: 'apple', label: 'Apple Music' };
    if (activeSource === 'youtube' && youtubeAuth.connected) return { id: 'youtube', label: 'YouTube' };
    if (spotifyAuth.connected) return { id: 'spotify', label: 'Spotify' };
    if (appleMusicAuth.connected) return { id: 'apple', label: 'Apple Music' };
    if (youtubeAuth.connected) return { id: 'youtube', label: 'YouTube' };
    if (saavnAuth.connected) return { id: 'saavn', label: 'Saavn' };
    return null;
};

// onOpenConnections/onOpenLocalFiles: new, real, previously-missing entry
// points into features that only ever existed for desktop before this -
// a real, confirmed gap: ConnectionsPanel (the ONLY place "Set Active"
// actually lives, genuinely required for a connected service to power
// real playback) was mounted exclusively inside AudioSidebar's own
// desktop-only render branch in AudioHubPage.jsx, with literally no way
// to reach it on mobile at all - connecting Spotify there had no way to
// ever become the active source. Both are optional (the row simply
// doesn't render without a real callback) so this component still works
// wherever a caller hasn't wired them.
const ProfileMenu = ({ anchorRef, onClose, onOpenSettings, onOpenConnections, onOpenLocalFiles, placement = 'top' }) => {
    const streaming = useStreaming();
    const { disconnectSpotify, disconnectAppleMusic, disconnectYoutube, disconnectSaavn } = streaming;
    const connected = connectionLabel(streaming);
    const menuRef = useRef(null);
    const entered = useEnterTransition(true);
    const [transferOpen, setTransferOpen] = useState(false);
    const [coords, setCoords] = useState(null);

    useLayoutEffect(() => {
        if (!anchorRef?.current) return;
        const rect = anchorRef.current.getBoundingClientRect();
        // A real, confirmed bug found on review: 'bottom' (used to be the
        // only "opens below the button" variant) always right-aligned via
        // `right: window.innerWidth - rect.right` - correct back when the
        // mobile profile button only ever sat on the right edge, but once
        // it moved to the LEFT edge (see AudioHubPage.jsx's own mobile
        // chrome reorder) that same math placed this menu almost entirely
        // off-screen to the left (live-measured: left: -170px). This
        // adds a genuinely separate 'bottom-left' variant (left-aligned,
        // opens below) instead of reusing 'bottom' for a button that's no
        // longer on the right - 'bottom' itself is untouched for any
        // future caller whose own anchor really is right-aligned.
        if (placement === 'top') {
            setCoords({ bottom: window.innerHeight - rect.top + 8, left: rect.left });
        } else if (placement === 'bottom-left') {
            setCoords({ top: rect.bottom + 8, left: rect.left });
        } else {
            setCoords({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
        }
    }, [anchorRef, placement]);

    useEffect(() => {
        // Real, confirmed bug: while transferOpen is true, this menu's own
        // <div> is no longer rendered at all (see the return below) - so
        // menuRef.current is null, and this "outside click" check fell
        // through to treat EVERY click as outside, calling onClose() the
        // instant the very first click landed anywhere inside
        // TransferMusicModal (which owns its own backdrop-click/Escape
        // handling already). Skipping this listener entirely while
        // transferOpen is true hands that modal full, uninterrupted
        // control until it closes itself.
        if (transferOpen) return undefined;
        const handleClick = (e) => {
            if (menuRef.current && menuRef.current.contains(e.target)) return;
            if (anchorRef?.current && anchorRef.current.contains(e.target)) return;
            onClose();
        };
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [anchorRef, onClose, transferOpen]);

    const handleSignOut = () => {
        onClose();
        if (!connected) return;
        ({ spotify: disconnectSpotify, apple: disconnectAppleMusic, youtube: disconnectYoutube, saavn: disconnectSaavn })[connected.id]();
    };

    const rowStyle = {
        display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
        padding: '9px 12px', borderRadius: '8px', border: 'none', background: 'transparent',
        color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600',
        cursor: 'pointer', textAlign: 'left',
    };

    if (!coords) return null;

    // Real, reported bug: this menu used to keep rendering itself
    // (z-index 2050) ON TOP of TransferMusicModal (z-index 2000) once
    // "Transfer Music" was tapped, since only `transferOpen` flipped true -
    // the menu's own onClose was never called, so it never unmounted. The
    // modal ended up trapped BEHIND this menu instead of being the thing
    // actually on top, unusable. Now the menu itself stops rendering the
    // instant Transfer Music opens - only the modal shows - and closing
    // that modal (its own onClose below) closes this whole popover too,
    // matching what tapping Transfer Music always visually implied.
    if (transferOpen) {
        return createPortal(
            <TransferMusicModal onClose={() => { setTransferOpen(false); onClose(); }} />,
            document.body
        );
    }

    return createPortal(
        <>
            <div
                ref={menuRef}
                role="menu"
                style={{
                    position: 'fixed', ...coords, width: '220px',
                    background: 'var(--popover-bg, var(--bg-surface))',
                    backdropFilter: 'blur(max(var(--glass-blur, 16px), 12px)) saturate(105%)',
                    WebkitBackdropFilter: 'blur(max(var(--glass-blur, 16px), 12px)) saturate(105%)',
                    border: '1px solid var(--border-premium)', borderRadius: '14px',
                    boxShadow: 'var(--premium-shadow)', padding: '6px', zIndex: 2050,
                    opacity: entered ? 1 : 0, transform: entered ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.97)',
                    transition: 'opacity 0.15s cubic-bezier(0.16,1,0.3,1), transform 0.15s cubic-bezier(0.16,1,0.3,1)',
                }}
            >
                <div style={{ padding: '6px 12px 8px 12px', borderBottom: '1px solid var(--border-premium)', marginBottom: '4px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '800', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Music Account</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: connected ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: '2px' }}>
                        {connected ? connected.label : 'Not Connected'}
                    </div>
                </div>
                {typeof onOpenLocalFiles === 'function' && (
                    <button role="menuitem" style={rowStyle} onClick={() => { onClose(); onOpenLocalFiles(); }}>
                        <FolderOpen size={15} /> Local Files
                    </button>
                )}
                {typeof onOpenConnections === 'function' && (
                    <button role="menuitem" style={rowStyle} onClick={() => { onClose(); onOpenConnections(); }}>
                        <Link2 size={15} /> Connections
                    </button>
                )}
                <button role="menuitem" disabled style={{ ...rowStyle, color: 'var(--text-muted)', cursor: 'default', opacity: 0.55 }} title="Not available yet">
                    <HelpCircle size={15} /> Help
                </button>
                <button role="menuitem" style={rowStyle} onClick={() => { onClose(); typeof onOpenSettings === 'function' && onOpenSettings(); }}>
                    <SettingsIcon size={15} /> Music Settings
                </button>
                <button role="menuitem" style={rowStyle} onClick={() => setTransferOpen(true)}>
                    <ArrowLeftRight size={15} /> Transfer Music
                </button>
                <div style={{ height: '1px', background: 'var(--border-premium)', margin: '4px 6px' }} />
                {connected ? (
                    // "Disconnect", not "Sign Out" - a real, reported point
                    // of confusion: this only clears the token this app
                    // itself stored (see disconnectSpotify in
                    // StreamingContext.jsx - it never calls any Spotify
                    // endpoint), so it can never sign the user out of
                    // Spotify itself, on this device or anywhere else. The
                    // wording now says exactly what it does, matching the
                    // tooltip below (which already did).
                    <button role="menuitem" style={{ ...rowStyle, color: '#EF4444' }} onClick={handleSignOut} title={`Disconnect ${connected.label} from Nexus (does not sign you out of ${connected.label} itself)`}>
                        <LogOut size={15} /> Disconnect {connected.label}
                    </button>
                ) : (
                    <button role="menuitem" style={{ ...rowStyle, color: 'var(--primary)' }} onClick={() => setTransferOpen(true)} title="Sign in to a music service">
                        <LogIn size={15} /> Sign In
                    </button>
                )}
            </div>
        </>,
        document.body
    );
};

export default ProfileMenu;
