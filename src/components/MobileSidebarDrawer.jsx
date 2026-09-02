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
import { useMicroFeedback } from '../hooks/useMicroFeedback.js';
import { ALL_NAV_ITEMS } from '../constants/navItems.jsx';
import { PRIMARY_TABS } from './MobileTabBar.jsx';

// Names already reachable via the bottom dock (MobileTabBar) - excluded
// here so this drawer only ever lists genuinely SECOND-surface modules,
// per an explicit, reported complaint that Home/Finance/AI/Calendar/
// Settings appeared in both places at once. Imported from MobileTabBar's
// own PRIMARY_TABS (rather than a second hardcoded name list) so the two
// surfaces can never drift back out of sync the way they did before.
const PRIMARY_TAB_NAMES = new Set(PRIMARY_TABS.map((t) => t.name));

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
    // uses, minus whatever's already on the bottom dock (see
    // PRIMARY_TAB_NAMES above).
    const visibleNavItems = ALL_NAV_ITEMS.filter((item) => {
        if (PRIMARY_TAB_NAMES.has(item.name)) return false;
        if (item.essential) return true;
        return activeModules[item.id] !== false;
    });

    const handleNavClick = (tabName) => {
        tabSwitch();
        setActiveTab(tabName);
        onClose();
    };

    // Sized and positioned to exactly match the header's own hamburger
    // toggle button (header.jsx: 34x34px, sitting at the header's own
    // 12px left padding) - a real, confirmed misalignment had these at
    // 52px and centered within the drawer's own width, which put every
    // icon's center ~9px to the right of the toggle button's own center
    // instead of continuing its vertical axis straight down. Matching
    // both the exact size AND left-aligning at the identical 12px offset
    // (rather than centering and relying on the math happening to work
    // out) is what actually guarantees the two line up, not coincidence.
    const itemButtonStyle = (isActive) => ({
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '34px', height: '34px', flexShrink: 0,
        color: isActive ? '#fff' : 'var(--text-muted)',
        background: isActive ? 'rgba(99,102,241,0.2)' : 'transparent',
        border: isActive ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
        borderRadius: '10px', cursor: 'pointer',
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
                    /* top starts BELOW the header, not at 0, on purpose - a
                       real, confirmed visual bug (a dark rectangular "cut
                       box" directly behind the header's own hamburger
                       button whenever this drawer was open) traced back to
                       this aside's own translucent glass panel (--sidebar-
                       bg) sitting directly behind the header's OWN
                       translucent glass panel (--header-bg) in the Dynamic
                       theme - two independently blurred, semi-transparent
                       layers compositing on top of each other reads as a
                       visibly darker, sharp-edged rectangle exactly as wide
                       as this drawer, right where they overlap. It was
                       never a z-index ordering problem (this was already
                       stacked correctly below the header, z-index 401 vs
                       1000) - starting this panel's own box where the
                       header's real, rendered height ends removes the
                       overlap that caused the double-glass stacking in the
                       first place, so there's nothing left to composite
                       into a visible seam. The dimming backdrop just above
                       (full inset:0) is intentionally left alone - a plain
                       flat rgba(0,0,0,0.5) scrim uniformly dims the header
                       too like every other modal-style overlay in this app,
                       with no glass-on-glass layering to produce a hard
                       edge. This max() mirrors header.jsx's own real mobile
                       height exactly, not a guessed number: this app's
                       global `* { box-sizing: border-box }` reset (style.css)
                       means header.jsx's 60px minHeight is a floor on its
                       TOTAL box (padding eats into it, not added on top), so
                       its actual rendered height is whichever is taller -
                       that 60px floor, or its real content (the 34px
                       hamburger button) plus its own real padding (10px top
                       + safe-area-inset-top, 10px bottom) once a device's
                       safe-area grows past a few px, exactly as header.jsx's
                       own comment about Dynamic Island devices describes. */
                    position: 'fixed', top: 'max(60px, calc(54px + env(safe-area-inset-top, 0px)))', left: 0, bottom: 0, zIndex: 401,
                    // Tightly wrapped around the 34px buttons themselves
                    // (12px left padding to match the header + 34px button
                    // + 12px right breathing room) rather than the old
                    // fixed 76px, which was real unused width once the
                    // buttons shrank to match the header toggle's size.
                    width: '58px', background: 'var(--sidebar-bg)',
                    borderRight: '1px solid var(--border-premium)',
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    padding: '20px 0 16px 12px',
                    paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))',
                    paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
                    transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
                    transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: isOpen ? '8px 0 24px rgba(0,0,0,0.25)' : 'none',
                }}
            >
                {/* No separate "X" close button here any more - a real,
                    reported clutter complaint, since it sat as a lone
                    extra control floating above the real nav icons with
                    no counterpart on the desktop sidebar it mirrors.
                    Closing already works two other ways: tapping the same
                    logo button in the header again (onOpenMenu toggles
                    isMobileNavOpen true/false - see header.jsx/
                    DashboardLayout.jsx), or tapping the dimmed backdrop
                    below. */}
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', overflowX: 'hidden', flex: 1, width: '100%', alignItems: 'flex-start', marginTop: 'calc(6px + env(safe-area-inset-top, 0px))' }}>
                    {visibleNavItems.map((item) => (
                        <button
                            key={item.name}
                            onClick={() => handleNavClick(item.name)}
                            title={item.name}
                            style={itemButtonStyle(activeTab === item.name)}
                        >
                            <span style={{ color: activeTab === item.name ? 'var(--primary, #6366f1)' : 'inherit', display: 'flex' }}>
                                <item.icon size={18} />
                            </span>
                        </button>
                    ))}
                </nav>
            </aside>
        </>
    );
};

export default MobileSidebarDrawer;
