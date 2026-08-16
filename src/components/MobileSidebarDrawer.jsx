// src/components/MobileSidebarDrawer.jsx
//
// Mobile-only compact icon sidebar, opened via the hamburger trigger in
// the mobile header. Deliberately mirrors desktop Sidebar.jsx's own
// COLLAPSED (icon-only, 76px) visual treatment exactly - same button
// shape, active-state highlight, sizing - rather than a full-width
// drawer with text labels, per this request's own explicit "compact,
// icon-only... do NOT expand it with full text labels that cover or
// clutter the mobile screen" ask. Every secondary module (everything
// not in MobileTabBar's own 5-icon primary row) lives here instead of
// the old "More" bottom sheet.
import { useState, useEffect } from 'react';
import { X, Settings } from 'lucide-react';
import { useMicroFeedback } from '../hooks/useMicroFeedback.js';
import { ALL_NAV_ITEMS } from '../constants/navItems.jsx';

const MobileSidebarDrawer = ({ isOpen, onClose, activeTab, setActiveTab }) => {
    const { tabSwitch } = useMicroFeedback();
    const [activeModules, setActiveModules] = useState({});

    useEffect(() => {
        const loadSettings = () => {
            try {
                const settings = JSON.parse(localStorage.getItem('nexus_global_settings')) || {};
                setActiveModules(settings.activeModules || {
                    planner: true, study: true, gym: true, diet: true, finance: true, calendar: true, analytics: true, ai: true
                });
            } catch (e) {
                console.error('Failed to load mobile drawer settings', e);
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

    // Real Escape-to-close, matching every other overlay in this app
    // (ManageSoundsModal, PinVerifyModal, etc).
    useEffect(() => {
        if (!isOpen) return undefined;
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    // Same "essential OR turned on in Settings" filter desktop Sidebar
    // uses, and AI is genuinely reachable here now (it has its own
    // dedicated bottom-tab button too - this is just a second, equally
    // valid entry point, same as Settings already is on both surfaces).
    const visibleNavItems = ALL_NAV_ITEMS.filter((item) => {
        if (item.essential) return true;
        return activeModules[item.id] !== false;
    });

    const handleNavClick = (tabName) => {
        tabSwitch();
        setActiveTab(tabName);
        onClose();
    };

    // Deliberately icon-only, no caption beneath - exactly matching
    // desktop Sidebar.jsx's own collapsed-state button (icon centered,
    // 52px square, title="" for the tooltip), not the bottom tab bar's
    // icon+caption pattern - this is the "compact, icon-only vertical
    // bar (matching the collapsed desktop view)" this request explicitly
    // asks for, not a smaller version of the bottom dock.
    const itemButtonStyle = (isActive) => ({
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '52px', height: '52px', flexShrink: 0,
        color: isActive ? '#fff' : 'var(--text-muted)',
        background: isActive ? 'rgba(99,102,241,0.2)' : 'transparent',
        border: isActive ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
        borderRadius: '14px', cursor: 'pointer',
    });

    return (
        <>
            {/* Backdrop - tap-outside-to-close, same pattern every other
                overlay in this app already uses. */}
            <div
                onClick={onClose}
                aria-hidden="true"
                style={{
                    position: 'fixed', inset: 0, zIndex: 400,
                    background: 'rgba(0,0,0,0.5)',
                    opacity: isOpen ? 1 : 0,
                    pointerEvents: isOpen ? 'auto' : 'none',
                    transition: 'opacity 0.25s ease',
                }}
            />
            <aside
                aria-label="Module navigation"
                style={{
                    position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 401,
                    width: '76px', background: 'var(--sidebar-bg)',
                    borderRight: '1px solid var(--border-premium)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '20px 0 16px 0',
                    paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))',
                    paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
                    transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
                    transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: isOpen ? '8px 0 24px rgba(0,0,0,0.25)' : 'none',
                }}
            >
                <button
                    onClick={onClose}
                    title="Close menu"
                    aria-label="Close menu"
                    style={{
                        width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px', color: '#fff', cursor: 'pointer', flexShrink: 0, marginBottom: '18px',
                    }}
                >
                    <X size={17} />
                </button>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1, width: '100%', alignItems: 'center' }}>
                    {visibleNavItems.map((item) => (
                        <button
                            key={item.name}
                            onClick={() => handleNavClick(item.name)}
                            title={item.name}
                            style={itemButtonStyle(activeTab === item.name)}
                        >
                            <span style={{ color: activeTab === item.name ? 'var(--primary, #6366f1)' : 'inherit', display: 'flex' }}>
                                <item.icon size={22} />
                            </span>
                        </button>
                    ))}
                </nav>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '14px', marginTop: '10px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <button
                        onClick={() => handleNavClick('Settings')}
                        title="Settings"
                        style={itemButtonStyle(activeTab === 'Settings')}
                    >
                        <span style={{ color: activeTab === 'Settings' ? 'var(--primary, #6366f1)' : 'inherit', display: 'flex' }}>
                            <Settings size={22} />
                        </span>
                    </button>
                </div>
            </aside>
        </>
    );
};

export default MobileSidebarDrawer;
