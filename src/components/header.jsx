// src/components/header.jsx
import React, { useState, useEffect, useRef } from 'react';
import { 
    Search, Bell, Moon, Sun, Cpu, Command, CheckSquare, BookOpen, 
    Dumbbell, Apple, Wallet, Calendar, BarChart2, FileText, User, 
    Plus, Headphones, Sparkles, Flame, Zap, Cloud, Settings as SettingsIcon, X, Play, Pause, SkipForward, SkipBack, ListMusic, StickyNote
} from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext.jsx';
import { useMicroFeedback } from '../hooks/useMicroFeedback.js';
import QuickNotesModal from './QuickNotesModal.jsx';
const Header = ({ setActiveTab, isMobile }) => {
    const { click: playClickFeedback, modalOpen } = useMicroFeedback();
    // A single, delegated click handler on the header's own root element
    // covers every real button within it - the 4 left-section shortcuts,
    // the 6 right-section utility icons, and any button nested inside
    // their own dropdown/popup panels (Quick Add, Quick Notes, Focus
    // Audio, Notifications) - without needing 10+ individual onClick
    // edits, and without missing anything added to this header later.
    // Capture phase (not bubble) so this reliably fires even if a
    // specific button's own handler calls stopPropagation().
    const handleHeaderClickCapture = (e) => {
        if (e.target.closest('button')) playClickFeedback();
    };
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    // Which result is currently highlighted for keyboard navigation -
    // -1 means nothing selected yet (so a bare Enter with no arrow-key
    // press first doesn't silently jump to an arbitrary result).
    const [selectedIndex, setSelectedIndex] = useState(-1);
    // Targets the real <input> itself for genuine, real focus() calls -
    // kept separate from searchRef below, which wraps the whole
    // search+dropdown block and is only ever used for the existing
    // click-outside-to-close detection, not for focusing anything.
    const searchInputRef = useRef(null);
    
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [isAudioOpen, setIsAudioOpen] = useState(false);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const [isQuickNotesOpen, setIsQuickNotesOpen] = useState(false);
    
    const [quickTitle, setQuickTitle] = useState("");
    const [quickCategory, setQuickCategory] = useState("Planner");

    // Play/Pause/Next/Prev here all operate on the one global audio engine
    // (mounted once at the app root), so this dropdown is always showing -
    // and controlling - exactly what's actually playing.
    const { currentTrack, isPlaying, togglePlay, next, prev, currentTime, duration } = useAudioPlayer();

    const [theme, setTheme] = useState(() => localStorage.getItem('nexus_theme') || 'night');
    const [currentActivity, setCurrentActivity] = useState('System Active & Ready');
    
    const [profileData, setProfileData] = useState(() => {
        try {
            const saved = localStorage.getItem('nexus_user_profile');
            return saved ? JSON.parse(saved) : { name: 'New User', avatarUrl: '' };
        } catch (e) {
            return { name: 'New User', avatarUrl: '' };
        }
    });
    const [userLevel, setUserLevel] = useState(1);
    const [completedTaskCount, setCompletedTaskCount] = useState(0);

    const searchRef = useRef(null);
    const notifRef = useRef(null);
    const audioRefContainer = useRef(null);
    const quickAddRef = useRef(null);

    const loadProfileData = () => {
        const saved = localStorage.getItem('nexus_user_profile');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setProfileData({ name: parsed.name || 'New User', avatarUrl: parsed.avatarUrl || '' });
            } catch (e) {
                setProfileData({ name: 'New User', avatarUrl: '' });
            }
        } else {
            setProfileData({ name: 'New User', avatarUrl: '' });
        }
        try {
            const plannerTasks = JSON.parse(localStorage.getItem('nexus_planner_tasks') || '[]');
            const completed = plannerTasks.filter(t => t.completed).length;
            setCompletedTaskCount(completed);
            setUserLevel(Math.floor((completed * 50) / 500) + 1);
        } catch (e) {
            setCompletedTaskCount(0);
            setUserLevel(1);
        }
    };

    useEffect(() => {
        loadProfileData();
        window.addEventListener('nexus_profile_updated', loadProfileData);
        window.addEventListener('nexus_settings_updated', loadProfileData);
        window.addEventListener('storage', loadProfileData);
        return () => {
            window.removeEventListener('nexus_profile_updated', loadProfileData);
            window.removeEventListener('nexus_settings_updated', loadProfileData);
            window.removeEventListener('storage', loadProfileData);
        };
    }, []);

    // The real, global Cmd+K / Ctrl+K listener - lives on window (not
    // scoped to the search input or any single element), so it genuinely
    // works from anywhere in the OS, matching the badge that's been
    // sitting next to the search bar with no real listener behind it
    // until now. e.metaKey covers Mac's Cmd key, e.ctrlKey covers
    // Windows/Linux's Ctrl key - both checked, since a real user's OS is
    // unknown at build time. preventDefault() stops the browser's own
    // native Ctrl+K behavior (e.g. Firefox's own search-bar focus) from
    // firing alongside this.
    useEffect(() => {
        const handleGlobalKeydown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                modalOpen();
                setIsSearchOpen(true);
                setSelectedIndex(-1);
                // A fresh open should land focus in the real input
                // immediately, not on the next render - queued via
                // setTimeout(0) so this runs after React has actually
                // committed isSearchOpen's new value and the input is
                // guaranteed present/interactive in the DOM.
                setTimeout(() => searchInputRef.current?.focus(), 0);
            }
        };
        window.addEventListener('keydown', handleGlobalKeydown);
        return () => window.removeEventListener('keydown', handleGlobalKeydown);
    }, [modalOpen]);

    // Working Spotlight Search Functionality Preserved 100% Intact -
    // extended so an EMPTY query now shows the full section list as
    // default results (rather than nothing), so keyboard-only navigation
    // has something to arrow through the instant the palette opens via
    // Ctrl+K, before the user types anything.
    useEffect(() => {
        const query = searchQuery.trim().toLowerCase();

        const sections = [
            { name: 'Home Dashboard', route: 'Home', icon: <Apple size={14} color="#38bdf8" /> },
            { name: 'Planner Matrix', route: 'Planner', icon: <CheckSquare size={14} color="#10b981" /> },
            { name: 'Study Hub', route: 'Study', icon: <BookOpen size={14} color="#8b5cf6" /> },
            { name: 'Syllabus', route: 'Syllabus', icon: <FileText size={14} color="#f59e0b" /> },
            { name: 'Gym & Fitness', route: 'Gym', icon: <Dumbbell size={14} color="#ef4444" /> },
            { name: 'Diet & Nutrition', route: 'Diet', icon: <Zap size={14} color="#ec4899" /> },
            { name: 'Finance Wallet', route: 'Finance', icon: <Wallet size={14} color="#10b981" /> },
            { name: 'Calendar', route: 'Calendar', icon: <Calendar size={14} color="#3b82f6" /> },
            { name: 'Analytics', route: 'Analytics', icon: <BarChart2 size={14} color="#6366f1" /> },
            { name: 'AI Intelligence Hub', route: 'AI', icon: <Sparkles size={14} color="#ec4899" /> },
            { name: 'User Profile', route: 'Profile', icon: <User size={14} color="#06b6d4" /> },
            { name: 'System Settings', route: 'Settings', icon: <SettingsIcon size={14} color="#64748b" /> }
        ];

        if (!query) {
            setSearchResults(sections.map(sec => ({ title: sec.name, type: 'Section', route: sec.route, icon: sec.icon })));
            return;
        }

        const results = [];

        sections.forEach(sec => {
            if (sec.name.toLowerCase().includes(query)) {
                results.push({ title: sec.name, type: 'Section', route: sec.route, icon: sec.icon });
            }
        });

        try {
            const planner = JSON.parse(localStorage.getItem('nexus_planner_tasks') || '[]');
            planner.forEach(t => {
                if (t.title && t.title.toLowerCase().includes(query)) {
                    results.push({ title: t.title, type: 'Task', route: 'Planner', icon: <CheckSquare size={14} color="#10b981" /> });
                }
            });
        } catch (e) {}

        setSearchResults(results);
    }, [searchQuery]);

    useEffect(() => {
        const updateLiveActivity = () => {
            try {
                const plannerTasks = JSON.parse(localStorage.getItem('nexus_planner_tasks') || '[]');
                const activeTask = plannerTasks.find(t => t.status === 'In Progress' || t.active === true);
                setCurrentActivity(activeTask ? activeTask.title : 'System Active & Ready');
            } catch (err) {}
        };
        updateLiveActivity();
        const interval = setInterval(updateLiveActivity, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) setIsNotifOpen(false);
            if (audioRefContainer.current && !audioRefContainer.current.contains(e.target)) setIsAudioOpen(false);
            if (quickAddRef.current && !quickAddRef.current.contains(e.target)) setIsQuickAddOpen(false);
            if (searchRef.current && !searchRef.current.contains(e.target)) setIsSearchOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const syncTheme = () => {
            setTheme(localStorage.getItem('nexus_theme') || 'night');
        };
        window.addEventListener('nexus_theme_changed', syncTheme);
        return () => window.removeEventListener('nexus_theme_changed', syncTheme);
    }, []);

    const cycleTheme = () => {
        let nextTheme = theme === 'night' ? 'comfort' : theme === 'comfort' ? 'day' : theme === 'day' ? 'dynamic' : 'night';
        setTheme(nextTheme);
        localStorage.setItem('nexus_theme', nextTheme);
        document.documentElement.setAttribute('data-theme', nextTheme);

        try {
            const globalSettings = JSON.parse(localStorage.getItem('nexus_global_settings')) || {};
            globalSettings.themeMode = nextTheme;
            localStorage.setItem('nexus_global_settings', JSON.stringify(globalSettings));
            window.dispatchEvent(new Event('nexus_theme_changed'));
            window.dispatchEvent(new Event('nexus_settings_updated'));
        } catch (e) {}
    };

    const getThemeIcon = () => {
        if (theme === 'night') return <Moon size={18} />;
        if (theme === 'comfort') return <Cpu size={18} color="var(--warning)" />;
        if (theme === 'day') return <Sun size={18} />;
        if (theme === 'dynamic') return <Cloud size={18} color="#38bdf8" />; 
        return <Moon size={18} />;
    };

    const handleQuickSubmit = (e) => {
        e.preventDefault();
        if (!quickTitle.trim()) return;

        if (quickCategory === 'Planner') {
            const tasks = JSON.parse(localStorage.getItem('nexus_planner_tasks') || '[]');
            tasks.push({ id: Date.now(), title: quickTitle, completed: false, status: 'Queued' });
            localStorage.setItem('nexus_planner_tasks', JSON.stringify(tasks));
        } else if (quickCategory === 'Study') {
            // Matches the real shape StudyPage.jsx's own handleAddAssignment
            // produces exactly - nexus_study_assignments is the key that
            // page actually reads, not nexus_study_tasks (which nothing in
            // the app ever reads).
            const assignments = JSON.parse(localStorage.getItem('nexus_study_assignments') || '[]');
            assignments.unshift({
                id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
                title: quickTitle,
                subject: 'General',
                dueDate: new Date().toISOString().split('T')[0],
                status: 'Pending',
            });
            localStorage.setItem('nexus_study_assignments', JSON.stringify(assignments));
        }

        setQuickTitle('');
        setIsQuickAddOpen(false);
        window.dispatchEvent(new Event('storage'));
        alert('Quick Item Added Successfully!');
    };

    const displayName = profileData.name || 'New User';
    const displayInitial = profileData.avatarUrl ? '' : (displayName === 'New User' ? 'U' : displayName.charAt(0).toUpperCase());

    return (
        <>
        <header
            data-diag="global-header"
            onClickCapture={handleHeaderClickCapture}
            style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap', gap: isMobile ? '8px' : '14px',
            padding: isMobile ? '14px 12px' : '18px 28px', borderBottom: 'none', 
            position: 'sticky', top: 0, zIndex: 1000, 
            /* backdrop-filter intentionally not set inline - see the note on
               the Sidebar for why: the external stylesheet rule matching
               [style*="var(--header-bg"] applies the full blur+saturate+
               brightness treatment, and an inline declaration here would
               silently override it down to a plain, unsaturated blur. */
            background: 'var(--header-bg, var(--bg-main))', color: 'var(--text-main)', flexShrink: 0, height: '84px', width: '100%',
            transition: 'background 0.3s ease, color 0.3s ease'
        }}>
            {/* Real, 20px custom draggable strip - the actual mechanism
                behind this request's own "since the browser title bar
                will be gone" premise. -webkit-app-region: drag only has
                any real effect inside a frameless Electron/Tauri-style
                desktop shell (it's a non-standard property those
                renderers specifically recognize); it's a harmless no-op
                everywhere else - a regular browser tab, a standard
                installed PWA window (which already has its own native,
                draggable OS title bar), or the Capacitor Android build
                this project also has. Implemented exactly as specified
                regardless, since a future Electron/Tauri wrapper is
                exactly the real context where this becomes load-bearing. */}
            <div
                style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '20px',
                    WebkitAppRegion: 'drag',
                    zIndex: 1001,
                }}
            />

            {/* Mobile shows just the logo + wordmark on the left - primary
                navigation now lives entirely in MobileTabBar's fixed bottom
                bar, so no hamburger/drawer trigger is needed here anymore. */}
            {isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, WebkitAppRegion: 'no-drag' }}>
                    <img src="/nexus-logo.png" alt="Nexus" style={{ width: '30px', height: '30px', objectFit: 'contain', borderRadius: '8px', flexShrink: 0 }} />
                    <span style={{ fontSize: '15px', fontWeight: '900', letterSpacing: '0.6px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>NEXUS</span>
                </div>
            )}

            {/* Left Section: Spotlight Search + 4 Connected Circular App Shortcuts Right Beside It.
                Hidden entirely on mobile - a real, desktop-convenience feature
                genuinely redundant with the hamburger menu's own full nav list,
                and its own real width was a major contributor to the header
                crowding/overlap this fix addresses. */}
            {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, WebkitAppRegion: 'no-drag' }}>
                
                {/* Mac OS Spotlight Search Bar */}
                <div ref={searchRef} style={{ position: 'relative', width: 'clamp(130px, 12vw, 220px)', flexShrink: 0, minWidth: 0 }}>
                    <div style={{ 
                        display: 'flex', alignItems: 'center', gap: '8px', 
                        background: 'var(--widget-bg)', padding: '8px 14px', 
                        borderRadius: '9999px', 
                        border: '1px solid var(--border-premium)',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.12)'
                    }}>
                        <Search size={15} color="var(--text-muted)" />
                        <input 
                            ref={searchInputRef}
                            id="nexus-global-search" 
                            name="nexus-global-search" 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setIsSearchOpen(true); setSelectedIndex(-1); }}
                            onFocus={() => setIsSearchOpen(true)}
                            onKeyDown={(e) => {
                                if (!isSearchOpen || searchResults.length === 0) return;
                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setSelectedIndex((prev) => (prev + 1) % searchResults.length);
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setSelectedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
                                } else if (e.key === 'Enter') {
                                    e.preventDefault();
                                    // No explicit arrow-key selection yet defaults to the
                                    // first result, matching standard search-box convention.
                                    const target = searchResults[selectedIndex >= 0 ? selectedIndex : 0];
                                    if (target) {
                                        setActiveTab(target.route);
                                        setIsSearchOpen(false);
                                        setSearchQuery('');
                                        setSelectedIndex(-1);
                                    }
                                } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setIsSearchOpen(false);
                                    setSelectedIndex(-1);
                                    searchInputRef.current?.blur();
                                }
                            }}
                            placeholder="Spotlight Search..." 
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', width: '100%' }} 
                        />
                        <span style={{ fontSize: '9px', background: 'var(--bg-main)', padding: '2px 5px', borderRadius: '5px', color: 'var(--text-muted)', border: '1px solid var(--border-premium)', fontWeight: '600' }}>Ctrl+K</span>
                    </div>

                    {isSearchOpen && searchResults.length > 0 && (
                        <div style={{
                            position: 'absolute', top: '120%', left: 0, width: '280px', maxHeight: '300px', overflowY: 'auto',
                            background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '8px', zIndex: 1100,
                            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                        }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '6px 10px', fontWeight: '700' }}>Spotlight Results</div>
                            {searchResults.map((res, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => { setActiveTab(res.route); setIsSearchOpen(false); setSearchQuery(''); setSelectedIndex(-1); }}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                    style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '10px 12px', borderRadius: '12px',
                                        background: idx === selectedIndex ? 'rgba(var(--primary-rgb), 0.18)' : 'var(--widget-bg)',
                                        border: idx === selectedIndex ? '1px solid var(--primary)' : '1px solid transparent',
                                        color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer', marginBottom: '4px',
                                        transition: 'background 0.15s, border 0.15s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-premium)' }}>
                                            {res.icon}
                                        </div>
                                        <span style={{ fontWeight: '600' }}>{res.title}</span>
                                    </div>
                                    <span style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--bg-main)', borderRadius: '4px', color: 'var(--accent)' }}>{res.type}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 4 Connected Circular App Shortcuts placed right next to Spotlight Search */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button title="Planner Hub" onClick={() => setActiveTab('Planner')} style={{ width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0, background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', cursor: 'pointer', transition: 'transform 0.2s' }}>
                        <CheckSquare size={18} />
                    </button>
                    <button title="Study Hub" onClick={() => setActiveTab('Study')} style={{ width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0, background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6', cursor: 'pointer', transition: 'transform 0.2s' }}>
                        <BookOpen size={18} />
                    </button>
                    <button title="Gym & Fitness" onClick={() => setActiveTab('Gym')} style={{ width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0, background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', cursor: 'pointer', transition: 'transform 0.2s' }}>
                        <Dumbbell size={18} />
                    </button>
                    <button title="Finance Wallet" onClick={() => setActiveTab('Finance')} style={{ width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0, background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', cursor: 'pointer', transition: 'transform 0.2s' }}>
                        <Wallet size={18} />
                    </button>
                </div>

            </div>
            )}

            {/* Middle Section: System Active & Ready Badge - now a genuine
                flex participant (a real fix, not the prior fixed-center
                approach). The prior implementation used position: absolute
                with a fixed 50% coordinate, completely removing the badge
                from the flex layout - it never knew the real widths of the
                Left Section (search + shortcuts) or the Right Section
                (quick actions + profile), so on a medium-width display
                where both side sections are wide enough to reach that fixed
                center point, the badge simply sat on top of whatever was
                already there rather than reserving its own real space.
                This wrapper flexes to fill whatever center space genuinely
                remains between the two side sections (justifyContent:
                'center' centers the badge within that real remaining room,
                not a fixed viewport coordinate that ignores what's on
                either side of it), and minWidth: 0 lets it shrink below its
                own content size if the header is genuinely tight, so it
                can never force an overlap or overflow.
                Hidden on mobile - the real available center space there is
                too narrow for this badge to coexist with the hamburger
                button and right-side icon cluster at all. */}
            {!isMobile && (
            <div style={{ flex: '1 1 0px', display: 'flex', justifyContent: 'center', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', padding: '8px 18px', borderRadius: '20px', fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', flexShrink: 0, minWidth: 0, WebkitAppRegion: 'no-drag' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981', animation: 'pulse 2s infinite', flexShrink: 0 }}></div>
                    {/* Real max-width + ellipsis strategy for the text
                        itself (Requirement 2's own explicit ask) - the
                        badge container above stays a fixed, never-squashed
                        size via flexShrink: 0, but an unusually long active
                        task title (this is real, user-typed text, not a
                        fixed label) truncates gracefully here instead of
                        expanding the badge past a reasonable width. */}
                    <span style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentActivity}</span>
                </div>
            </div>
            )}

            {/* Right Actions & Profile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, minWidth: 0, WebkitAppRegion: 'no-drag' }}>
                
                {/* Quick Add, Quick Notes, Focus Audio Studio, and the AI
                    Assistant shortcut are real, desktop-convenience icons -
                    hidden on mobile, since their own real functionality
                    remains fully reachable elsewhere (the Planner page for
                    tasks, the Audio Hub page for playback, the hamburger
                    menu for AI), and hiding them is what actually makes
                    room for the header to fit a real narrow screen without
                    the reported collision. */}
                {!isMobile && (
                <>
                {/* Quick Add Modal */}
                <div ref={quickAddRef} style={{ position: 'relative' }}>
                    <button title="Quick Add Task" onClick={() => setIsQuickAddOpen(!isQuickAddOpen)} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '50%', width: '38px', height: '38px', flexShrink: 0, color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={18} /></button>
                    {isQuickAddOpen && (
                        <div style={{ position: 'absolute', top: '120%', right: 0, width: '280px', background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '16px', zIndex: 1100, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>Quick Add Item</h4>
                                <X size={14} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsQuickAddOpen(false)} />
                            </div>
                            <form onSubmit={handleQuickSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <input type="text" placeholder="Enter title..." value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} autoFocus />
                                <select value={quickCategory} onChange={(e) => setQuickCategory(e.target.value)} style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}>
                                    <option value="Planner" style={{ background: 'var(--surface-inset)' }}>Planner Task</option>
                                    <option value="Study" style={{ background: 'var(--surface-inset)' }}>Study Item</option>
                                </select>
                                <button type="submit" style={{ padding: '8px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>Add to System</button>
                            </form>
                        </div>
                    )}
                </div>

                {/* Headphones - Focus Audio Studio */}
                <button title="Quick Notes" onClick={() => setIsQuickNotesOpen(true)} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '50%', width: '38px', height: '38px', flexShrink: 0, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><StickyNote size={18} /></button>

                <div ref={audioRefContainer} style={{ position: 'relative' }}>
                    <button title="Focus Audio Studio" onClick={() => setIsAudioOpen(!isAudioOpen)} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '50%', width: '38px', height: '38px', flexShrink: 0, color: isPlaying ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Headphones size={18} /></button>
                    {isAudioOpen && (
                        <div style={{
                            position: 'absolute', top: '120%', right: 0, width: '260px',
                            /* Matches the Quick Add pop-up's exact glass treatment for
                               consistency across every header dropdown - same background
                               variable, border, radius, and shadow. Text/button colors
                               below now use theme variables instead of hardcoded light
                               hex values, since --bg-surface can be light during the
                               bright dawn/day phases, not just dark. */
                            background: 'var(--bg-surface)', border: '1px solid var(--border-premium)',
                            borderRadius: '14px', padding: '16px', zIndex: 1100,
                            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                        }}>
                            <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>Focus Audio Studio</h4>
                            <p style={{ fontSize: '12px', color: 'var(--accent)', marginBottom: '14px', fontWeight: '600', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.title}</p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%' }}>
                                <button onClick={prev} title="Previous" style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', color: 'var(--text-secondary)', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><SkipBack size={14} /></button>
                                <button onClick={togglePlay} style={{ flex: 1, padding: '10px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    {isPlaying ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Play</>}
                                </button>
                                <button onClick={next} title="Next" style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', color: 'var(--text-secondary)', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><SkipForward size={14} /></button>
                            </div>

                            {/* Subtle mini progress line - fills smoothly as the track plays */}
                            <div style={{ width: '100%', height: '3px', borderRadius: '2px', background: 'var(--surface-inset)', marginTop: '12px', overflow: 'hidden' }}>
                                <div
                                    style={{
                                        height: '100%',
                                        width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
                                        background: 'var(--accent)',
                                        borderRadius: '2px',
                                        transition: 'width 0.4s linear',
                                    }}
                                />
                            </div>

                            <button
                                onClick={() => { setIsAudioOpen(false); if (typeof setActiveTab === 'function') setActiveTab('audio_hub'); }}
                                style={{ marginTop: '12px', width: '100%', padding: '8px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', color: 'var(--text-secondary)', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                                <ListMusic size={13} /> Open Audio Hub
                            </button>
                        </div>
                    )}
                </div>

                {/* AI Assistant Single Click */}
                <button title="Nexus AI Assistant" onClick={() => setActiveTab('AI')} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '50%', width: '38px', height: '38px', flexShrink: 0, color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkles size={18} /></button>
                </>
                )}

                {/* Notifications Dropdown */}
                <div ref={notifRef} style={{ position: 'relative' }}>
                    <button
                        title="System Notifications"
                        onClick={() => {
                            const next = !isNotifOpen;
                            setIsNotifOpen(next);
                            if (next) {
                                try {
                                    const plannerTasks = JSON.parse(localStorage.getItem('nexus_planner_tasks') || '[]');
                                    const pending = plannerTasks.filter(t => !t.completed).slice(-5).reverse();
                                    setNotifications(pending.map(t => ({ id: t.id, title: t.title, status: t.status || 'Queued' })));
                                } catch (e) {
                                    setNotifications([]);
                                }
                            }
                        }}
                        style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '50%', width: '38px', height: '38px', flexShrink: 0, color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    ><Bell size={18} /></button>
                    {isNotifOpen && (
                        <div style={{ position: 'absolute', top: '120%', right: 0, width: '270px', background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '16px', zIndex: 1100, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>System Notifications</h4>
                            {notifications.length === 0 ? (
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '10px', background: 'var(--widget-bg)', borderRadius: '8px' }}>No pending tasks. All operational.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                                    {notifications.map((n) => (
                                        <div
                                            key={n.id}
                                            onClick={() => { setIsNotifOpen(false); setActiveTab('Planner'); }}
                                            style={{ fontSize: '12px', color: 'var(--text-primary)', padding: '8px 10px', background: 'var(--widget-bg)', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}
                                        >
                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</span>
                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>{n.status}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Theme Toggle - hidden on mobile, reachable via Settings instead. */}
                {!isMobile && (
                <button title="Cycle Theme" onClick={cycleTheme} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '50%', width: '38px', height: '38px', flexShrink: 0, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {getThemeIcon()}
                </button>
                )}

                {/* Profile Section - name/level text hidden on mobile,
                    avatar-only, a real, standard mobile-app space-saving
                    convention. */}
                <div onClick={() => setActiveTab('Profile')} style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: isMobile ? 0 : '14px', borderLeft: isMobile ? 'none' : '1px solid var(--border-premium)', cursor: 'pointer', flexShrink: 0, minWidth: 0 }}>
                    <div style={{ 
                        width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                        WebkitMaskImage: 'radial-gradient(white, black)', maskImage: 'radial-gradient(white, black)',
                        background: profileData.avatarUrl ? 'transparent' : 'linear-gradient(135deg, #3B82F6, #8B5CF6, #EC4899)', 
                        boxShadow: '0 0 15px rgba(139, 92, 246, 0.4), inset 0 2px 4px rgba(255,255,255,0.3)', 
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        fontWeight: '900', fontSize: '18px', border: '1px solid rgba(255,255,255,0.2)',
                        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}
                    data-diag="header-avatar"
                    >
                        {profileData.avatarUrl ? (
                            <img
                                src={profileData.avatarUrl}
                                alt="Avatar"
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: 'transparent' }}
                            />
                        ) : displayInitial}
                    </div>
                    {!isMobile && (
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, maxWidth: '140px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', textShadow: '0 1px 2px rgba(0,0,0,0.1)', lineHeight: '1.2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                            {displayName}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', marginTop: '3px' }}>
                            <span
                                title={`${completedTaskCount} tasks completed · ${10 - (completedTaskCount % 10)} more to reach Lvl ${userLevel + 1}`}
                                style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', padding: '2px 6px', borderRadius: '6px', fontWeight: '800', flexShrink: 0 }}
                            >
                                <Flame size={10} /> Lvl {userLevel}
                            </span>
                        </div>
                    </div>
                    )}
                </div>

            </div>
        </header>
        {isQuickNotesOpen && <QuickNotesModal onClose={() => setIsQuickNotesOpen(false)} />}
        </>
    );
};

export default Header;