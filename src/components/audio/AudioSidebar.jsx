// src/components/audio/AudioSidebar.jsx
//
// The Audio Hub's own dedicated left sidebar - a standalone floating card
// (rounded corners, backdrop blur, no hard border - just a soft shadow),
// not a flush docked column. Two groups: a top navigation group (Search/
// Home/Ambient Focus/Local Files - see the honest-labeling note below) and
// a Library group beneath it (Pins/Recently Played/Songs/Artists), plus a
// footer showing the live streaming connection status and the real user
// profile (matching header.jsx's own nexus_user_profile localStorage
// source, not a Firebase-only placeholder), which opens ProfileMenu on
// click. Width is drag-resizable (see AudioHubPage.jsx's own
// useResizableSidebar wiring) and the sidebar can collapse to a narrow,
// centered icon-only rail rather than vanishing entirely.
//
// Honest scope note: the source spec asked for literal "New" and "Radio"
// top-nav items and "Albums"/"Made for You" library items. This app has no
// news/curation feed and no radio-station feature, and its mock catalog
// only has 5 playlists behind 2 distinct artist names - there's nothing
// real to put behind those exact four labels without fabricating fake
// screens. Ambient Focus and Local Files (both genuine, already-working
// features) take the top-group slots instead, and Artists/Songs (both
// backed by real data) take the library slots instead of Albums/Made for
// You.
import React, { useRef, useState } from 'react';
import { Search, Home, FolderOpen, Pin, Clock, Music2, Mic2, PanelLeftClose, PanelLeftOpen, Apple, Disc, Video, Headphones, Heart, Link2 } from 'lucide-react';
import { useStreaming } from '../../context/StreamingContext.jsx';
import ProfileMenu from './ProfileMenu.jsx';

// Explicit request: Ambient Focus removed entirely - "iska koi zarurat hi
// nahi hai" (no need for it at all). Its presets/tab (AmbientTab,
// AMBIENT_PRESETS) were also removed from AudioHubPage.jsx.
const TOP_NAV = [
    { id: 'search', label: 'Search', icon: Search },
    { id: 'home', label: 'Home', icon: Home },
    { id: 'local', label: 'Local Files', icon: FolderOpen },
];

const LIBRARY_NAV = [
    { id: 'pins', label: 'Pins', icon: Pin },
    // Real, reported gap: favoriting a track (the "..." menu, the full
    // player's heart button) had nowhere in the whole app to actually go
    // see the resulting list - the heart icons themselves worked
    // correctly (filled in wherever a favorited track was already
    // visible), there was just no dedicated view for it, unlike Pins
    // (favorited playlists) right above.
    { id: 'favorites', label: 'Favourites', icon: Heart },
    { id: 'recent', label: 'Recently Played', icon: Clock },
    { id: 'artists', label: 'Artists', icon: Mic2 },
    { id: 'songs', label: 'Songs', icon: Music2 },
];

export const COLLAPSED_WIDTH = 68;

// Returns the currently active/connected music SERVICE identity (Apple
// Music/Spotify/YouTube/Saavn) - this footer is about that third-party
// account, not the Nexus OS account, per explicit architectural request.
const SERVICE_ICONS = {
    spotify: { icon: Disc, color: '#1DB954' },
    apple: { icon: Apple, color: '#FA233B' },
    youtube: { icon: Video, color: '#FF0000' },
    saavn: { icon: Music2, color: '#2BC5B4' },
};
// `platform` (the actual service name, e.g. "Spotify") is now separate
// from `label` (the friendlier account/profile name when one's known,
// e.g. "Technical Gaming") - a real, reported point of confusion: both
// rows in the footer below used to show the SAME value (the profile name
// twice), so there was nowhere that actually said which platform this
// was connected through.
const connectionInfo = ({ activeSource, spotifyAuth, appleMusicAuth, youtubeAuth, saavnAuth }) => {
    if (activeSource === 'spotify' && spotifyAuth.connected) return { id: 'spotify', platform: 'Spotify', label: spotifyAuth.profileName || 'Spotify' };
    if (activeSource === 'apple' && appleMusicAuth.connected) return { id: 'apple', platform: 'Apple Music', label: 'Apple Music' };
    if (activeSource === 'youtube' && youtubeAuth.connected) return { id: 'youtube', platform: 'YouTube', label: 'YouTube' };
    if (spotifyAuth.connected) return { id: 'spotify', platform: 'Spotify', label: spotifyAuth.profileName || 'Spotify' };
    if (appleMusicAuth.connected) return { id: 'apple', platform: 'Apple Music', label: 'Apple Music' };
    if (youtubeAuth.connected) return { id: 'youtube', platform: 'YouTube', label: 'YouTube' };
    if (saavnAuth.connected) return { id: 'saavn', platform: 'Saavn', label: 'Saavn' };
    return null;
};

const NavItem = ({ item, active, onClick, collapsed }) => {
    const Icon = item.icon;
    return (
        <button
            onClick={() => onClick(item.id)}
            title={collapsed ? item.label : undefined}
            style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: collapsed ? '10px 0' : '8px 10px', borderRadius: '8px', border: 'none',
                background: active ? 'var(--primary-muted)' : 'transparent',
                color: active ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: active ? '800' : '600', fontSize: '13px', cursor: 'pointer',
                textAlign: 'left', transition: 'background 0.15s ease, color 0.15s ease',
            }}
        >
            <Icon size={17} style={{ flexShrink: 0 }} />
            {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>}
        </button>
    );
};

