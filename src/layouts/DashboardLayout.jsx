// src/layouts/DashboardLayout.jsx
import { useState, useEffect } from 'react';
import Sidebar from '../components/sidebar.jsx';
import MobileTabBar from '../components/MobileTabBar.jsx';
import MobileSidebarDrawer from '../components/MobileSidebarDrawer.jsx';
import Header from '../components/header.jsx';
import HomePage from '../pages/HomePage.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import TimetablePage from '../pages/TimetablePage.jsx';
import PlannerPage from '../pages/PlannerPage.jsx';
import StudyPage from '../pages/StudyPage.jsx';
import SyllabusPage from '../pages/SyllabusPage.jsx';
import GymPage from '../pages/GymPage.jsx';
import DietPage from '../pages/DietPage.jsx';
import FinancePage from '../pages/FinancePage.jsx';
import CalendarPage from '../pages/CalendarPage.jsx';
import AnalyticsPage from '../pages/AnalyticsPage.jsx';
import AIPage from '../pages/AIPage.jsx';
import ProfilePage from '../pages/ProfilePage.jsx';
import SettingsPage from '../pages/SettingsPage.jsx'; // Imported Settings Page
import AudioHubPage from '../pages/AudioHubPage.jsx';
import WeatherPage from '../pages/WeatherPage.jsx';
import ProtectedModuleGate from '../components/ProtectedModuleGate.jsx';
import DynamicBackground from '../components/DynamicBackground.jsx';
import AlternateBackgrounds from '../components/AlternateBackgrounds.jsx';
import { AudioPlayerProvider } from '../context/AudioPlayerContext.jsx';
import { SoundSettingsProvider } from '../context/SoundSettingsContext.jsx';
import { StreamingProvider } from '../context/StreamingContext.jsx';
import { TaskRegistryProvider } from '../context/TaskRegistryContext.jsx';
import { GlobalUserSettingsProvider } from '../context/GlobalUserSettingsContext.jsx';
import { GLASS_ACCENT_TINTS } from '../constants/glassAccentTints.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { Capacitor } from '@capacitor/core';
import PermissionsOnboarding, { PERMISSIONS_ONBOARDING_KEY } from '../components/PermissionsOnboarding.jsx';

