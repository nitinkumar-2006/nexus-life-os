// src/components/MobileTabBar.jsx
//
// Native-style mobile navigation: a fixed, minimalist 5-icon bottom
// dock - Home, Audio, AI, Profile, Settings - matching a standard
// industry app's bottom nav (e.g. YouTube's own 5-tab bar). Every other
// module (Planner, Study, Gym, Diet, Finance, Calendar, Analytics,
// Syllabus, Daily Table) lives in MobileSidebarDrawer instead, reached
// via the hamburger next to the Nexus logo in the header - this bar no
// longer owns a "More" sheet at all. This is the ONLY primary
// navigation surface rendered below the mobile breakpoint (see
// DashboardLayout.jsx); the desktop Sidebar never mounts on mobile at
// all.
import { Command, Headphones, Cpu, User, Settings as SettingsIcon } from 'lucide-react';
import { useMicroFeedback } from '../hooks/useMicroFeedback.js';

// A deliberate, standalone 5-item list - not a filtered slice of
// ALL_NAV_ITEMS, since Audio Hub isn't part of that shared list at all
// (desktop reaches it via the header's own Focus Audio Studio shortcut
// instead) and AI is treated here as a fixed, always-present essential
// tab per this request's own explicit "essential tabs: Home, Audio, AI,
// Profile, Settings" spec - unlike the desktop Sidebar/drawer, this bar
// doesn't hide AI even if it's toggled off in the OS Module Manager,
// since it's one of the bar's own fixed 5 slots, not an optional module
// entry.
const PRIMARY_TABS = [
    { name: 'Home', icon: Command },
    { name: 'audio_hub', label: 'Audio', icon: Headphones },
    { name: 'AI', icon: Cpu },
    { name: 'Profile', icon: User },
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
                background: 'var(--sidebar-bg)',
                borderTop: '1px solid var(--border-premium)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                boxShadow: '0 -8px 24px rgba(0,0,0,0.18)',
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
