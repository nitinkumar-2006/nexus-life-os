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
import { HelpCircle, Settings as SettingsIcon, ArrowLeftRight, LogOut, LogIn } from 'lucide-react';
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

const ProfileMenu = ({ anchorRef, onClose, onOpenSettings, placement = 'top' }) => {
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
        setCoords(
            placement === 'top'
                ? { bottom: window.innerHeight - rect.top + 8, left: rect.left }
                : { top: rect.bottom + 8, right: window.innerWidth - rect.right }
        );
    }, [anchorRef, placement]);

    useEffect(() => {
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
    }, [anchorRef, onClose]);

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
            {transferOpen && (
                <TransferMusicModal onClose={() => { setTransferOpen(false); onClose(); }} />
            )}
        </>,
        document.body
    );
};

export default ProfileMenu;
