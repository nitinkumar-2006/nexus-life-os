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

    // Real, reported follow-up: the left-aligned-at-12px approach below
    // (kept for the historical record in this comment) was explicitly
    // rejected on sight - with the rail itself 50px wide and a 36px
    // button pinned to a 10px left offset, the buttons sat only 4px from
    // the rail's own right edge versus 10px from its left, reading as
    // stuck/off-center rather than "continuing the toggle button's own
    // axis" the way this was originally reasoned through ("yeh kone se
    // thoda hat ke hai... chipka chipka lag raha hai"). Centered instead
    // (see the <aside>/<nav> alignItems below) - genuinely equal breathing
    // room on both sides now takes priority over exact pixel-continuity
    // with the header toggle above it. Size also bumped 36px -> 44px/
    // icon 22px -> 26px, a further explicit ask ("icons ko bada karo") -
    // safe to grow right up near the rail's own 50px width once centering
    // (not a fixed left offset) is what's positioning these, since
    // centering auto-adjusts to whatever size the buttons end up being.
    const itemButtonStyle = (isActive) => ({
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '44px', height: '44px', flexShrink: 0,
        color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
        background: isActive ? 'rgba(99,102,241,0.25)' : 'transparent',
        border: isActive ? '1px solid rgba(99,102,241,0.5)' : '1px solid transparent',
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
                       means header.jsx's 48px minHeight is a floor on its
                       TOTAL box (padding eats into it, not added on top), so
                       its actual rendered height is whichever is taller -
                       that 48px floor, or its real content (the 38px icon
                       row) plus its own real padding (4px top +
                       safe-area-inset-top, 4px bottom) once a device's
                       safe-area grows past a few px, exactly as header.jsx's
                       own comment about Dynamic Island devices describes.
                       (Was 60px/54px before header.jsx's own mobile height
                       was cut down for a real "header too tall" complaint -
                       kept in sync by hand since there's no shared CSS var
                       for header.jsx's real rendered height.) */
                    position: 'fixed', top: 'max(48px, calc(46px + env(safe-area-inset-top, 0px)))', left: 0, bottom: 0, zIndex: 401,
                    // Tightly wrapped around the 36px buttons themselves
                    // (10px left padding, 36px button, 4px right breathing
                    // room) - narrowed again 58px -> 50px, a real, reported
                    // follow-up that this rail read as too WIDE for how
                    // small its icons looked ("card zyada chaula ho gaya
                    // hai... patla rakhna hai"), on top of the still-
                    // unresolved legibility fix below.
                    width: '50px',
                    // Real, reported bug (screenshot): var(--sidebar-bg) is
                    // a theme-driven token that on this app's Dynamic sky
                    // theme carries very low alpha - with only blur behind
                    // it, this rail read as almost fully see-through, real
                    // page content bleeding through hard enough that the
                    // icons themselves were barely visible ("bloody aa raha
                    // hai... visual bhi nahi hai"). Same fixed, always-
                    // opaque dark-glass treatment already proven for this
                    // app's other full-viewport mobile overlays (the Focus
                    // Audio Studio / System Panel header popovers, the
                    // audio mini-player dock, the mobile search dropdown) -
                    // a nav rail needs to stay legible over ANY page content
                    // on ANY theme, not blend into whatever's behind it.
                    background: 'rgba(15, 23, 42, 0.9)',
                    backdropFilter: 'blur(max(var(--glass-blur, 20px), 16px)) saturate(180%)',
                    WebkitBackdropFilter: 'blur(max(var(--glass-blur, 20px), 16px)) saturate(180%)',
                    borderRight: '1px solid rgba(255,255,255,0.14)',
                    // Real, reported follow-up: alignItems 'flex-start' +
                    // an asymmetric 10px/0px left/right padding is exactly
                    // what put the buttons visibly closer to this rail's
                    // own right edge than its left ("chipka chipka lag raha
                    // hai") - 'center' now, with both left/right padding
                    // removed so nothing fights the centering, and the
                    // rail's own 50px width is genuinely untouched (this
                    // only changes how the SAME-width rail's own icons are
                    // laid out inside it, never the rail itself).
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    // Real React dev warning caught here: a shorthand
                    // `padding` alongside explicit `paddingTop`/
                    // `paddingBottom` for the same box is an actual React
                    // footgun ("mixing shorthand and non-shorthand
                    // properties... can lead to styling bugs") - React
                    // can't guarantee which one wins on a re-render. Left/
                    // right now live in their own longhands too, so
                    // nothing here overlaps with the safe-area-aware
                    // top/bottom values below.
                    paddingLeft: 0, paddingRight: 0,
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
                {/* Real, reported follow-up: alignItems 'center' (matching
                    the <aside>'s own change above) plus a wider gap
                    (6px -> 12px) - both part of the same centering fix, and
                    the wider gap also genuinely spends more of this rail's
                    height on real content instead of the empty space below
                    the last icon that was reported ("neeche tak kuch nahi
                    hai... thoda neeche tak aa jayega"), on top of the
                    bigger 44px buttons above doing the same. */}
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', overflowX: 'hidden', flex: 1, width: '100%', alignItems: 'center', marginTop: 'calc(6px + env(safe-area-inset-top, 0px))' }}>
                    {visibleNavItems.map((item) => (
                        <button
                            key={item.name}
                            onClick={() => handleNavClick(item.name)}
                            title={item.name}
                            style={itemButtonStyle(activeTab === item.name)}
                        >
                            <span style={{ color: activeTab === item.name ? 'var(--primary, #6366f1)' : 'inherit', display: 'flex' }}>
                                <item.icon size={26} />
                            </span>
                        </button>
                    ))}
                </nav>
            </aside>
        </>
    );
};

export default MobileSidebarDrawer;
