// src/components/sidebar.jsx
//
// Desktop-only. Mobile navigation is handled entirely by MobileTabBar.jsx -
// this component is never rendered below the mobile breakpoint (see
// DashboardLayout.jsx), so it carries no isMobile/drawer branches.
import { useState, useEffect } from 'react';
import { Settings, PanelLeftOpen } from 'lucide-react';
import { useMicroFeedback } from '../hooks/useMicroFeedback.js';
import { ALL_NAV_ITEMS } from '../constants/navItems.jsx';
import SidebarToggleIcon from './SidebarToggleIcon.jsx';

const NexusSidebarComponent = ({ activeTab, setActiveTab, isCollapsed, setIsCollapsed, width = 224, isResizing = false }) => {
    const { tabSwitch } = useMicroFeedback();
    // A real, single, central place every nav click routes through - so
    // every entry point into a tab switch (the main nav list AND the
    // dedicated Settings button below) gets the same feedback without
    // needing to be wired individually at each call site.
    const handleNavClick = (tabName) => {
        tabSwitch();
        setActiveTab(tabName);
    };

    // State to hold which modules are currently active from Settings
    const [activeModules, setActiveModules] = useState({});

    // Function to load settings from LocalStorage
    const loadSettings = () => {
        try {
            const settings = JSON.parse(localStorage.getItem('nexus_global_settings')) || {};
            // If settings exist, use them, otherwise default to all true
            setActiveModules(settings.activeModules || {
                planner: true, study: true, gym: true, diet: true, finance: true, calendar: true, analytics: true, ai: true
            });
        } catch (e) {
            console.error("Failed to load sidebar settings", e);
        }
    };

    // Listen for real-time updates when Settings are saved or Reset
    useEffect(() => {
        loadSettings();
        window.addEventListener('nexus_settings_updated', loadSettings);
        window.addEventListener('storage', loadSettings); // Syncs when cache is cleared

        return () => {
            window.removeEventListener('nexus_settings_updated', loadSettings);
            window.removeEventListener('storage', loadSettings);
        };
    }, []);

    // Filter items: Only show if it's essential OR if it's turned ON in Settings
    const visibleNavItems = ALL_NAV_ITEMS.filter(item => {
        if (item.essential) return true;
        return activeModules[item.id] !== false; // Show by default unless strictly false
    });

    const effectivelyCollapsed = isCollapsed;

    return (
        <aside className="sidebar" style={{
            /* Collapsed width tightened to hug the nav buttons themselves
               (see the button's own comment below) instead of leaving a
               fixed 76px frame around a button that was already smaller
               than that frame - a real, reported "awkward oversized gap"
               around the small collapsed icons. 62px = 12px aside padding
               + the button's own real measured width (24px icon + 6px
               padding each side + 2px border = 38px, live-measured, not
               hand-computed) + 12px aside padding, with no leftover slack.
               Expanded width is now the real, user-resized value (drag
               handle lives in DashboardLayout.jsx, between this and the
               header/content column) instead of a flat 224px. */
            width: isCollapsed ? '62px' : `${width}px`,
            background: 'var(--sidebar-bg)',
            /* backdrop-filter intentionally NOT set inline here - the external
               stylesheet rule matching [style*="var(--sidebar-bg)"] applies it
               (blur + saturate + brightness). An inline declaration would
               override that rule and silently strip out the saturate/
               brightness boost, which is exactly what was causing the
               sidebar to look flatter/muddier than elements without an
               inline backdrop-filter (like the Quick Add popup). */
            display: 'flex', flexDirection: 'column',
            /* Top padding removed here on purpose - it used to be a flat
               28px on this <aside> itself, independent of (and a few
               pixels taller than) the header's own 18px top padding, which
               put the logo's real vertical center a measurable ~8px below
               the header's own icon row instead of on the same axis. The
               dedicated 84px logo band below now owns that alignment
               directly instead of two separately-guessed padding numbers
               drifting apart. */
            padding: isCollapsed ? '0 12px 20px 12px' : '0 16px 20px 16px',
            flexShrink: 0, height: '100%', overflowY: 'auto',
            // "Floating Island" card treatment - rounded corners + a real
            // soft shadow instead of sitting flush against the viewport
            // edge, per explicit request (macOS/iPadOS-style floating
            // panels). DashboardLayout.jsx's own shell padding/gap is what
            // actually creates the surrounding margin; this is just the
            // card's own visual identity.
            borderRadius: '16px', boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
            boxSizing: 'border-box',
            // No width transition while actively dragging the resize
            // handle - otherwise the sidebar visibly lags behind the
            // cursor instead of tracking it 1:1 (same fix AILayout.jsx's
            // own resizable sidebar already uses).
            transition: isResizing ? 'none' : 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
            {/* Logo + sidebar toggle - back in the sidebar itself (a
                    real, reported mistake had this moved to the header
                    instead), redesigned to match a direct, explicit
                    reference to Gemini's own sidebar: collapsed, the logo
                    IS the expand button (no separate icon beside it) -
                    hovering it cross-fades the logo into an "open sidebar"
                    glyph and shows a matching tooltip. That glyph is
                    PanelLeftOpen specifically (not a bare chevron, which
                    was a real, reported mismatch against this exact same
                    icon already used elsewhere) - it's the SAME icon
                    SidebarToggleIcon's own hover state renders (see the AI
                    section's own sidebar rail toggle), so both places in
                    the app show one consistent "open sidebar" glyph
                    instead of two different-looking ones. Expanded, the
                    logo sits with the "Nexus OS" wordmark on the left, and
                    a separate, conventional collapse button (this same
                    shared SidebarToggleIcon component) sits on the right -
                    "Close sidebar" on hover.

                    This band is a fixed 84px tall, flex-centered on purpose
                    - 84px is header.jsx's own real, rendered desktop height
                    (its 84px minHeight is a floor on the TOTAL box under
                    this app's global box-sizing:border-box reset, and its
                    18px/18px padding already fits inside that floor with
                    real content to spare, so the box never grows past it).
                    Centering this logo/toggle within that exact same 84px
                    puts it on the identical real horizontal axis as the
                    header's own icons, instead of relying on two
                    independently-tuned paddings to coincidentally match. */}
            {/* 64px, not 84px - matches header.jsx's own reduced desktop
                minHeight exactly (its "too fat" fix), keeping this logo on
                the identical horizontal axis as the header's own icon row -
                see the original comment on this band for why that match
                matters. */}
            <div style={{ height: '64px', display: 'flex', alignItems: 'center', justifyContent: effectivelyCollapsed ? 'center' : 'flex-start', marginBottom: '16px', flexShrink: 0 }}>
                {effectivelyCollapsed ? (
                    <button
                        type="button"
                        onClick={() => setIsCollapsed(false)}
                        title="Open sidebar"
                        aria-label="Open sidebar"
                        className="sidebar-logo-toggle"
                        style={{ animation: 'nexusSidebarSwapFadeIn 0.2s ease' }}
                    >
                        <span className="sidebar-logo-toggle-visual">
                            <img src="/nexus-logo.svg" alt="Nexus" className="sidebar-logo-toggle-logo" />
                            <PanelLeftOpen className="sidebar-logo-toggle-arrow" />
                        </span>
                    </button>
                ) : (
                    // The fade-in animation (matching the collapsed branch
                    // above) softens the otherwise-instant swap between
                    // these two different DOM nodes into something that
                    // reads as part of the sidebar's own smooth width
                    // transition, not a jump cut. The logo's own size has
                    // grown twice on request (26px -> 34px -> 38px) - it's
                    // deliberately not size-matched to the nav icons below
                    // it (now 24px); the ask has consistently been for the
                    // logo specifically to read as more prominent than the
                    // rest of the header, not to keep sharing one uniform
                    // scale with the nav icons.
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%', paddingLeft: '8px', animation: 'nexusSidebarSwapFadeIn 0.2s ease' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                            <img src="/nexus-logo.svg" alt="Nexus" style={{ width: '38px', height: '38px', objectFit: 'contain', flexShrink: 0 }} />
                            <h2 style={{ fontSize: '17px', fontWeight: '900', letterSpacing: '0.3px', color: '#fff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Nexus OS</h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsCollapsed(true)}
                            title="Close sidebar"
                            aria-label="Close sidebar"
                            style={{
                                width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                            }}
                        >
                            <SidebarToggleIcon isOpen size={17} />
                        </button>
                    </div>
                )}
            </div>

            {/* Dynamic Navigation Links - Settings is now a real,
                ordinary member of this exact same list (same styling), not
                a separately bordered "footer" section pinned to the bottom.

                This nav is a flex:1 child of the <aside> itself (no longer
                wrapped together with the logo band in a plain, non-flex
                div), with justify-content:space-between doing the actual
                vertical distribution: it spreads whatever items exist
                (Home down to Settings) evenly across the FULL remaining
                height below the logo band, growing the gaps between items
                when there are few, shrinking them when there are many -
                self-adapting to however many modules are enabled instead
                of a single fixed gap tuned for one specific item count.
                Because this only ever redistributes existing space rather
                than adding any, it can't itself introduce a scrollbar - the
                one real risk left is the buttons' own total height (icon +
                padding, worst case 13 rows: 12 modules + Settings) still
                exceeding the available height on a short viewport. Icon
                size (24px) and vertical padding (6px) are live-measured
                (not hand-computed - proven unreliable earlier this session)
                at that exact 13-row worst case on a short ~650px viewport:
                a real 32px of margin to spare below the available height,
                not just a bare fit at one specific tested height. */}
            <nav style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: '1 1 auto', minHeight: 0, alignItems: effectivelyCollapsed ? 'center' : 'stretch' }}>
                {visibleNavItems.map((item, index) => (
                    <button
                        key={index}
                        onClick={() => handleNavClick(item.name)}
                        title={effectivelyCollapsed ? item.name : ''}
                        style={{
                            display: 'flex', alignItems: 'center',
                            justifyContent: effectivelyCollapsed ? 'center' : 'flex-start',
                            gap: '12px', padding: effectivelyCollapsed ? '6px' : '6px 12px',
                            color: activeTab === item.name ? '#fff' : 'var(--text-muted)',
                            borderRadius: '12px', fontWeight: '700', fontSize: '15px',
                            background: activeTab === item.name ? 'rgba(99,102,241,0.2)' : 'transparent',
                            border: activeTab === item.name ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
                            width: effectivelyCollapsed ? undefined : '100%', cursor: 'pointer', transition: 'var(--transition)', flexShrink: 0
                        }}
                        onMouseEnter={(e) => { if (activeTab !== item.name) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                        onMouseLeave={(e) => { if (activeTab !== item.name) e.currentTarget.style.background = 'transparent' }}
                    >
                        <span style={{ color: activeTab === item.name ? 'var(--primary, #6366f1)' : 'inherit', display: 'flex', flexShrink: 0 }}>
                            <item.icon size={24} />
                        </span>
                        {!effectivelyCollapsed && <span style={{ whiteSpace: 'nowrap', animation: 'nexusSidebarSwapFadeIn 0.2s ease' }}>{item.name}</span>}
                    </button>
                ))}

                <button
                    onClick={() => handleNavClick('Settings')}
                    title={effectivelyCollapsed ? 'Settings' : ''}
                    style={{
                        display: 'flex', alignItems: 'center',
                        justifyContent: effectivelyCollapsed ? 'center' : 'flex-start',
                        gap: '12px', padding: effectivelyCollapsed ? '6px' : '6px 12px',
                        color: activeTab === 'Settings' ? '#fff' : 'var(--text-muted)',
                        borderRadius: '12px', fontWeight: '700', fontSize: '15px',
                        background: activeTab === 'Settings' ? 'rgba(99,102,241,0.2)' : 'transparent',
                        border: activeTab === 'Settings' ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
                        width: effectivelyCollapsed ? undefined : '100%', cursor: 'pointer', transition: 'var(--transition)', flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { if (activeTab !== 'Settings') e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                    onMouseLeave={(e) => { if (activeTab !== 'Settings') e.currentTarget.style.background = 'transparent' }}
                >
                    <span style={{ color: activeTab === 'Settings' ? 'var(--primary, #6366f1)' : 'inherit', display: 'flex', flexShrink: 0 }}>
                        <Settings size={24} />
                    </span>
                    {!effectivelyCollapsed && <span style={{ whiteSpace: 'nowrap', animation: 'nexusSidebarSwapFadeIn 0.2s ease' }}>Settings</span>}
                </button>
            </nav>
        </aside>
    );
};

export default NexusSidebarComponent;