const AudioSidebar = ({ activeView, onSelectView, collapsed, onToggleCollapse, width, onOpenConnections }) => {
    const streaming = useStreaming();
    const connected = connectionInfo(streaming);
    const [menuOpen, setMenuOpen] = useState(false);
    const footerRef = useRef(null);

    const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
    const ServiceIcon = connected ? SERVICE_ICONS[connected.id].icon : Headphones;
    const serviceColor = connected ? SERVICE_ICONS[connected.id].color : null;

    return (
        <div style={{
            width: collapsed ? `${COLLAPSED_WIDTH}px` : `${width}px`, flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column',
            // Floating card, not a flush docked column - real background +
            // a soft shadow instead of a hard 1px border, per explicit
            // request. backdropFilter is set explicitly (not relying on
            // this app's Dynamic-theme-only global blur rule) so the card
            // reads as glass on every theme, not just Dynamic.
            background: 'var(--bg-surface)',
            backdropFilter: 'blur(var(--glass-blur, 20px)) saturate(105%)',
            WebkitBackdropFilter: 'blur(var(--glass-blur, 20px)) saturate(105%)',
            border: 'none', borderRadius: '16px', boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
            boxSizing: 'border-box', overflow: 'hidden',
            transition: 'width 0.15s ease',
        }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: collapsed ? '14px 8px' : '14px 10px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* "Back to Home" MOVED out of this card entirely - real,
                    explicit request: it now lives in the gap between the
                    main app header and this sidebar (see AudioHubPage.jsx's
                    own render, right above where this component mounts).
                    This row now just has the collapse toggle, plus a small
                    "Music" label filling the space that button used to
                    take - per the same request, this sidebar had no
                    identifying label of its own at all before. */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', flexDirection: collapsed ? 'column' : 'row', gap: collapsed ? '8px' : 0, padding: '0 2px' }}>
                    {!collapsed && (
                        <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>Music</span>
                    )}
                    <button
                        type="button" onClick={onToggleCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            width: '30px', height: '30px', borderRadius: '9999px',
                            background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                        }}
                    >
                        <CollapseIcon size={16} />
                    </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {TOP_NAV.map((item) => (
                        <NavItem key={item.id} item={item} active={activeView === item.id} onClick={onSelectView} collapsed={collapsed} />
                    ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {!collapsed && (
                        <div style={{ fontSize: '10px', fontWeight: '800', letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0 10px', marginBottom: '4px' }}>
                            Library
                        </div>
                    )}
                    {collapsed && <div style={{ height: '1px', background: 'var(--border-premium)', margin: '4px 8px' }} />}
                    {LIBRARY_NAV.map((item) => (
                        <NavItem key={item.id} item={item} active={activeView === item.id} onClick={onSelectView} collapsed={collapsed} />
                    ))}
                </div>
                {/* Real, reported gap closed: the 4 streaming-service
                    connect buttons used to sit inline in the Home page's
                    own content, cluttering/overlapping it once 2+ were
                    connected - moved here into a real "Connections" entry
                    that opens a clean modal (ConnectionsPanel) instead. */}
                <button
                    type="button" onClick={onOpenConnections} title="Connections"
                    style={{
                        display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        padding: collapsed ? '10px 0' : '8px 10px', borderRadius: '8px', border: 'none',
                        background: 'transparent', color: 'var(--text-secondary)',
                        fontWeight: '600', fontSize: '13px', cursor: 'pointer', textAlign: 'left',
                    }}
                >
                    <Link2 size={17} style={{ flexShrink: 0 }} />
                    {!collapsed && <span>Connections</span>}
                </button>
            </div>

            {/* Footer - the active THIRD-PARTY MUSIC SERVICE account (Apple
                Music/Spotify/YouTube/Saavn), not the Nexus OS account -
                explicit architectural correction: this profile section
                must handle auth for whichever streaming API is active,
                showing "Not Connected" when none is. Collapses to just the
                icon (centered, no name/status text) to match the icon-only
                rail. */}
            <div ref={footerRef} style={{ flexShrink: 0, borderTop: '1px solid var(--border-premium)', padding: collapsed ? '10px 8px' : '12px', position: 'relative' }}>
                {!collapsed && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 4px 10px 4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: connected ? '#22C55E' : 'var(--text-muted)', flexShrink: 0 }} />
                        <span style={{ fontSize: '11px', fontWeight: '700', color: connected ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                            {connected ? connected.platform : 'Not Connected'}
                        </span>
                    </div>
                )}
                <button
                    onClick={() => setMenuOpen((v) => !v)}
                    title={collapsed ? (connected ? `${connected.platform} · ${connected.label}` : 'Not Connected') : undefined}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        padding: '6px', borderRadius: '10px', border: 'none',
                        background: menuOpen ? 'var(--widget-bg)' : 'transparent', cursor: 'pointer',
                    }}
                >
                    <div style={{
                        width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, position: 'relative',
                        background: connected ? `${serviceColor}22` : 'var(--widget-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    }}>
                        <ServiceIcon size={14} color={connected ? serviceColor : 'var(--text-muted)'} />
                        {collapsed && (
                            <span style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '8px', height: '8px', borderRadius: '50%', background: connected ? '#22C55E' : 'var(--text-muted)', border: '2px solid var(--bg-surface)' }} />
                        )}
                    </div>
                    {!collapsed && (
                        <span style={{ fontSize: '12px', fontWeight: '700', color: connected ? 'var(--text-primary)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {connected ? connected.label : 'Not Connected'}
                        </span>
                    )}
                </button>
                {menuOpen && (
                    <ProfileMenu
                        anchorRef={footerRef}
                        onClose={() => setMenuOpen(false)}
                        onOpenSettings={() => onSelectView('settings')}
                    />
                )}
            </div>
        </div>
    );
};

export default AudioSidebar;
