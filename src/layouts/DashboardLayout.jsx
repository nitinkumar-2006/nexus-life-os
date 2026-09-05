// src/layouts/DashboardLayout.jsx
import { useState, useEffect, useRef } from 'react';
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
import { AudioPlayerProvider, useAudioPlayer } from '../context/AudioPlayerContext.jsx';
import { SoundSettingsProvider } from '../context/SoundSettingsContext.jsx';
import { StreamingProvider, useStreaming } from '../context/StreamingContext.jsx';
import FloatingBottomPlayer from '../components/audio/FloatingBottomPlayer.jsx';
import { TaskRegistryProvider } from '../context/TaskRegistryContext.jsx';
import { GlobalUserSettingsProvider } from '../context/GlobalUserSettingsContext.jsx';
import { GLASS_ACCENT_TINTS } from '../constants/glassAccentTints.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { useResizableSidebar } from '../hooks/useResizableSidebar.js';
import { Capacitor } from '@capacitor/core';
import PermissionsOnboarding, { PERMISSIONS_ONBOARDING_KEY } from '../components/PermissionsOnboarding.jsx';

// Explicit correction after a real, reported regression: this was briefly
// made to render on EVERY page (a real attempt to fix the bottom bar
// vanishing when you left the Audio Hub tab) - but that put a SECOND,
// duplicate now-playing card on the Home page (right next to
// GreetingCard's own mini-widget) and left a bar sitting over the bottom
// of every other page too, which was never the ask. Gated back to ONLY
// the Audio Hub tab - matching the app's real, explicit design: the big
// bar belongs to that page alone; every OTHER page reaches "what's
// playing" through the header's own compact Now Playing icon instead
// (see header.jsx) - the same real, minimal pattern desktop's own header
// headphone icon already used, now on mobile too.
//
// Still mounted here (not inside AudioHubPage.jsx) and still a separate
// component (not inlined into DashboardLayout's own body): position:
// fixed + a real document.body portal (see FloatingBottomPlayer.jsx) is
// what actually keeps it correctly anchored to the true viewport instead
// of getting trapped by an ancestor's backdrop-filter/transform - genuine
// fixes worth keeping regardless of visibility scope. A component
// consuming AudioPlayerProvider/StreamingProvider still can't BE the
// component that renders those providers in the same pass, so this stays
// its own child component either way.
const GlobalAudioMiniPlayer = ({ isMobile, activeTab }) => {
    const {
        currentTrack, isPlaying, togglePlay, next, prev,
        favoriteTrackTitles, toggleFavoriteTrack,
        volume, isMuted, toggleMute, setVolume: setLocalVolume,
        currentTime, duration, seek,
        shuffleEnabled, toggleShuffle, repeatMode, cycleRepeatMode,
        deleteSong, moveSong, playlist, currentSongIndex, playAt, durationsByUrl,
    } = useAudioPlayer();
    const { activeSource, spotifySetVolume } = useStreaming();
    // Same Spotify-aware volume wrapper AudioHubPage's own copy used to
    // carry - the SDK has its own separate volume the local <audio>
    // element's setVolume never touches.
    const setVolume = (v) => {
        setLocalVolume(v);
        if (activeSource === 'spotify') spotifySetVolume(v);
    };
    const queueProps = {
        playlist, currentSongIndex, isPlaying,
        togglePlay, playAt, deleteSong, moveSong,
        favoriteTrackTitles, toggleFavoriteTrack, durationsByUrl,
        activeSource,
    };

    // Only mounts once something is genuinely playing - matching every
    // real reference app (Spotify/Apple Music/JioSaavn), none of which
    // show a mini-player with nothing loaded - AND only on the Audio Hub
    // tab itself (see the block comment above).
    if (currentTrack.id === null || activeTab !== 'audio_hub') return null;

    return (
        <FloatingBottomPlayer
            currentTrack={currentTrack} isPlaying={isPlaying} togglePlay={togglePlay} next={next} prev={prev}
            isMobile={isMobile}
            favoriteTrackTitles={favoriteTrackTitles} toggleFavoriteTrack={toggleFavoriteTrack}
            volume={volume} isMuted={isMuted} toggleMute={toggleMute} setVolume={setVolume}
            currentTime={currentTime} duration={duration} seek={seek}
            shuffleEnabled={shuffleEnabled} toggleShuffle={toggleShuffle}
            repeatMode={repeatMode} cycleRepeatMode={cycleRepeatMode}
            deleteSong={deleteSong} queueProps={queueProps}
        />
    );
};

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
    // Real, reported bug: .nexus-page-scroll below is ONE stable div that
    // every page's content renders inside (only its children swap when
    // activeTab changes) - so switching tabs while scrolled down on the
    // page you're leaving landed you on the SAME scroll offset on the
    // page you're arriving at, its own header/top content shoved up out
    // of view above the fold ("cut off from below, jumps in from the
    // top", confirmed live on both the AI and Profile pages). Every
    // other real app resets scroll to the top of a freshly-opened page;
    // this just does the same, explicitly, since nothing else here ever
    // did it implicitly.
    const pageScrollRef = useRef(null);
    useEffect(() => {
        pageScrollRef.current?.scrollTo(0, 0);
        // Belt-and-braces: also reset the actual window/document scroll
        // position, not just this one known container. Real, reported
        // follow-up after the fix above: a stray scroll landing on the
        // window itself (confirmed cause - AIChatArea's own
        // scrollIntoView call, now fixed at the source too) still isn't
        // this container's own scrollTop to reset, and genuinely carried
        // over into whichever page opened next regardless of this
        // effect. Covers that same class of bug from any other future
        // source too, not just the one already found and fixed.
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
    }, [activeTab]);
    // Manual drag-to-resize for the main Sidebar - same proven mechanism
    // already used by the AI page's own sidebar and Audio Hub's sidebar,
    // now under its own storage key/range. Only meaningful when expanded
    // (the collapsed 62px icon rail isn't worth resizing, same reasoning
    // as those other two).
    const { width: sidebarWidth, isDragging: sidebarDragging, handleMouseDown: handleSidebarResizeMouseDown } = useResizableSidebar({
        storageKey: 'nexus_main_sidebar_width', defaultWidth: 224, minWidth: 200, maxWidth: 360,
    });
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

    // Whether Settings' own mobile full-screen category overlay
    // (SettingsLayout.jsx) is currently open - reported up via
    // SettingsPage's onMobileOverlayChange prop. Used below to fold
    // Settings into isHeaderHiddenOnMobile ONLY while that overlay is
    // open, not for the whole tab: the real global header (position:
    // sticky, z-index:1000) sits in the same stacking context as that
    // overlay and was still visibly bleeding through it even at a
    // forced-opaque overlay background - blur softens a letter's edges
    // without erasing the luminance spike behind it, so any translucent
    // layer still let the header ghost through. Actually unmounting the
    // header while the overlay covers the screen is the only fix that
    // doesn't depend on that opacity math, and it's the same mechanism
    // AI/Audio Hub already use below for their own full-screen views.
    const [isSettingsMobileOverlayOpen, setIsSettingsMobileOverlayOpen] = useState(false);

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
    // Real, reported follow-up: see DynamicBackground.jsx's own
    // onRainingChange comment - the phase-reroute alone doesn't give rain
    // enough glass-opacity boost, since its dimming of the actual sky is
    // much milder than a genuine dusk sky. Defaults false so a fresh mount
    // never briefly applies the rain floor before the real weather is known.
    const [isSkyRaining, setIsSkyRaining] = useState(false);

    // Keep `data-theme` on <html> in sync with localStorage on first mount
    // (fixes refreshing the page while on Dynamic theme losing the attribute),
    // and re-sync whenever the theme is changed elsewhere - the Header's cycle
    // button, the Settings page dropdown, or another browser tab.
    useEffect(() => {
        const syncTheme = () => {
            const stored = localStorage.getItem('nexus_theme') || 'night';
            const root = document.documentElement;
            const isRealThemeChange = root.getAttribute('data-theme') !== stored;
            // Real fix for "text goes blurry while switching themes": the
            // glass-surface rule in style.css intentionally transitions
            // backdrop-filter over 2.5s, but that's tuned for the slow,
            // AMBIENT dawn->day->dusk->night sky-phase drift (see
            // DynamicBackground.jsx), where a multi-second blur-radius
            // animation is imperceptible. An explicit, instant theme
            // switch (this button, or Settings' own dropdown) hits that
            // exact same 2.5s transition, so nearby text visibly swims/
            // blurs for that whole window instead of snapping cleanly.
            // Reuses the EXACT same no-initial-transition class
            // index.html already applies once for the analogous
            // first-paint case (same selectors, same transition:none
            // !important) - removed via a real setTimeout, matching that
            // same file's own removeGuard, NOT requestAnimationFrame:
            // rAF callbacks are genuinely suspended by the browser for a
            // backgrounded/non-visible tab, so a switch made (or synced
            // in from another tab) while this one isn't focused would
            // leave the class stuck forever, permanently disabling every
            // glass transition including the ambient sky drift. A short,
            // real timeout still fires regardless of tab visibility.
            if (isRealThemeChange) root.classList.add('no-initial-transition');
            setActiveTheme(stored);
            root.setAttribute('data-theme', stored);
            if (isRealThemeChange) {
                setTimeout(() => root.classList.remove('no-initial-transition'), 60);
            }
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

    // `data-weather-rain` - see DynamicBackground.jsx's onRainingChange and
    // variables.css's own RAIN CONTRAST FLOOR for why this needs to be a
    // separate attribute from data-sky-phase rather than folded into it.
    useEffect(() => {
        if (isDynamic && isSkyRaining) {
            document.documentElement.setAttribute('data-weather-rain', 'true');
        } else {
            document.documentElement.removeAttribute('data-weather-rain');
        }
    }, [isDynamic, isSkyRaining]);

    // Applies the user's saved Animations & Accent/Tint choices at real
    // app startup - without this, a fresh load (or any session where the
    // user never revisits Settings) would silently ignore an
    // already-saved tint/motion preference and fall back to the theme's
    // plain defaults, since SettingsPage's own effect that normally
    // applies these only runs while that page happens to be mounted.
    // Originally ran ONCE with an empty dependency array and no event
    // listener at all - a real, confirmed gap: a Cloud Restore (or a
    // factory-reset restore) that lands new values into
    // nexus_global_settings AFTER this component already mounted would
    // correctly update localStorage, but this effect would never re-fire
    // to actually re-apply them, leaving the live DOM showing stale/
    // default animations & tint until a full page reload. Also switched
    // classList.add-only to classList.toggle and added the missing
    // tint-removal else-branch (mirroring SettingsPage's own equivalent
    // live-apply effect) so turning a setting back off - or restoring a
    // backup that has it off - genuinely un-applies it too, not just
    // ever adds it.
    useEffect(() => {
        const applyAnimationAndTint = () => {
            try {
                const saved = JSON.parse(localStorage.getItem('nexus_global_settings') || '{}');
                const root = document.documentElement;
                root.classList.toggle('nexus-motion-off', saved.glassAnimationsEnabled === false);
                root.classList.toggle('nexus-battery-saver', saved.performanceSaverMode === true);
                const savedTint = GLASS_ACCENT_TINTS.find((t) => t.id === saved.glassAccentTint && t.rgb);
                if (savedTint) {
                    root.style.setProperty('--primary', savedTint.swatch);
                    root.style.setProperty('--primary-rgb', savedTint.rgb);
                    root.style.setProperty('--accent', savedTint.swatch);
                    root.style.setProperty('--nexus-glass-glow-rgb', savedTint.rgb);
                    root.style.setProperty('--nexus-glass-glow-alpha', '0.35');
                } else {
                    root.style.removeProperty('--primary');
                    root.style.removeProperty('--primary-rgb');
                    root.style.removeProperty('--accent');
                    root.style.setProperty('--nexus-glass-glow-alpha', '0');
                }
            } catch (e) {
                /* malformed/missing settings - leave whatever is already applied */
            }
        };
        applyAnimationAndTint();
        window.addEventListener('storage', applyAnimationAndTint);
        window.addEventListener('nexus_settings_updated', applyAnimationAndTint);
        return () => {
            window.removeEventListener('storage', applyAnimationAndTint);
            window.removeEventListener('nexus_settings_updated', applyAnimationAndTint);
        };
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
            case 'Analytics': return <ErrorBoundary moduleName="Analytics" key="Analytics"><AnalyticsPage setActiveTab={setActiveTab} /></ErrorBoundary>;
            case 'AI': return <ErrorBoundary moduleName="AI Assistant" key="AI"><AIPage setActiveTab={setActiveTab} /></ErrorBoundary>;
            case 'Profile': return <ErrorBoundary moduleName="Profile" key="Profile"><ProfilePage /></ErrorBoundary>;
            case 'Settings': return <ErrorBoundary moduleName="Settings" key="Settings"><SettingsPage setActiveTab={setActiveTab} onMobileOverlayChange={setIsSettingsMobileOverlayOpen} /></ErrorBoundary>; // Fully functional settings page render
            case 'audio_hub': return <ErrorBoundary moduleName="Audio Hub" key="AudioHub"><AudioHubPage setActiveTab={setActiveTab} /></ErrorBoundary>;
            case 'weather': return <ErrorBoundary moduleName="Weather Hub" key="Weather"><WeatherPage setActiveTab={setActiveTab} /></ErrorBoundary>;
            default: return <ErrorBoundary moduleName="Home" key="Default"><HomePage setActiveTab={setActiveTab} /></ErrorBoundary>;
        }
    };

    // Shared by both the Header's render condition and the content
    // wrapper's own top padding below - see the padding comment for why
    // both need this exact same condition.
    const isHeaderHiddenOnMobile = isMobile && (activeTab === 'AI' || activeTab === 'audio_hub' || (activeTab === 'Settings' && isSettingsMobileOverlayOpen));

    // The AI page's own redesigned layout (AILayout.jsx) wants to sit
    // flush against the real OS sidebar and header - no gap, using 100%
    // of the remaining space - and manages its own internal scrolling
    // (the message list scrolls, header/input stay pinned) rather than
    // relying on this wrapper's own page-level scroll. Fully edge-to-
    // edge: zero glass-panel padding on every side.
    const isAIFullBleed = activeTab === 'AI';

    // Audio Hub wants a narrower version of the same fix: its
    // MiniPlayerBar wants to sit genuinely flush against the real bottom
    // edge with zero gap, which .glass-panel's own fixed bottom padding
    // structurally can't provide - .glass-panel is display:block and
    // only ever wraps tightly around its content's own height plus its
    // own real padding (32px top / 40px bottom), so any hand-computed
    // "100vh minus N px" calc on the page's own content will always land
    // N-pixels-short of the true bottom by exactly that bottom padding,
    // no matter how the constant is tuned - live-confirmed: the page's
    // own content genuinely reached its calculated height, but glass-
    // panel's own 40px bottom padding still rendered below it as a real,
    // persistent gap no calc constant could close. Unlike AI, this page
    // still wants its normal card-style chrome (top/left/right padding)
    // - only the bottom padding is dropped, reclaimed by the page's own
    // MiniPlayerBar instead, matching AudioHubPage.jsx's own switch to
    // height: '100%' there.
    const isAudioHubFlushBottom = activeTab === 'audio_hub';
    // Both need the same underlying nexus-page-scroll treatment (flex-
    // stretch instead of this wrapper's own page-level scroll, since both
    // pages manage their own internal scrolling) - scoped to just these
    // two tabs so every other module keeps its exact existing padded,
    // page-scrolls layout untouched.
    const isFullBleedModule = isAIFullBleed || isAudioHubFlushBottom;

    return (
        <GlobalUserSettingsProvider>
        <TaskRegistryProvider>
        <SoundSettingsProvider>
            <StreamingProvider>
            <AudioPlayerProvider>
                <div className="nexus-shell-viewport" style={{ position: 'relative', width: '100vw', overflow: 'hidden' }}>
                    {showPermissionsOnboarding && (
                        <PermissionsOnboarding onComplete={() => setShowPermissionsOnboarding(false)} />
                    )}
                    {wallpaper === 'sky' ? (isDynamic && <DynamicBackground onPhaseChange={setSkyPhase} onRainingChange={setIsSkyRaining} isSidebarCollapsed={isCollapsed} />) : <AlternateBackgrounds wallpaper={wallpaper} />}

                    <div
                        className="nexus-app-shell"
                        data-custom-wallpaper={wallpaper !== 'sky' ? 'true' : 'false'}
                        style={{
                            position: 'relative', zIndex: 10,
                            // height:'100vh' removed from here - it's an
                            // inline style, which would always win over
                            // the external .nexus-app-shell CSS rule
                            // (style.css) that now provides the real
                            // 100vh->100dvh mobile-scroll-jitter fix (see
                            // that rule's own comment). The className was
                            // already applied here for other styling;
                            // this is the same class picking up one more
                            // real rule, not a new one being added.
                            display: 'flex',
                            backgroundColor: 'var(--bg-main)',
                            color: 'var(--text-primary)',
                            overflow: 'hidden', boxSizing: 'border-box',
                            // "Floating Island" shell: real, uniform margin
                            // between the Sidebar/Header cards and the
                            // screen edges (this padding). The Sidebar-to-
                            // content gap is NOT a row-level `gap` (that
                            // would double up with the resizer's own 16px
                            // width below) - the resizer element itself
                            // IS that gap, so Sidebar/resizer/content sit
                            // directly adjacent with no extra spacing
                            // between them, and there's still exactly one
                            // real 16px transparent gap total. Both cards
                            // are genuine DOM siblings in one flex row, so
                            // neither can ever overlap the other, unlike
                            // two independently absolutely-positioned
                            // elements would risk. Mobile keeps zero
                            // padding - it has no persistent Sidebar at all
                            // (MobileTabBar + the drawer instead) and its
                            // own Header already has real, separately-tuned
                            // edge-to-edge styling. Reduced 16px -> 10px -
                            // explicit later feedback that the margin
                            // between the cards and the screen edges (and
                            // between the cards themselves) was too large;
                            // this exact value is also what Audio Hub's
                            // own inner sidebar gap now matches (see
                            // AudioHubPage.jsx), so the two read as
                            // consistent everywhere in the app.
                            padding: isMobile ? 0 : '10px',
                        }}
                    >
                        {/* Desktop-only collapsible sidebar. Mobile navigation
                            is MobileTabBar's fixed bottom bar + More sheet
                            below instead - the two are mutually exclusive,
                            never both mounted at once. */}
                        {!isMobile && (
                            <>
                                <Sidebar
                                    activeTab={activeTab} setActiveTab={setActiveTab} isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed}
                                    width={sidebarWidth} isResizing={sidebarDragging}
                                />
                                {/* Drag-to-resize handle - a real, dedicated
                                    gap-filling element (not overlapping
                                    either card), same proven mechanism as
                                    the AI/Audio Hub sidebars. Not rendered
                                    while collapsed - nothing meaningful to
                                    resize in the narrow icon rail, matching
                                    those same two sidebars' own behavior. */}
                                {isCollapsed ? (
                                    <div style={{ width: '10px', flexShrink: 0 }} />
                                ) : (
                                    <div
                                        className={`nexus-sidebar-resizer${sidebarDragging ? ' is-dragging' : ''}`}
                                        onMouseDown={handleSidebarResizeMouseDown}
                                        role="separator" aria-orientation="vertical" aria-label="Resize sidebar"
                                        style={{ width: '10px', margin: 0, flexShrink: 0 }}
                                    />
                                )}
                            </>
                        )}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, gap: isMobile ? 0 : '10px' }}>
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
                            <div
                                ref={pageScrollRef}
                                className="nexus-page-scroll"
                                style={{
                                    flex: 1, minWidth: 0,
                                    ...(isFullBleedModule
                                        ? { display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }
                                        // overscrollBehavior: 'contain' stops the
                                        // elastic rubber-band bounce past this
                                        // container's own scroll boundary (a real
                                        // trackpad/mouse-wheel effect on macOS
                                        // Chrome, not something a scrollTop
                                        // assignment reproduces) - without it, a
                                        // hard scroll-to-bottom gesture can briefly
                                        // push content further up than its actual
                                        // last pixel, exposing whatever sits behind
                                        // MobileTabBar/the header for that instant.
                                        // Applied once here since this is the one
                                        // scroll container every page (Home,
                                        // Finance, Calendar, Study, Settings' own
                                        // list view, etc.) already shares.
                                        : { overflowY: 'auto', willChange: 'scroll-position', overscrollBehavior: 'contain' }),
                                }}
                            >
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
                                    clearing the status bar for them.
                                    isAIFullBleed (AI tab only) drops this
                                    padding to zero entirely and stretches the
                                    panel to fill 100% of the available space -
                                    AILayout.jsx handles its own internal
                                    padding/safe-area/MobileTabBar clearance,
                                    so it can sit genuinely flush against the
                                    real OS sidebar and header instead of
                                    floating inside this padded card like
                                    every other module. isAudioHubFlushBottom
                                    keeps real top/left/right padding (still a
                                    normal padded card there) but drops only
                                    the bottom to 0 and stretches the panel the
                                    same way, so its own MiniPlayerBar can
                                    reach the true bottom edge - AudioHubPage
                                    itself now adds back real mobile bottom
                                    clearance for MobileTabBar (see its own
                                    height: '100%' switch), the same way
                                    AIChatArea's composer already does. */}
                                <div
                                    className="glass-panel"
                                    style={(isAIFullBleed || isAudioHubFlushBottom)
                                        // Audio Hub now shares AI's exact zero-padding
                                        // full-bleed treatment (not just a bottom-only
                                        // exemption) - real, reported feedback that its
                                        // own inner AudioSidebar needs to dock flush
                                        // against the glass-panel's true left/top/
                                        // bottom edges (no dead padding gap floating
                                        // around it), the same way AILayout.jsx already
                                        // sits flush and self-manages its own internal
                                        // clearance. AudioHubPage.jsx's own content
                                        // column (to the right of the sidebar) keeps its
                                        // own real padding, so only the sidebar reads as
                                        // "docked" - the content itself isn't flush.
                                        ? { padding: 0, flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }
                                        : { padding: isMobile ? `${isHeaderHiddenOnMobile ? 'calc(16px + env(safe-area-inset-top, 0px))' : '16px'} 12px calc(76px + env(safe-area-inset-bottom, 0px)) 12px` : '32px 40px 40px 40px' }
                                    }
                                >
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
                        <GlobalAudioMiniPlayer isMobile={isMobile} activeTab={activeTab} />
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