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
import { Command, Wallet, Calendar, Cpu, Settings as SettingsIcon } from 'lucide-react';
import { useMicroFeedback } from '../hooks/useMicroFeedback.js';

// A deliberate, standalone 5-item list - not a filtered slice of
// ALL_NAV_ITEMS, since this bar's own fixed 5 slots (unlike the
// drawer's module list) never hide a tab even if the matching module is
// toggled off in the OS Module Manager. Finance/Calendar are still also
// present in ALL_NAV_ITEMS/MobileSidebarDrawer - same intentional dual
// reachability Home already had before this change, not a new pattern.
export const PRIMARY_TABS = [
    { name: 'Home', icon: Command },
    { name: 'Finance', icon: Wallet },
    { name: 'AI', icon: Cpu },
    { name: 'Calendar', icon: Calendar },
    { name: 'Settings', icon: SettingsIcon },
];

const MobileTabBar = ({ activeTab, setActiveTab }) => {
    const { tabSwitch } = useMicroFeedback();

    const handleNav = (tabName) => {
        tabSwitch();
        setActiveTab(tabName);
    };

    const tabButtonStyle = (isActive) => ({
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '4px', padding: '8px 2px', minHeight: '52px',
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: isActive ? 'var(--primary, #6366f1)' : 'var(--text-muted)',
        transition: 'color 0.15s ease',
    });

    return (
        <nav
            aria-label="Primary"
            style={{
                position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 150,
                display: 'flex', alignItems: 'stretch',
                // Literally the same background declaration as header.jsx's
                // own <header> element (var(--header-bg, var(--bg-main))) -
                // deliberate, exact parity, per explicit request: this used
                // to read var(--mobile-nav-bg, ...) instead, a SEPARATE
                // token with its own always-on 0.72 alpha floor (regardless
                // of wallpaper), which made this bar visibly more opaque
                // than the header on the same animated-sky wallpaper at low
                // glass-alpha settings - the header would show the sun/moon
                // through it beautifully while this bar stayed comparatively
                // solid. --header-bg carries no such floor on the sky
                // wallpaper (only a 0.4 floor when a custom image wallpaper
                // is active - see style.css's own
                // .nexus-app-shell[data-custom-wallpaper] rule, which
                // already covers --header-bg too), so switching to it gives
                // this bar the exact same look as the header on every theme,
                // every wallpaper, every glass-alpha value.
                // Trade-off worth knowing: --mobile-nav-bg's 0.72 floor
                // existed specifically because this element is
                // `position: fixed` sitting over another `position: fixed`
                // layer (the sky background), and Safari/WebKit has a
                // documented bug where backdrop-filter on a fixed element
                // doesn't reliably capture another fixed element behind it -
                // confirmed on a real iOS device to read as near-fully
                // see-through even with blur genuinely applied. The header
                // never hit this because it's `position: sticky`, not fixed.
                // This bar is still `position: fixed` (needs to be, to stay
                // pinned through scrolling), so if this reads as unexpectedly
                // transparent on a real iPhone, that WebKit gap - not this
                // change's own logic - is why.
                background: 'var(--header-bg, var(--bg-main))',
                // Real, reported bug: page content scrolling underneath this
                // bar was still legible through it (most noticeably text) -
                // exactly the WebKit "fixed-over-fixed backdrop-filter" gap
                // this file's own comment above already flagged as a risk
                // of the exact-parity-with-header decision. The actual fix
                // is NOT a higher --header-bg opacity floor here - that
                // exact approach was already tried for the header/sidebar
                // and explicitly reverted (see variables.css's own "CUSTOM
                // WALLPAPER CARD CONTRAST FIX" comment): flooring only
                // THIS element's opacity while the page content scrolling
                // up to meet its top edge stays at the user's own real,
                // lower value creates a hard, visible seam right at that
                // boundary. Blur is the safe lever instead - it doesn't
                // change this bar's own tint/opacity at all, just how
                // sharply whatever's behind it resolves, so raising it
                // can't reproduce that seam. Same real, already-proven
                // idiom this app uses elsewhere for a "raise the user's own
                // slider value, never replace it" floor (see variables.css's
                // dawn-contrast and custom-wallpaper max() floors) - applied
                // to --glass-blur, and scoped to just this element via a
                // local custom-property override, so no other glass surface
                // on the page is affected.
                '--glass-blur': 'max(var(--glass-blur, 16px), 28px)',
                borderTop: '1px solid var(--border-premium)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                // No inline boxShadow here on purpose - deliberately
                // matching header.jsx exactly (which also sets none).
                // style.css's own per-sky-phase "light-on-glass signature"
                // rule already targets [style*="var(--sidebar-bg)"] (this
                // exact element) with its own box-shadow (a premium inset
                // glow + var(--premium-shadow)), the SAME rule that gives
                // the header its polished look in Dynamic theme - but an
                // inline boxShadow here always wins over that external
                // rule regardless of CSS specificity, so the generic flat
                // drop-shadow this used to hardcode was silently blocking
                // the real, intended glow from ever rendering. Confirmed
                // live: with the inline value removed, computed
                // box-shadow on this nav now matches the header's
                // byte-for-byte in every sky phase. Solid themes (Night/
                // Comfort/Day) simply end up with no box-shadow at all,
                // same as the header already has there - the border-top
                // above is what provides separation in those themes,
                // exactly like the header's own treatment relies on
                // background contrast alone with no shadow either.
                // Deliberately NO transform/will-change here. A GPU-layer-
                // promotion attempt was tried and reverted - backdrop-
                // filter plus transform on the same element has real,
                // documented WebKit/Blink quirks in some browser versions,
                // and this element's own blur/background already verified
                // as byte-identical to the header's via getComputedStyle
                // without it. Not worth the risk for an unproven gain.
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
