// src/components/MobileTabBar.jsx
//
// Native-style mobile navigation: a fixed, minimalist 5-icon bottom
// dock - Home, Finance, AI, Calendar, Settings, matching a standard
// industry app's bottom nav (e.g. YouTube's own 5-tab bar). Audio and
// Profile were dropped from this bar per an explicit request: Audio
// already has its own real entry point (the "Manage Playlist & Queue"
// button on the Home page's GreetingCard, which calls the exact same
// setActiveTab('audio_hub') this bar used to), and Profile already has
// its own real entry point too (the header's own avatar, every screen
// size - see header.jsx's onClick={() => setActiveTab('Profile')} on its
// avatar block) - neither module actually lost its only way in, they
// just stopped needing a *second* one taking up a bottom-dock slot.
// Every other module (Planner, Study, Gym, Diet, Analytics, Syllabus,
// Daily Table) still lives in MobileSidebarDrawer, reached via the
// hamburger next to the Nexus logo in the header - this bar still
// doesn't own a "More" sheet. This is the ONLY primary navigation
// surface rendered below the mobile breakpoint (see
// DashboardLayout.jsx); the desktop Sidebar never mounts on mobile at
// all.
import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Command, Wallet, Calendar, Cpu, Settings as SettingsIcon, BarChart2 } from 'lucide-react';
import { useMicroFeedback } from '../hooks/useMicroFeedback.js';

// A deliberate, standalone 5-item list - not a filtered slice of
// ALL_NAV_ITEMS, since this bar's own fixed 5 slots (unlike the
// drawer's module list) never hide a tab even if the matching module is
// toggled off in the OS Module Manager. Finance/Calendar are still also
// present in ALL_NAV_ITEMS/MobileSidebarDrawer - same intentional dual
// reachability Home already had before this change, not a new pattern.
//
// Real, reported follow-up: Finance's SMS auto-detect permissions were
// removed from the native Android build entirely (see AndroidManifest.
// xml), and SettingsPage.jsx's own defaultSettings now defaults the
// Finance module itself to off there too - a dock slot permanently
// pointing at a module that's off by default on that exact build would
// be a dead tab for anyone who hasn't manually re-enabled it. Analytics
// (Analysis Hub) takes that slot specifically on the native build, per
// explicit request for what should fill it; desktop/mobile-web keep
// Finance exactly as before - this was never a problem there.
export const PRIMARY_TABS = Capacitor.isNativePlatform()
    ? [
        { name: 'Home', icon: Command },
        { name: 'Analytics', icon: BarChart2 },
        { name: 'AI', icon: Cpu },
        { name: 'Calendar', icon: Calendar },
        { name: 'Settings', icon: SettingsIcon },
    ]
    : [
        { name: 'Home', icon: Command },
        { name: 'Finance', icon: Wallet },
        { name: 'AI', icon: Cpu },
        { name: 'Calendar', icon: Calendar },
        { name: 'Settings', icon: SettingsIcon },
    ];

const MobileTabBar = ({ activeTab, setActiveTab }) => {
    const { tabSwitch } = useMicroFeedback();
    const navRef = useRef(null);

    const handleNav = (tabName) => {
        tabSwitch();
        setActiveTab(tabName);
    };

    // Real, measured height (not the sum of the padding/minHeight values
    // read off this file, which don't actually add up to the live
    // rendered box - flex `alignItems:stretch` plus content sizing makes
    // the true number a runtime fact, not something safely hand-
    // calculated - and it changes per device via
    // env(safe-area-inset-bottom) on a notched phone). Published as a
    // CSS custom property on the root element so FloatingBottomPlayer.jsx
    // can dock its own mobile mini-player flush against this bar's real
    // top edge (explicit request: the mini-player must sit directly on
    // top of this bar, not float above it with a visible gap) without
    // hardcoding a guessed pixel value that would drift out of sync the
    // next time this bar's own padding/sizing changes. ResizeObserver
    // (not a one-time effect) keeps it correct across an orientation
    // change or a safe-area value that only becomes available after
    // first paint.
    useEffect(() => {
        const el = navRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const setHeightVar = () => {
            document.documentElement.style.setProperty('--mobile-tabbar-height', `${el.getBoundingClientRect().height}px`);
        };
        setHeightVar();
        const observer = new ResizeObserver(setHeightVar);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // minHeight/padding trimmed 52px/8px -> 44px/5px - explicit, repeated
    // feedback that this bar also read as vertically oversized (alongside
    // the header, see header.jsx's own matching cut) on a real device;
    // still comfortably fits the 22px icon + 10px label + 4px gap content
    // (~40px) with a couple px of breathing room either side.
    const tabButtonStyle = (isActive) => ({
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '4px', padding: '5px 2px', minHeight: '44px',
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: isActive ? 'var(--primary, #6366f1)' : 'var(--text-muted)',
        transition: 'color 0.15s ease',
    });

    return (
        <nav
            ref={navRef}
            aria-label="Primary"
            style={{
                position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 150,
                display: 'flex', alignItems: 'stretch',
                // SUPERSEDES the previous var(--header-bg)-parity approach
                // (kept failing for real: inconsistent blur/alpha across
                // theme + sky-phase combos, confirmed live via repeated
                // real-device screenshots - "kahin blurred ho jata hai,
                // kahin icon white ho jata hai"). Explicit follow-up
                // request instead: make this bar use the EXACT SAME
                // background/blur as FloatingBottomPlayer.jsx's mini-player
                // pill directly above it (byte-for-byte copy of that file's
                // own background/backdropFilter/text-color-token block),
                // since that pill was already confirmed to look right and
                // stay legible on every theme/wallpaper the user tested.
                // A fixed, non-token dark glass tint - not derived from
                // --header-bg/--nexus-user-glass-alpha at all anymore - so
                // it can no longer go pale/washed-out in a bright Dynamic
                // sky-phase or a light custom wallpaper the way the
                // token-driven version did. Local CSS-custom-property
                // overrides for --text-muted/--primary-adjacent colors
                // below make the tab icons/labels themselves match the
                // mini-player's own always-legible light-on-dark palette
                // too, not just the background tile.
                background: 'rgba(15, 23, 42, 0.6)',
                '--text-muted': 'rgba(255,255,255,0.55)',
                '--border-premium': 'rgba(255,255,255,0.14)',
                backdropFilter: 'blur(max(var(--glass-blur, 20px), 20px)) saturate(180%)',
                WebkitBackdropFilter: 'blur(max(var(--glass-blur, 20px), 20px)) saturate(180%)',
                borderTop: '1px solid var(--border-premium)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                // No boxShadow here on purpose, same as FloatingBottomPlayer's
                // own pill directly above - the borderTop is what separates
                // this bar from content in every theme now, no per-sky-phase
                // shadow variance to keep in parity with anymore since the
                // background itself is fixed rather than theme-driven.
                // Deliberately NO transform/will-change here. A GPU-layer-
                // promotion attempt was tried and reverted - backdrop-
                // filter plus transform on the same element has real,
                // documented WebKit/Blink quirks in some browser versions.
            }}
        >
            {PRIMARY_TABS.map((item) => (
                <button key={item.name} onClick={() => handleNav(item.name)} style={tabButtonStyle(activeTab === item.name)}>
                    <item.icon size={22} />
                    <span style={{ fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap' }}>{item.label || item.name}</span>
                </button>
            ))}
        </nav>
    );
};

export default MobileTabBar;