const DashboardLayout = () => {
    // Startup Launchpad: reads the real, saved landing-page preference and
    // maps its display label to the actual module id this layout's own
    // switch statement expects - previously this setting was saved by
    // Settings but never actually read anywhere, so the app always opened
    // to Home regardless of what was selected.
    const [activeTab, setActiveTab] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('nexus_global_settings') || '{}');
            const LANDING_PAGE_TO_TAB = { 'Home Dashboard': 'Home', 'Planner': 'Planner', 'Study Hub': 'Study' };
            return LANDING_PAGE_TO_TAB[saved.landingPage] || 'Home';
        } catch (e) {
            return 'Home';
        }
    });
    const [isCollapsed, setIsCollapsed] = useState(true);
    const isMobile = useIsMobile();
    // First-launch permissions walkthrough (see PermissionsOnboarding.jsx) -
    // native app only (nothing to request in a browser tab) and only ever
    // shown once, gated by its own completion flag in localStorage. Lazy
    // useState initializer so this check runs exactly once, not on every
    // render.
    const [showPermissionsOnboarding, setShowPermissionsOnboarding] = useState(
        () => Capacitor.isNativePlatform() && localStorage.getItem(PERMISSIONS_ONBOARDING_KEY) !== 'true'
    );
    // Compact icon-only mobile drawer (MobileSidebarDrawer) - the
    // hamburger's own open state, session-only like every other panel
    // toggle in this app. Closed automatically on every real nav click
    // inside the drawer itself (see its own handleNavClick).
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

    // --- Dynamic Theme wiring -------------------------------------------------
    // This is the single source of truth for which theme is active. It decides
    // whether the animated sky renders and whether the glassmorphism surfaces
    // in variables.css are turned on.
    const [activeTheme, setActiveTheme] = useState(() => localStorage.getItem('nexus_theme') || 'night');
    const [skyPhase, setSkyPhase] = useState(() => {
        // Computed for real here (mirroring the same logic as the inline
        // script in index.html and DynamicBackground.jsx's own classifyPhase)
        // rather than a hardcoded 'day' default - otherwise this state's
        // own mount-time effect below would briefly stamp the WRONG phase
        // onto <html>, overwriting the correct value the inline script
        // already set before paint, until DynamicBackground's effect
        // reports the real phase a moment later and corrects it again.
        // That extra round-trip was a second contributor to the "flashes
        // to the wrong look on refresh" bug.
        const t = new Date().getHours() + new Date().getMinutes() / 60;
        if (t >= 4 && t < 6.5) return 'dawn';
        if (t >= 6.5 && t < 17) return 'day';
        if (t >= 17 && t < 19.5) return 'dusk';
        return 'night';
    });

    // Keep `data-theme` on <html> in sync with localStorage on first mount
    // (fixes refreshing the page while on Dynamic theme losing the attribute),
    // and re-sync whenever the theme is changed elsewhere - the Header's cycle
    // button, the Settings page dropdown, or another browser tab.
    useEffect(() => {
        const syncTheme = () => {
            const stored = localStorage.getItem('nexus_theme') || 'night';
            setActiveTheme(stored);
            document.documentElement.setAttribute('data-theme', stored);
        };

        syncTheme();
        window.addEventListener('nexus_theme_changed', syncTheme);
        window.addEventListener('nexus_settings_updated', syncTheme);
        window.addEventListener('storage', syncTheme);

        return () => {
            window.removeEventListener('nexus_theme_changed', syncTheme);
            window.removeEventListener('nexus_settings_updated', syncTheme);
            window.removeEventListener('storage', syncTheme);
        };
    }, []);

    const isDynamic = activeTheme === 'dynamic';

    // `data-sky-phase` is what variables.css reads to swap between bright
    // (dawn/day - dark text) and dark (dusk/night - light text) contrast sets.
    // It's only meaningful while the Dynamic theme is active.
    useEffect(() => {
        if (isDynamic) {
            document.documentElement.setAttribute('data-sky-phase', skyPhase);
        } else {
            document.documentElement.removeAttribute('data-sky-phase');
        }
    }, [isDynamic, skyPhase]);

    // Applies the user's saved Animations & Accent/Tint choices at real
    // app startup - without this, a fresh load (or any session where the
    // user never revisits Settings) would silently ignore an
    // already-saved tint/motion preference and fall back to the theme's
    // plain defaults, since SettingsPage's own effect that normally
    // applies these only runs while that page happens to be mounted.
    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('nexus_global_settings') || '{}');
            const root = document.documentElement;
            if (saved.glassAnimationsEnabled === false) root.classList.add('nexus-motion-off');
            if (saved.performanceSaverMode === true) root.classList.add('nexus-battery-saver');
            const savedTint = GLASS_ACCENT_TINTS.find((t) => t.id === saved.glassAccentTint && t.rgb);
            if (savedTint) {
                root.style.setProperty('--primary', savedTint.swatch);
                root.style.setProperty('--primary-rgb', savedTint.rgb);
                root.style.setProperty('--accent', savedTint.swatch);
                root.style.setProperty('--nexus-glass-glow-rgb', savedTint.rgb);
                root.style.setProperty('--nexus-glass-glow-alpha', '0.35');
            }
        } catch (e) {
            /* malformed/missing settings - the app just starts with real, plain defaults */
        }
    }, []);

    // Custom Background / Wallpaper Selector - genuine React state (not
    // just a DOM class like the toggles above) since it determines which
    // actual component renders. Kept live via the same event pattern
    // already established throughout this app, so picking a new
    // wallpaper in Settings swaps the background instantly, with zero
    // page reload.
    const [wallpaper, setWallpaper] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('nexus_global_settings') || '{}').wallpaper || 'sky';
        } catch (e) {
            return 'sky';
        }
    });
    // Which modules currently require a PIN/biometric unlock - the
    // real, live-synced source this round's own new ProtectedModuleGate
    // enforcement reads from. Session-only "already unlocked" state
    // lives separately below, since a person who unlocks Finance once
    // shouldn't have to re-verify every single time they switch back
    // to that same tab within the same session.
    const [lockedModules, setLockedModules] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('nexus_global_settings') || '{}').lockedModules || [];
        } catch (e) {
            return [];
        }
    });
    const [unlockedModules, setUnlockedModules] = useState(() => new Set());
    useEffect(() => {
        const handleUpdate = () => {
            try {
                const saved = JSON.parse(localStorage.getItem('nexus_global_settings') || '{}');
                setWallpaper((prev) => (saved.wallpaper || 'sky') === prev ? prev : (saved.wallpaper || 'sky'));
                setLockedModules(saved.lockedModules || []);
                document.documentElement.classList.toggle('nexus-battery-saver', saved.performanceSaverMode === true);
            } catch (e) { /* malformed settings - keep the current wallpaper rather than clearing it */ }
        };
        window.addEventListener('storage', handleUpdate);
        window.addEventListener('nexus_settings_updated', handleUpdate);
        return () => {
            window.removeEventListener('storage', handleUpdate);
            window.removeEventListener('nexus_settings_updated', handleUpdate);
        };
    }, []);

    // Mirrors the labels SettingsPage.jsx's own LOCKABLE_MODULES uses,
    // so a locked module's own gate shows the same friendly name the
    // person picked it by in Settings, not the raw internal tab id.
    const MODULE_LABELS = {
        Home: 'Home Dashboard', Planner: 'Planner Command Center', 'Daily Table': 'Daily Timetable',
        Study: 'Study Hub', Syllabus: 'Syllabus Tracker', Gym: 'Gym & Fitness', Diet: 'Diet & Nutrition',
        Finance: 'Finance Hub', Calendar: 'Calendar', Analytics: 'Analytics', AI: 'AI Assistant',
        Profile: 'Profile', Settings: 'Settings', audio_hub: 'Audio & Focus Hub',
    };

    const renderActiveModule = () => {
        switch (activeTab) {
            case 'Home': return <ErrorBoundary moduleName="Home" key="Home"><HomePage setActiveTab={setActiveTab} /></ErrorBoundary>;
            case 'Daily Table': return <ErrorBoundary moduleName="Daily Timetable" key="DailyTable"><TimetablePage /></ErrorBoundary>;
            case 'Planner': return <ErrorBoundary moduleName="Planner" key="Planner"><PlannerPage setActiveTab={setActiveTab} /></ErrorBoundary>;
            case 'Study': return <ErrorBoundary moduleName="Study Hub" key="Study"><StudyPage setActiveTab={setActiveTab} /></ErrorBoundary>;
            case 'Syllabus': return <ErrorBoundary moduleName="Syllabus" key="Syllabus"><SyllabusPage /></ErrorBoundary>;
            case 'Gym': return <ErrorBoundary moduleName="Gym" key="Gym"><GymPage /></ErrorBoundary>;
            case 'Diet': return <ErrorBoundary moduleName="Diet" key="Diet"><DietPage /></ErrorBoundary>;
            case 'Finance': return <ErrorBoundary moduleName="Finance" key="Finance"><FinancePage /></ErrorBoundary>;
            case 'Calendar': return <ErrorBoundary moduleName="Calendar" key="Calendar"><CalendarPage /></ErrorBoundary>;
            case 'Analytics': return <ErrorBoundary moduleName="Analytics" key="Analytics"><AnalyticsPage /></ErrorBoundary>;
            case 'AI': return <ErrorBoundary moduleName="AI Assistant" key="AI"><AIPage /></ErrorBoundary>;
            case 'Profile': return <ErrorBoundary moduleName="Profile" key="Profile"><ProfilePage /></ErrorBoundary>;
            case 'Settings': return <ErrorBoundary moduleName="Settings" key="Settings"><SettingsPage setActiveTab={setActiveTab} /></ErrorBoundary>; // Fully functional settings page render
            case 'audio_hub': return <ErrorBoundary moduleName="Audio Hub" key="AudioHub"><AudioHubPage /></ErrorBoundary>;
            case 'weather': return <ErrorBoundary moduleName="Weather Hub" key="Weather"><WeatherPage setActiveTab={setActiveTab} /></ErrorBoundary>;
            default: return <ErrorBoundary moduleName="Home" key="Default"><HomePage setActiveTab={setActiveTab} /></ErrorBoundary>;
        }
    };

    // Shared by both the Header's render condition and the content
    // wrapper's own top padding below - see the padding comment for why
    // both need this exact same condition.
    const isHeaderHiddenOnMobile = isMobile && (activeTab === 'AI' || activeTab === 'audio_hub');

    return (
        <GlobalUserSettingsProvider>
        <TaskRegistryProvider>
        <SoundSettingsProvider>
            <StreamingProvider>
            <AudioPlayerProvider>
                <div style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden' }}>
                    {showPermissionsOnboarding && (
                        <PermissionsOnboarding onComplete={() => setShowPermissionsOnboarding(false)} />
                    )}
                    {wallpaper === 'sky' ? (isDynamic && <DynamicBackground onPhaseChange={setSkyPhase} isSidebarCollapsed={isCollapsed} />) : <AlternateBackgrounds wallpaper={wallpaper} />}

                    <div
                        className="nexus-app-shell"
                        data-custom-wallpaper={wallpaper !== 'sky' ? 'true' : 'false'}
                        style={{
                            position: 'relative', zIndex: 10,
                            display: 'flex', height: '100vh',
                            backgroundColor: 'var(--bg-main)',
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Desktop-only collapsible sidebar. Mobile navigation
                            is MobileTabBar's fixed bottom bar + More sheet
                            below instead - the two are mutually exclusive,
                            never both mounted at once. */}
                        {!isMobile && (
                            <Sidebar
                                activeTab={activeTab} setActiveTab={setActiveTab} isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed}
                            />
                        )}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', minWidth: 0 }}>
                            {/* Real toggle, not a one-way "always open" -
                                this was the actual bug: tapping the same
                                hamburger a second time (while the drawer
                                was already open) called this same handler
                                again, which unconditionally set true onto
                                an already-true value, so nothing visibly
                                changed and the drawer stayed stuck open.
                                Hidden entirely on mobile while on the AI
                                page - that page now owns its own minimal,
                                ChatGPT-style top bar (menu toggle + New
                                Chat) instead, so this global bar would just
                                be redundant chrome eating into the chat's
                                own full-screen space. Bottom-tab navigation
                                (Home/Finance/Calendar/AI/Settings) stays
                                fully reachable regardless - this only
                                removes the secondary hamburger entry point
                                while specifically on this one page.
                                Audio Hub gets the same treatment, per
                                explicit request: its own persistent mini-
                                player bar already sits pinned at the
                                bottom, so this global header was genuinely
                                redundant chrome above an already-compact
                                page, eating into space that matters most on
                                a small screen. Deliberately NOT extended to
                                Profile/Settings (or any other page) - the
                                request was specific to Audio only. */}
                            {!isHeaderHiddenOnMobile && (
                                <Header setActiveTab={setActiveTab} isMobile={isMobile} onOpenMenu={() => setIsMobileNavOpen((v) => !v)} />
                            )}
                            <div style={{ flex: 1, overflowY: 'auto', willChange: 'scroll-position', minWidth: 0 }}>
                                {/* Real, reduced padding on mobile only - the
                                    desktop value (32px 40px 40px 40px) is
                                    completely unchanged; this is the actual
                                    fix for content cards colliding with the
                                    viewport edge on narrow screens. Extra
                                    bottom padding on mobile clears the fixed
                                    MobileTabBar (its own ~52px of tab buttons
                                    plus the device's safe-area inset) so the
                                    last card in any module is never hidden
                                    behind it.
                                    Top padding is status-bar/notch-aware
                                    ONLY when isHeaderHiddenOnMobile - on
                                    every other page the just-fixed Header
                                    above this div already clears the status
                                    bar itself (see header.jsx), so adding
                                    the safe-area inset again here too would
                                    double up into extra dead space below an
                                    already-cleared header. AI/Audio Hub have
                                    no header on mobile, so their own content
                                    starts flush at the very top of
                                    .nexus-app-shell with nothing else
                                    clearing the status bar for them. */}
                                <div className="glass-panel" style={{ padding: isMobile ? `${isHeaderHiddenOnMobile ? 'calc(16px + env(safe-area-inset-top, 0px))' : '16px'} 12px calc(76px + env(safe-area-inset-bottom, 0px)) 12px` : '32px 40px 40px 40px' }}>
                                    <ProtectedModuleGate
                                        moduleId={activeTab}
                                        moduleLabel={MODULE_LABELS[activeTab] || activeTab}
                                        isLocked={lockedModules.includes(activeTab)}
                                        isUnlockedThisSession={unlockedModules.has(activeTab)}
                                        onUnlock={(id) => setUnlockedModules((prev) => new Set(prev).add(id))}
                                    >
                                        {renderActiveModule()}
                                    </ProtectedModuleGate>
                                </div>
                            </div>
                        </div>
                        {isMobile && <MobileTabBar activeTab={activeTab} setActiveTab={setActiveTab} />}
                        {isMobile && (
                            <MobileSidebarDrawer
                                isOpen={isMobileNavOpen}
                                onClose={() => setIsMobileNavOpen(false)}
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                            />
                        )}
                    </div>
                </div>
            </AudioPlayerProvider>
            </StreamingProvider>
        </SoundSettingsProvider>
        </TaskRegistryProvider>
        </GlobalUserSettingsProvider>
    );
};

export default DashboardLayout;