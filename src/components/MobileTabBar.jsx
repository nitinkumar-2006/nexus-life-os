// src/components/MobileTabBar.jsx
//
// Native-style mobile navigation: a fixed bottom tab bar (Home, Planner,
// Study, Finance, Gym) plus a "More" tab that opens a swipe-to-dismiss
// bottom sheet for every other module. Replaces the old hamburger + full-
// height slide-out drawer on mobile - this is the ONLY navigation surface
// rendered below the mobile breakpoint (see DashboardLayout.jsx); the
// desktop Sidebar never mounts on mobile at all. AI is deliberately left
// out of both the bar and the sheet - paused for this mobile pass per
// explicit instruction; the desktop Sidebar/AI tab are completely
// unaffected.
import React, { useState, useEffect } from 'react';
import { Headphones, Settings as SettingsIcon, MoreHorizontal } from 'lucide-react';
import { useMicroFeedback } from '../hooks/useMicroFeedback.js';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss.js';
import { ALL_NAV_ITEMS, MOBILE_PRIMARY_TAB_NAMES } from '../constants/navItems.jsx';

// Not part of ALL_NAV_ITEMS - the desktop Sidebar surfaces these two the
// same way (Settings as its own footer button, Audio Hub only via the
// Header's Focus Audio Studio shortcut), but on mobile the Header hides
// that shortcut entirely, so without an entry here Audio Hub would be
// completely unreachable on mobile. Both live in the More sheet.
const EXTRA_MORE_ITEMS = [
    { name: 'audio_hub', label: 'Audio & Focus', icon: Headphones },
    { name: 'Settings', label: 'Settings', icon: SettingsIcon },
];

const MobileTabBar = ({ activeTab, setActiveTab }) => {
    const { tabSwitch } = useMicroFeedback();
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const [activeModules, setActiveModules] = useState({});

    useEffect(() => {
        const loadSettings = () => {
            try {
                const settings = JSON.parse(localStorage.getItem('nexus_global_settings')) || {};
                setActiveModules(settings.activeModules || {
                    planner: true, study: true, gym: true, diet: true, finance: true, calendar: true, analytics: true, ai: true
                });
            } catch (e) {
                console.error('Failed to load mobile nav settings', e);
            }
        };
        loadSettings();
        window.addEventListener('nexus_settings_updated', loadSettings);
        window.addEventListener('storage', loadSettings);
        return () => {
            window.removeEventListener('nexus_settings_updated', loadSettings);
            window.removeEventListener('storage', loadSettings);
        };
    }, []);

    const { swipeHandlers, translateY, isDragging } = useSwipeToDismiss(() => setIsMoreOpen(false));

    const visibleNavItems = ALL_NAV_ITEMS.filter((item) => {
        if (item.id === 'ai') return false; // paused on mobile
        if (item.essential) return true;
        return activeModules[item.id] !== false;
    });

    const primaryItems = MOBILE_PRIMARY_TAB_NAMES
        .map((name) => visibleNavItems.find((i) => i.name === name))
        .filter(Boolean);

    const moreItems = [
        ...visibleNavItems.filter((item) => !MOBILE_PRIMARY_TAB_NAMES.includes(item.name)),
        ...EXTRA_MORE_ITEMS,
    ];

    const isMoreActive = moreItems.some((item) => item.name === activeTab);

    const handleNav = (tabName) => {
        tabSwitch();
        setActiveTab(tabName);
        setIsMoreOpen(false);
    };

    const tabButtonStyle = (isActive) => ({
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '4px', padding: '8px 2px', minHeight: '52px',
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: isActive ? 'var(--primary, #6366f1)' : 'var(--text-muted)',
        transition: 'color 0.15s ease',
    });

    return (
        <>
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
                {primaryItems.map((item) => (
                    <button key={item.name} onClick={() => handleNav(item.name)} style={tabButtonStyle(activeTab === item.name)}>
                        <item.icon size={22} />
                        <span style={{ fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap' }}>{item.name}</span>
                    </button>
                ))}
                <button onClick={() => setIsMoreOpen(true)} style={tabButtonStyle(isMoreActive || isMoreOpen)}>
                    <MoreHorizontal size={22} />
                    <span style={{ fontSize: '10px', fontWeight: '700' }}>More</span>
                </button>
            </nav>

            {isMoreOpen && (
                <>
                    <div
                        onClick={() => setIsMoreOpen(false)}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 190 }}
                    />
                    <div
                        style={{
                            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 200,
                            background: 'var(--sidebar-bg)',
                            borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
                            borderTop: '1px solid var(--border-premium)',
                            padding: '10px 16px calc(20px + env(safe-area-inset-bottom, 0px)) 16px',
                            maxHeight: '70vh', overflowY: 'auto',
                            boxShadow: '0 -12px 40px rgba(0,0,0,0.35)',
                            transform: `translateY(${translateY}px)`,
                            transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                            animation: 'nexusSheetSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                    >
                        <div {...swipeHandlers} style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 12px 0' }}>
                            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border-premium)' }} />
                        </div>
                        <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 4px 14px 4px' }}>More</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                            {moreItems.map((item) => (
                                <button
                                    key={item.name}
                                    onClick={() => handleNav(item.name)}
                                    style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                                        padding: '14px 6px', minHeight: '76px', borderRadius: '16px',
                                        background: activeTab === item.name ? 'rgba(99,102,241,0.18)' : 'var(--widget-bg)',
                                        border: activeTab === item.name ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--border-premium)',
                                        color: activeTab === item.name ? 'var(--primary, #6366f1)' : 'var(--text-primary)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <item.icon size={20} />
                                    <span style={{ fontSize: '11px', fontWeight: '700', textAlign: 'center', lineHeight: '1.2' }}>{item.label || item.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export default MobileTabBar;
