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
const PRIMARY_TABS = [
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
                // --mobile-nav-bg (Dynamic theme only; Night/Comfort/Day
                // fall through to the same solid --sidebar-bg they always
                // used) carries a real opacity floor this exact element
                // needs - see its own definition in variables.css for the
                // confirmed-on-device WebKit reason. Keeping the literal
                // "var(--sidebar-bg)" substring present (as the fallback)
                // is deliberate: style.css's own [style*="var(--sidebar-bg)"]
                // backdrop-filter rule matches on this string, so the blur
                // this nav already had keeps applying on top of the new floor.
                background: 'var(--mobile-nav-bg, var(--sidebar-bg))',
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
