// src/components/header.jsx
import { useState, useEffect, useRef } from 'react';
import {
    Search, Bell, Moon, Sun, Cpu, CheckSquare, BookOpen,
    Dumbbell, Apple, Wallet, Calendar, BarChart2, FileText, User,
    Plus, Headphones, Sparkles, Flame, Zap, Cloud, Settings as SettingsIcon, X, Play, Pause, SkipForward, SkipBack, ListMusic, StickyNote,
    Volume2, VolumeX, Volume1, Shuffle, Repeat, Repeat1, Disc, Heart,
    RefreshCw, Database, CloudOff, AlertTriangle, CheckCircle2, PauseCircle, PlayCircle, Activity,
} from 'lucide-react';
import { useAudioPlayer, makeFavoriteKey } from '../context/AudioPlayerContext.jsx';
import { useStreaming } from '../context/StreamingContext.jsx';
import { useCloudSync, SYNC_STATUS } from '../context/CloudSyncContext.jsx';
import { useStorageUsage } from '../hooks/useStorageUsage.js';
import { useMicroFeedback } from '../hooks/useMicroFeedback.js';
import QuickNotesModal from './QuickNotesModal.jsx';
import { parseQuickCommand } from '../utils/quickCommandParser.js';
import { getLocalDateString } from '../utils/dateUtils.js';
import MobileHeaderSearch from './MobileHeaderSearch.jsx';
import NotificationDropdown from './NotificationDropdown.jsx';
import { useNotifications } from '../hooks/useNotifications.js';

// Same "5m ago" / "2h ago" grammar as everywhere else relative time
// shows up in this app - null/undefined (never synced yet) reads as
// "Never", not "NaN ago" or an empty string.
const formatRelativeTime = (date) => {
    if (!date) return 'Never';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
};

// Mirrors AudioHubPage.jsx's own formatTime exactly (mm:ss, 0:00 for any
// non-finite/negative value) - kept as its own small local copy rather
// than a shared import so this fix stays scoped to this file only.
const formatTime = (seconds) => {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const Header = ({ setActiveTab, isMobile, onOpenMenu }) => {
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
    const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications();
    const [isAudioOpen, setIsAudioOpen] = useState(false);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const [isQuickNotesOpen, setIsQuickNotesOpen] = useState(false);
    // Set only when Quick Notes is opened FROM a Spotlight search result -
    // tells QuickNotesModal which section/note to land on immediately
    // instead of its own default (last-viewed) selection. Cleared once
    // consumed so a later, ordinary click on the header's Quick Notes
    // icon doesn't keep re-jumping to a stale search result.
    const [pendingNotesJump, setPendingNotesJump] = useState(null);
    // The "System Active & Ready" badge's own real diagnostics panel -
    // isSyncing/syncStatus/syncError/lastSyncedAt/syncPaused all come
    // straight from the real, already-live CloudSyncContext (the actual
    // background sync engine this app runs), not invented state.
    const [isSystemPanelOpen, setIsSystemPanelOpen] = useState(false);
    const systemPanelRef = useRef(null);
    const { isSyncing, syncStatus, syncError, lastSyncedAt, syncPaused, setSyncPaused, pushToCloud, pullFromCloud } = useCloudSync();
    const storageUsage = useStorageUsage();
    const systemStatusColor = syncStatus === SYNC_STATUS.ERROR ? '#EF4444' : isSyncing ? '#3B82F6' : syncPaused ? '#94A3B8' : '#10B981';
    
    const [quickTitle, setQuickTitle] = useState("");
    const [quickCategory, setQuickCategory] = useState("Planner");

    // Natural-language quick command ("Add expense 500 for lunch",
    // "Schedule gym tomorrow at 6 PM") - a real regex parser (see
    // utils/quickCommandParser.js), not a fake keyword forward. Separate
    // state from the structured Planner/Study form above; both live in the
    // same popover but are two independent, real entry paths.
    const [quickCommandText, setQuickCommandText] = useState('');
    const [quickCommandFeedback, setQuickCommandFeedback] = useState(null); // { type: 'error'|'success', message }
    const quickCommandPreview = quickCommandText.trim() ? parseQuickCommand(quickCommandText) : null;

    // Play/Pause/Next/Prev here all operate on the one global audio engine
    // (mounted once at the app root), so this dropdown is always showing -
    // and controlling - exactly what's actually playing.
    // currentTrack/isPlaying/currentTime/duration/seek here already
    // transparently reflect Spotify's real Web Playback SDK state when
    // it's the active source (AudioPlayerContext's own effectiveCurrentTrack
    // mechanism) - real fix for a real, reported bug: this popup used to go
    // blank/stale (no progress animation, a dummy-looking play/pause) while
    // Spotify was audibly playing through its own separate engine.
    const {
        currentTrack, isPlaying, togglePlay, next, prev, currentTime, duration, seek, volume, isMuted, setVolume: setLocalVolume, hasEverPlayed,
        shuffleEnabled, toggleShuffle, repeatMode, cycleRepeatMode,
        favoriteTrackTitles, toggleFavoriteTrack,
    } = useAudioPlayer();
    // Explicit request: the volume row used to always be visible - now
    // click-to-reveal on the speaker icon, matching the exact toggle
    // pattern the Audio Hub's own player already uses.
    const [isVolumeOpen, setIsVolumeOpen] = useState(false);
    const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;
    const repeatActive = repeatMode === 'one' || repeatMode === 'all';
    // Explicit request: this popup had no volume control at all - added
    // below, right next to Play/Pause. Also routes to Spotify's own SDK
    // volume when it's the active source, same real fix as the Settings
    // page's Master Volume slider and the Audio Hub player's own volume
    // control (neither of those ever touched Spotify's separate volume
    // before either).
    const { activeSource: headerActiveSource, spotifySetVolume } = useStreaming();
    const setVolume = (v) => {
        setLocalVolume(v);
        if (headerActiveSource === 'spotify') spotifySetVolume(v);
    };

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

        // Real, cross-module search - a previous version of this only ever
        // indexed Planner tasks, so a genuinely real "Sleep" entry living
        // in Quick Notes, Calendar, Finance, or Syllabus/Study was
        // structurally invisible here regardless of spelling. Each source
        // gets its own try/catch (not one shared block) so one module's
        // malformed/missing data can never silently kill results from
        // every other module.
        try {
            const planner = JSON.parse(localStorage.getItem('nexus_planner_tasks') || '[]');
            planner.forEach(t => {
                if (t.title && t.title.toLowerCase().includes(query)) {
                    results.push({ title: t.title, type: 'Task', route: 'Planner', icon: <CheckSquare size={14} color="#10b981" /> });
                }
            });
        } catch (e) {}

        // Quick Notes - a nested {sections:[{title, notes:[{title}]}]}
        // shape, not a flat list. route: 'quick_notes' is a synthetic
        // marker (not a real DashboardLayout tab) - handled specially in
        // handleSelectResult below, which opens the Quick Notes modal
        // itself (already owned by this header) directly to that
        // section/note, a real deep-link rather than just a page jump.
        try {
            const notesData = JSON.parse(localStorage.getItem('nexus_quick_notes') || '{}');
            (notesData.sections || []).forEach(sec => {
                if (sec.title && sec.title.toLowerCase().includes(query)) {
                    results.push({ title: sec.title, type: 'Note Section', route: 'quick_notes', sectionId: sec.id, icon: <StickyNote size={14} color="#f59e0b" /> });
                }
                (sec.notes || []).forEach(note => {
                    if (note.title && note.title.toLowerCase().includes(query)) {
                        results.push({ title: note.title, type: 'Note', route: 'quick_notes', sectionId: sec.id, noteId: note.id, icon: <StickyNote size={14} color="#f59e0b" /> });
                    }
                });
            });
        } catch (e) {}

        try {
            const events = JSON.parse(localStorage.getItem('nexus_calendar_events') || '[]');
            events.forEach(ev => {
                if (ev.title && ev.title.toLowerCase().includes(query)) {
                    results.push({ title: ev.title, type: 'Event', route: 'Calendar', icon: <Calendar size={14} color="#3b82f6" /> });
                }
            });
        } catch (e) {}

        try {
            const transactions = JSON.parse(localStorage.getItem('nexus_finance_transactions') || '[]');
            transactions.forEach(tx => {
                if (tx.title && tx.title.toLowerCase().includes(query)) {
                    results.push({ title: tx.title, type: 'Transaction', route: 'Finance', icon: <Wallet size={14} color="#10b981" /> });
                }
            });
        } catch (e) {}
        try {
            const bills = JSON.parse(localStorage.getItem('nexus_finance_bills') || '[]');
            bills.forEach(b => {
                if (b.title && b.title.toLowerCase().includes(query)) {
                    results.push({ title: b.title, type: 'Bill', route: 'Finance', icon: <Wallet size={14} color="#10b981" /> });
                }
            });
        } catch (e) {}
        try {
            const goals = JSON.parse(localStorage.getItem('nexus_finance_goals') || '[]');
            goals.forEach(g => {
                if (g.title && g.title.toLowerCase().includes(query)) {
                    results.push({ title: g.title, type: 'Goal', route: 'Finance', icon: <Wallet size={14} color="#10b981" /> });
                }
            });
        } catch (e) {}

        // Syllabus - nested two levels deep (subjects -> units -> topics);
        // all three levels are real, independently-named things a user
        // would plausibly search for.
        try {
            const subjects = JSON.parse(localStorage.getItem('nexus_syllabus_subjects') || '[]');
            subjects.forEach(sub => {
                if (sub.name && sub.name.toLowerCase().includes(query)) {
                    results.push({ title: sub.name, type: 'Subject', route: 'Syllabus', icon: <FileText size={14} color="#f59e0b" /> });
                }
                (sub.units || []).forEach(unit => {
                    if (unit.name && unit.name.toLowerCase().includes(query)) {
                        results.push({ title: unit.name, type: 'Unit', route: 'Syllabus', icon: <FileText size={14} color="#f59e0b" /> });
                    }
                    (unit.topics || []).forEach(topic => {
                        if (topic.name && topic.name.toLowerCase().includes(query)) {
                            results.push({ title: topic.name, type: 'Topic', route: 'Syllabus', icon: <FileText size={14} color="#f59e0b" /> });
                        }
                    });
                });
            });
        } catch (e) {}

        try {
            const assignments = JSON.parse(localStorage.getItem('nexus_study_assignments') || '[]');
            assignments.forEach(a => {
                if (a.title && a.title.toLowerCase().includes(query)) {
                    results.push({ title: a.title, type: 'Assignment', route: 'Study', icon: <BookOpen size={14} color="#8b5cf6" /> });
                }
            });
        } catch (e) {}

        // A real, wide index across 8 sources could otherwise return
        // dozens of matches for a common short query, overflowing the
        // dropdown's own fixed maxHeight into an unusable wall of results
        // instead of a focused top-N list - sections (the base navigation)
        // are kept first since they were already pushed first above.
        setSearchResults(results.slice(0, 20));
    }, [searchQuery]);

    // Shared by both the Enter-key handler and each result row's onClick -
    // one real implementation instead of two copies that could drift.
    // Quick Notes results are a genuine deep-link (opens the actual note/
    // section in the already-header-owned QuickNotesModal); everything
    // else deep-links as far as this app's routing model actually goes -
    // straight to the right page/tab (there's no per-item route beyond
    // that - see QuickNotesModal's own jump-target props below for the
    // one case that goes further).
    const handleSelectResult = (result) => {
        if (!result) return;
        if (result.route === 'quick_notes') {
            setPendingNotesJump({ sectionId: result.sectionId, noteId: result.noteId || null });
            setIsQuickNotesOpen(true);
        } else {
            setActiveTab(result.route);
        }
        setIsSearchOpen(false);
        setSearchQuery('');
        setSelectedIndex(-1);
    };

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
            // NotificationDropdown now portals its own panel straight to
            // document.body (see that file's own header comment) - its DOM
            // nodes are no longer inside notifRef, so contains() alone
            // would treat every click inside the panel itself (a
            // notification item, "Mark all read") as an outside click and
            // close it before that click's own handler even ran.
            // .nexus-notif-panel is a stable, real class name that exact
            // component always renders, so this is genuinely checking "is
            // this click inside the panel", not a fragile ref workaround.
            if (notifRef.current && !notifRef.current.contains(e.target) && !e.target.closest('.nexus-notif-panel')) setIsNotifOpen(false);
            if (audioRefContainer.current && !audioRefContainer.current.contains(e.target)) setIsAudioOpen(false);
            if (quickAddRef.current && !quickAddRef.current.contains(e.target)) setIsQuickAddOpen(false);
            if (searchRef.current && !searchRef.current.contains(e.target)) setIsSearchOpen(false);
            if (systemPanelRef.current && !systemPanelRef.current.contains(e.target)) setIsSystemPanelOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Real, live storage usage every time the panel is actually opened -
    // not on every render, since the underlying localStorage.hasOwnProperty
    // loop is real work not worth repeating on every keystroke elsewhere
    // in the header.
    useEffect(() => {
        if (isSystemPanelOpen) storageUsage.refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSystemPanelOpen]);

    useEffect(() => {
        const syncTheme = () => {
            setTheme(localStorage.getItem('nexus_theme') || 'night');
        };
        // Also listens for 'nexus_settings_updated' and 'storage' (not
        // just its own 'nexus_theme_changed'), defensively - any write
        // path that changes nexus_theme in localStorage without
        // dispatching 'nexus_theme_changed' specifically (CloudSync's
        // applyCloudData now dispatches it directly too, but this is the
        // general-case guard for any OTHER path that ever forgets to)
        // would otherwise leave this icon showing a stale theme while
        // DashboardLayout's own broader listener correctly re-applies
        // data-theme to <html> - the exact "icon shows Dynamic while the
        // real theme is dark" desync this closes. Re-reading the same
        // localStorage value on an extra, redundant event is a no-op
        // when nothing actually changed.
        window.addEventListener('nexus_theme_changed', syncTheme);
        window.addEventListener('nexus_settings_updated', syncTheme);
        window.addEventListener('storage', syncTheme);
        return () => {
            window.removeEventListener('nexus_theme_changed', syncTheme);
            window.removeEventListener('nexus_settings_updated', syncTheme);
            window.removeEventListener('storage', syncTheme);
        };
    }, []);

    const cycleTheme = () => {
        // Reads the real current value from localStorage (the actual
        // source of truth every other reader in this app uses), not this
        // component's own `theme` state closure - defensive hardening
        // against that local state ever drifting out of sync with what's
        // genuinely applied (e.g. a theme change from another tab, or a
        // future write path that updates localStorage without dispatching
        // 'nexus_theme_changed'). Cycling from a stale local value would
        // silently jump to the wrong next theme instead of advancing from
        // whatever is actually showing on screen.
        const actualCurrent = localStorage.getItem('nexus_theme') || 'night';
        let nextTheme = actualCurrent === 'night' ? 'comfort' : actualCurrent === 'comfort' ? 'day' : actualCurrent === 'day' ? 'dynamic' : 'night';
        setTheme(nextTheme);
        localStorage.setItem('nexus_theme', nextTheme);
        document.documentElement.setAttribute('data-theme', nextTheme);

        try {
            const globalSettings = JSON.parse(localStorage.getItem('nexus_global_settings')) || {};
            globalSettings.themeMode = nextTheme;
            localStorage.setItem('nexus_global_settings', JSON.stringify(globalSettings));
            window.dispatchEvent(new Event('nexus_theme_changed'));
            window.dispatchEvent(new Event('nexus_settings_updated'));
            // Real, reported data-loss bug: this write to the SHARED
            // nexus_global_settings blob never dispatched 'storage', the
            // one signal CloudSyncContext.jsx's own local-change listener
            // actually watches for. Without it, CloudSync never knew a
            // local edit was pending here - so its "don't apply an
            // incoming cloud pull while a local change is in flight"
            // guard (pushDebounceRef) never engaged for this write, and a
            // pull landing in that window (the live onSnapshot listener,
            // or a fresh sign-in pull after a reload) could silently
            // overwrite the WHOLE shared blob - API keys included, not
            // just themeMode - with a stale cloud snapshot. This is the
            // theme-cycle button in the header, one of the most-clicked
            // controls in the app, which made this a real, recurring,
            // hard-to-pin-down way for unrelated settings (like a just-
            // typed API key) to vanish. Matches the same dispatch
            // convention every other writer to this key already uses.
            window.dispatchEvent(new Event('storage'));
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
            // status must be one of PlannerPage's own three real Kanban
            // column values ('To Do'/'In Progress'/'Completed') - a task
            // saved here with any other status string (e.g. the previous
            // 'Queued') matches none of those columns and simply never
            // renders in Kanban view, even though it's still sitting in
            // localStorage and shows fine in List view.
            //
            // project/priority/dueDate/estimatedMins are also real fields
            // PlannerPage.jsx's own List view reads directly (the source
            // badge, the priority pill, the due-date/mins row) - left
            // undefined they rendered as blank badges/pills instead of
            // crashing, but a Quick-Added task should look identical to
            // one created from Planner's own "+ New Task" form.
            tasks.push({
                id: Date.now().toString(),
                title: quickTitle,
                description: '',
                project: 'Planner',
                priority: 'Medium',
                status: 'To Do',
                dueDate: getLocalDateString(),
                estimatedMins: 60,
                completed: false,
            });
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
                dueDate: getLocalDateString(),
                status: 'Pending',
            });
            localStorage.setItem('nexus_study_assignments', JSON.stringify(assignments));
        }

        setQuickTitle('');
        setIsQuickAddOpen(false);
        window.dispatchEvent(new Event('storage'));
        alert('Quick Item Added Successfully!');
    };

    // Executes an already-parsed quick command by writing directly to the
    // same real localStorage keys and shapes FinancePage.jsx/CalendarPage.jsx
    // themselves use, then dispatching the app's shared sync event - the
    // same "write once, sync everywhere" pattern the SMS Auto-Tracking
    // bridge and Settings' own Import Backup already use, not a second,
    // parallel data path.
    const executeQuickCommand = () => {
        const parsed = quickCommandPreview;
        if (!parsed) return;

        if (parsed.module === 'finance') {
            const accounts = JSON.parse(localStorage.getItem('nexus_finance_accounts') || '[]');
            const targetAccount = accounts[0];
            if (!targetAccount) {
                setQuickCommandFeedback({ type: 'error', message: 'Create an account in the Finance Hub first.' });
                return;
            }
            const transactions = JSON.parse(localStorage.getItem('nexus_finance_transactions') || '[]');
            const { type, amount, title } = parsed.data;
            const txItem = {
                id: `qc_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
                title: title.charAt(0).toUpperCase() + title.slice(1),
                type, amount, category: 'Others', account: targetAccount.name,
                date: getLocalDateString(),
            };
            localStorage.setItem('nexus_finance_transactions', JSON.stringify([txItem, ...transactions]));
            const updatedAccounts = accounts.map((acc) => acc.name === targetAccount.name
                ? { ...acc, balance: acc.balance + (type === 'Income' ? amount : -amount) }
                : acc);
            localStorage.setItem('nexus_finance_accounts', JSON.stringify(updatedAccounts));
            setQuickCommandFeedback({ type: 'success', message: `Added to ${targetAccount.name}.` });
        } else if (parsed.module === 'calendar') {
            const events = JSON.parse(localStorage.getItem('nexus_calendar_events') || '[]');
            const eventItem = {
                id: `qc_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
                title: parsed.data.title.charAt(0).toUpperCase() + parsed.data.title.slice(1),
                category: 'Personal', date: parsed.data.date, time: parsed.data.time,
                priority: 'Medium', location: '', completed: false,
            };
            localStorage.setItem('nexus_calendar_events', JSON.stringify([eventItem, ...events]));
            setQuickCommandFeedback({ type: 'success', message: 'Added to your Calendar.' });
        }

        window.dispatchEvent(new Event('storage'));
        setQuickCommandText('');
        setTimeout(() => setQuickCommandFeedback(null), 2500);
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
            /* Mobile: a real, content-driven slim height (60px) instead of
               the desktop's own fixed 84px - tight enough to fit its own
               tallest element (the 36px avatar below) plus modest
               breathing room, not a large block with wasted vertical
               space above the home page's own content. */
            // Desktop padding tightened 18px 28px -> 12px 22px - explicit
            // later feedback that the header read as "too fat"/tall.
            padding: isMobile ? '10px 12px' : '12px 22px', borderBottom: 'none',
            /* Real device status bar (notch/clock/battery) clearance - this
               header is position:sticky/top:0, the very first element in
               .nexus-app-shell, with no other chrome above it. index.html's
               viewport-fit=cover already opts the page into extending under
               the status bar, but nothing here compensated for that: real,
               confirmed live via device video, content and icons were
               rendering directly under the status bar with zero clearance.
               env() only ever returns a non-zero value inside that
               viewport-fit=cover webview (a real notched phone, installed
               PWA, or the project's own Capacitor wrapper) - a plain
               desktop/laptop browser tab always resolves it to 0, so this
               is a no-op there and the existing 10px/18px padding is
               unchanged. */
            paddingTop: isMobile ? 'calc(10px + env(safe-area-inset-top, 0px))' : '12px',
            position: 'sticky', top: 0, zIndex: 1000,
            /* backdrop-filter intentionally not set inline - see the note on
               the Sidebar for why: the external stylesheet rule matching
               [style*="var(--header-bg"] applies the full blur+saturate+
               brightness treatment, and an inline declaration here would
               silently override it down to a plain, unsaturated blur. */
            background: 'var(--header-bg, var(--bg-main))', color: 'var(--text-main)', flexShrink: 0,
            /* minHeight, not a fixed height - a fixed 60px with the extra
               safe-area padding above would (box-sizing: border-box) eat
               directly into the 36px avatar/icon row's own space instead of
               growing the bar taller, clipping it on tall-inset devices
               (e.g. ~47-59px on an iPhone with a Dynamic Island). Letting
               the bar grow keeps every icon fully visible and correctly
               centered below the status bar instead of cramped against it. */
            // Desktop minHeight cut 84px -> 64px, matching the tighter
            // padding above - explicit "Header is too fat" feedback.
            minHeight: isMobile ? '60px' : '64px', width: '100%', boxSizing: 'border-box',
            // "Floating Island" card treatment on desktop, matching the
            // main Sidebar's own identical rounded-card + shadow look
            // (DashboardLayout.jsx's shell padding/gap provides the real
            // surrounding margin - this is just the card's own visual
            // identity). Mobile keeps its existing flush, un-rounded bar -
            // this request was specifically about the desktop shell.
            ...(isMobile ? {} : { borderRadius: '16px', boxShadow: '0 8px 28px rgba(0,0,0,0.18)' }),
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

            {/* Mobile: the real app logo (same /nexus-logo.svg mark
                desktop's own sidebar.jsx uses for its collapsed toggle,
                not a generic hamburger glyph) doubles as the menu trigger
                - tapping it calls the exact same onOpenMenu toggle
                DashboardLayout.jsx already wires up (setIsMobileNavOpen
                flips true/false), so tapping it again while the drawer is
                open closes it right back, no separate close affordance
                needed here. No hover/pressed-state chrome around it on
                purpose - a plain logo mark, not a boxed icon button, per
                explicit request; the wordmark sits right after it. */}
            {isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, WebkitAppRegion: 'no-drag' }}>
                    <button
                        onClick={onOpenMenu}
                        title="Menu"
                        aria-label="Open menu"
                        style={{ background: 'transparent', border: 'none', borderRadius: '10px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0 }}
                    >
                        <img src="/nexus-logo.svg" alt="Nexus" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                    </button>
                    {/* Real, reported bug: on a genuinely narrow real
                        device (a real screenshot showed this text
                        visually overlapping the icon row to its right,
                        not reproducible on any standard emulated mobile
                        width tested here) whiteSpace:'nowrap' alone lets
                        this text overflow its own box rather than
                        respect it - the box doesn't grow, the TEXT just
                        renders past its right edge, straight into
                        whatever sits next to it in the flex row. Real
                        overflow/ellipsis handling means an unusually
                        narrow screen truncates "NEXUS" instead of
                        letting it visually collide with the icons. */}
                    <span style={{ fontSize: '15px', fontWeight: '900', letterSpacing: '0.6px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>NEXUS</span>
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
                <div ref={searchRef} data-tour-id="home-search" style={{ position: 'relative', width: 'clamp(130px, 12vw, 220px)', flexShrink: 0, minWidth: 0 }}>
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
                            aria-label="Search"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setIsSearchOpen(true); setSelectedIndex(-1); }}
                            onFocus={() => setIsSearchOpen(true)}
                            onKeyDown={(e) => {
                                // Escape must work even with zero results (e.g. a
                                // query matching nothing) - the guard below only
                                // gates the list-navigation keys, which have
                                // nothing to act on in that case.
                                if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setIsSearchOpen(false);
                                    setSelectedIndex(-1);
                                    searchInputRef.current?.blur();
                                    return;
                                }
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
                                    handleSelectResult(target);
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
                                    onClick={() => handleSelectResult(res)}
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
                On mobile, this exact same middle slot is just a plain
                flexible spacer instead - MobileHeaderSearch used to live
                centered here, but a real, reported bug was that centering
                a single icon in "whatever space happens to be left"
                produced visibly uneven gaps to its neighbors (sometimes
                hugging the wordmark, sometimes hugging Quick Notes,
                depending on how much room the two side groups left) -
                it's now a normal member of the right-hand icon row below
                instead, sharing that row's own uniform gap like every
                other icon there. */}
            {isMobile ? (
                <div style={{ flex: '1 1 0px', minWidth: 0 }} />
            ) : (
            <div ref={systemPanelRef} style={{ flex: '1 1 0px', display: 'flex', justifyContent: 'center', minWidth: 0, position: 'relative' }}>
                {/* Real, functional system-health indicator, not a static
                    decoration - the dot color/pulse and the panel it opens
                    both reflect the actual, already-live CloudSyncContext
                    engine (real Firestore sync, not invented state). Kept
                    as a <button> (not a plain div) specifically so it's a
                    genuine, keyboard-reachable, screen-reader-announced
                    control, matching every other icon button in this
                    header. */}
                <button
                    type="button"
                    onClick={() => setIsSystemPanelOpen((v) => !v)}
                    aria-label="System diagnostics"
                    aria-expanded={isSystemPanelOpen}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', padding: '8px 18px', borderRadius: '20px', fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', flexShrink: 0, minWidth: 0, WebkitAppRegion: 'no-drag', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                    <div style={{
                        width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                        background: systemStatusColor, boxShadow: `0 0 8px ${systemStatusColor}`,
                        animation: isSyncing ? 'pulse 1s infinite' : 'pulse 2s infinite',
                    }}></div>
                    {/* Real max-width + ellipsis strategy for the text
                        itself (Requirement 2's own explicit ask) - the
                        badge container above stays a fixed, never-squashed
                        size via flexShrink: 0, but an unusually long active
                        task title (this is real, user-typed text, not a
                        fixed label) truncates gracefully here instead of
                        expanding the badge past a reasonable width. */}
                    <span style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentActivity}</span>
                </button>

                {isSystemPanelOpen && (
                    <div style={{
                        position: 'absolute', top: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)',
                        width: '320px', border: '1px solid var(--border-premium)',
                        borderRadius: '16px', padding: '16px', zIndex: 1100, boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                        display: 'flex', flexDirection: 'column', gap: '14px',
                        /* A real, reported "mixing with what's behind it"
                           complaint - this panel sits directly over the
                           header's own audio mini-player. A first attempt
                           tried a full-viewport dimming backdrop (like
                           QuickNotesModal.jsx's own full-screen modal), but
                           that's wrong here: it blocked/dimmed the REST of
                           the page too, so the audio player's own other
                           controls became unreachable while this was open -
                           this is meant to stay a lightweight anchored
                           popover, not a modal. The real, correct fix lives
                           entirely in the popover's OWN fill instead.
                           Explicit request (a later round): this specific
                           panel must stay premium dark glassmorphism
                           ALWAYS, not flip to a near-solid white fill with
                           dark text the way --popover-bg/--text-primary do
                           during the Dynamic theme's own Dawn/Day sky
                           phases (a real, deliberate, earlier choice for
                           every OTHER popover in this app - just not the
                           right look for this one specifically, per this
                           explicit correction). A local CSS-custom-property
                           override right here - not a global variables.css
                           change - means every var(--text-primary)/
                           var(--border-premium)/etc. reference already
                           used throughout this panel's own JSX below
                           resolves to a fixed dark-glass palette
                           regardless of sky phase, without needing to
                           touch each one individually. */
                        background: 'rgba(15, 23, 42, 0.6)',
                        '--text-primary': '#FFFFFF', '--text-secondary': 'rgba(255,255,255,0.75)',
                        '--text-muted': 'rgba(255,255,255,0.55)', '--border-premium': 'rgba(255,255,255,0.14)',
                        '--widget-bg': 'rgba(255,255,255,0.08)', '--bg-surface': 'rgba(255,255,255,0.06)',
                        backdropFilter: 'blur(max(var(--glass-blur, 20px), 16px)) saturate(180%)', WebkitBackdropFilter: 'blur(max(var(--glass-blur, 20px), 16px)) saturate(180%)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
                            <Activity size={15} color="var(--primary)" /> System Diagnostics
                        </div>

                        {/* Cloud sync - real state from CloudSyncContext */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                                    {syncStatus === SYNC_STATUS.ERROR ? <AlertTriangle size={13} color="#EF4444" />
                                        : isSyncing ? <RefreshCw size={13} color="#3B82F6" style={{ animation: 'spin 1s linear infinite' }} />
                                        : syncPaused ? <PauseCircle size={13} color="#94A3B8" />
                                        : <CheckCircle2 size={13} color="#10B981" />}
                                    Cloud Sync
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    {syncStatus === SYNC_STATUS.ERROR ? 'Error' : isSyncing ? 'Syncing…' : syncPaused ? 'Paused' : 'Idle'}
                                </span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Last synced: {formatRelativeTime(lastSyncedAt)}</div>
                            {syncStatus === SYNC_STATUS.ERROR && syncError && (
                                <div style={{ fontSize: '11px', color: '#EF4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '6px 8px' }}>{syncError}</div>
                            )}
                        </div>

                        {/* Local storage - real usage from useStorageUsage */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Database size={13} color="var(--text-muted)" /> Local Storage</div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{storageUsage.usedKB.toFixed(2)} KB / {(storageUsage.capKB / 1024).toFixed(0)} MB</span>
                            </div>
                            <div style={{ height: '5px', borderRadius: '3px', background: 'var(--bg-main)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${storageUsage.percent}%`, background: 'var(--primary)', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                            </div>
                        </div>

                        {/* Background activity - honest labels for what's
                            actually running (the CloudSyncContext debounced
                            auto-push + scheduled backup, plus audio if it's
                            genuinely playing) - never a fabricated "queue". */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                            <div style={{ fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '2px' }}>Background Activity</div>
                            <div>• Auto-sync on change: {syncPaused ? 'paused' : 'active'}</div>
                            <div>• Scheduled backup: {syncPaused ? 'paused' : 'active'}</div>
                            {isPlaying && <div>• Audio playing: {currentTrack?.title || 'Untitled'}</div>}
                        </div>

                        {/* Quick controls - all real actions against the
                            live CloudSyncContext, not cosmetic buttons. */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={() => pushToCloud()}
                                disabled={isSyncing}
                                style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '11px', fontWeight: '700', cursor: isSyncing ? 'default' : 'pointer', opacity: isSyncing ? 0.6 : 1, fontFamily: 'inherit' }}
                            >
                                <RefreshCw size={12} /> Sync Now
                            </button>
                            <button
                                type="button"
                                onClick={() => setSyncPaused((v) => !v)}
                                style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                                {syncPaused ? <><PlayCircle size={12} /> Resume Sync</> : <><PauseCircle size={12} /> Pause Sync</>}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            )}

            {/* Right Actions & Profile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, minWidth: 0, WebkitAppRegion: 'no-drag' }}>

                {/* Mobile-only search trigger - moved here from the old
                    centered middle slot (see the comment above) so it
                    shares this row's own uniform 10px gap with Quick
                    Notes/Notifications/Theme/Avatar instead of floating in
                    a separately-centered flex:1 box with an inconsistent
                    gap to its neighbors. */}
                {isMobile && <MobileHeaderSearch setActiveTab={setActiveTab} />}

                {/* Real, reported gap closed: this Now Playing icon used to
                    be a desktop-only convenience (hidden on mobile, with
                    the claim that Audio Hub itself covered the same need) -
                    but mobile had NO way at all to see/control playback
                    from any OTHER page once the bottom mini-player bar was
                    correctly scoped back to just the Audio Hub tab (see
                    DashboardLayout.jsx's own GlobalAudioMiniPlayer) rather
                    than floating over every page. Unconditional now (not
                    inside the `!isMobile` block below) - the exact same
                    real controls (Shuffle/Prev/Play/Next/Repeat/Favourite/
                    seek) reachable from anywhere, matching what desktop
                    already had, "जैसे desktop पर था" per the explicit
                    request. Volume stays desktop-only inside this same
                    popover (see its own `!isMobile` guard below) - a real,
                    explicit call: mobile already has genuine hardware
                    volume buttons, an on-screen slider here would just be
                    redundant chrome. */}
                <div ref={audioRefContainer} style={{ position: 'relative' }}>
                    <button title="Focus Audio Studio" onClick={() => setIsAudioOpen(!isAudioOpen)} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '50%', width: '38px', height: '38px', flexShrink: 0, color: isPlaying ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Headphones size={18} /></button>
                    {isAudioOpen && (
                        <div style={{
                            // Real, reported bug, confirmed live via
                            // screenshot: position:'absolute', right:0
                            // anchors this popover to its OWN offset
                            // parent (the header's icon-row wrapper), not
                            // the true viewport edge. On desktop the
                            // headphone button sits close enough to the
                            // real right edge that a 260px-wide popover
                            // expanding leftward from right:0 always had
                            // room. On mobile this same button sits
                            // further from the screen's actual left edge
                            // than 260px allows, so the popover overflowed
                            // straight off the left side of the viewport -
                            // genuinely clipped, overlapping the NEXUS
                            // logo and whatever page content was
                            // underneath it, not just visually tight.
                            // position:'fixed' + viewport-relative
                            // centering sidesteps the whole offset-parent
                            // question on mobile - guaranteed to fit
                            // regardless of where the button itself sits.
                            // Desktop keeps the original anchor unchanged
                            // - this was never reported broken there.
                            position: isMobile ? 'fixed' : 'absolute',
                            ...(isMobile
                                ? { top: '64px', left: '50%', transform: 'translateX(-50%)' }
                                : { top: '120%', right: 0 }),
                            width: isMobile ? 'calc(100vw - 24px)' : '260px',
                            maxWidth: isMobile ? '320px' : 'none',
                            border: '1px solid var(--border-premium)',
                            borderRadius: '14px', padding: '16px', zIndex: 1100,
                            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                            background: 'rgba(15, 23, 42, 0.6)',
                            '--text-primary': '#FFFFFF', '--text-secondary': 'rgba(255,255,255,0.75)',
                            '--text-muted': 'rgba(255,255,255,0.55)', '--border-premium': 'rgba(255,255,255,0.14)',
                            '--widget-bg': 'rgba(255,255,255,0.08)', '--bg-surface': 'rgba(255,255,255,0.06)',
                            backdropFilter: 'blur(max(var(--glass-blur, 20px), 16px)) saturate(180%)', WebkitBackdropFilter: 'blur(max(var(--glass-blur, 20px), 16px)) saturate(180%)',
                        }}>
                            <div style={{
                                width: '56px', height: '56px', borderRadius: '50%', marginBottom: '10px', flexShrink: 0,
                                background: hasEverPlayed && currentTrack.artworkUrl ? `url(${currentTrack.artworkUrl}) center/cover` : `linear-gradient(135deg, var(--primary), var(--accent))`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
                            }}>
                                {!(hasEverPlayed && currentTrack.artworkUrl) && <Disc size={22} color="rgba(255,255,255,0.85)" />}
                            </div>
                            <p style={{ fontSize: '13px', color: hasEverPlayed ? 'var(--text-primary)' : 'var(--text-muted)', margin: 0, fontWeight: '700', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hasEverPlayed ? currentTrack.title : 'Nothing playing'}</p>
                            {hasEverPlayed && currentTrack.artist && (
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 14px 0', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.artist}</p>
                            )}
                            {!hasEverPlayed && <div style={{ marginBottom: '14px' }} />}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}>
                                <button onClick={toggleShuffle} title="Shuffle" style={{ background: 'transparent', border: 'none', color: shuffleEnabled ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', padding: '6px', display: 'flex', flexShrink: 0 }}><Shuffle size={14} /></button>
                                <button onClick={prev} title="Previous" style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', color: 'var(--text-secondary)', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><SkipBack size={14} /></button>
                                <button onClick={togglePlay} style={{ padding: '10px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '50%', width: '38px', height: '38px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                                </button>
                                <button onClick={next} title="Next" style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', color: 'var(--text-secondary)', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><SkipForward size={14} /></button>
                                <button onClick={cycleRepeatMode} title={`Repeat: ${repeatMode}`} style={{ background: 'transparent', border: 'none', color: repeatActive ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', padding: '6px', display: 'flex', flexShrink: 0 }}><RepeatIcon size={14} /></button>
                                {/* Real, reported gap closed: this popover
                                    had no way to favourite the currently
                                    playing track at all - the Audio Hub's
                                    own player/queue rows are the only place
                                    that ever offered it. Same real
                                    toggleFavoriteTrack + makeFavoriteKey
                                    every other favourite button in this app
                                    already uses, so it can never drift out
                                    of sync with what Favourites shows. */}
                                {hasEverPlayed && currentTrack.title && (() => {
                                    const favKey = makeFavoriteKey(currentTrack.title, currentTrack.source || (currentTrack.isLocal ? 'local' : undefined), currentTrack.artist);
                                    const isFav = favoriteTrackTitles.has(favKey);
                                    return (
                                        <button
                                            onClick={() => toggleFavoriteTrack(currentTrack.title, { artist: currentTrack.artist, url: currentTrack.url, uri: currentTrack.uri, source: currentTrack.source || (currentTrack.isLocal ? 'local' : undefined), artworkUrl: currentTrack.artworkUrl })}
                                            title={isFav ? 'Remove from Favourites' : 'Add to Favourites'}
                                            style={{ background: 'transparent', border: 'none', color: isFav ? '#F43F5E' : 'var(--text-secondary)', cursor: 'pointer', padding: '6px', display: 'flex', flexShrink: 0 }}
                                        >
                                            <Heart size={14} fill={isFav ? '#F43F5E' : 'none'} />
                                        </button>
                                    );
                                })()}
                            </div>

                            {(() => {
                                const safeDuration = duration && isFinite(duration) ? duration : 0;
                                const clampedTime = Math.min(currentTime, safeDuration);
                                const progressPct = safeDuration > 0 ? (clampedTime / safeDuration) * 100 : 0;
                                return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', marginTop: '12px' }}>
                                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700', flexShrink: 0, fontVariantNumeric: 'tabular-nums', width: '26px' }}>{formatTime(clampedTime)}</span>
                                        <div style={{ flex: 1, minWidth: 0, position: 'relative', height: '12px', display: 'flex', alignItems: 'center' }}>
                                            <div style={{ position: 'absolute', left: 0, right: 0, height: '3px', borderRadius: '2px', background: 'var(--surface-inset)', overflow: 'hidden' }}>
                                                <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--accent)', borderRadius: '2px', transition: 'width 1s linear' }} />
                                            </div>
                                            <input
                                                type="range" min={0} max={safeDuration} step="0.1"
                                                value={clampedTime}
                                                onChange={(e) => seek(parseFloat(e.target.value))}
                                                aria-label="Seek"
                                                style={{
                                                    position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0,
                                                    opacity: 0, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none',
                                                }}
                                            />
                                        </div>
                                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700', flexShrink: 0, fontVariantNumeric: 'tabular-nums', width: '26px', textAlign: 'right' }}>{safeDuration > 0 ? formatTime(safeDuration) : '--:--'}</span>
                                    </div>
                                );
                            })()}

                            {!isMobile && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', marginTop: '10px' }}>
                                    <button
                                        onClick={() => setIsVolumeOpen((v) => !v)} title={isMuted ? 'Unmute' : 'Volume'}
                                        style={{ background: 'transparent', border: 'none', color: isVolumeOpen ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}
                                    >
                                        {isMuted || volume === 0 ? <VolumeX size={14} /> : volume < 0.5 ? <Volume1 size={14} /> : <Volume2 size={14} />}
                                    </button>
                                    {isVolumeOpen && (
                                        <>
                                            <input
                                                type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume}
                                                onChange={(e) => setVolume(parseFloat(e.target.value))}
                                                aria-label="Volume"
                                                className="nexus-volume-range"
                                                style={{ flex: 1, minWidth: 0, accentColor: 'var(--primary)' }}
                                            />
                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', width: '28px', textAlign: 'right', flexShrink: 0 }}>{isMuted ? '--' : `${Math.round(volume * 100)}%`}</span>
                                        </>
                                    )}
                                </div>
                            )}

                            <button
                                onClick={() => { setIsAudioOpen(false); if (typeof setActiveTab === 'function') setActiveTab('audio_hub'); }}
                                style={{ marginTop: '12px', width: '100%', padding: '8px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', color: 'var(--text-secondary)', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                                <ListMusic size={13} /> Open Audio Hub
                            </button>
                        </div>
                    )}
                </div>

                {/* Quick Add and the AI Assistant shortcut are real,
                    desktop-convenience icons - hidden on mobile, since
                    their own real functionality remains fully reachable
                    elsewhere (the Planner page for tasks, the hamburger
                    menu for AI), and hiding them is what actually makes
                    room for the header to fit a real narrow screen without
                    the reported collision. Quick Notes is deliberately NOT
                    in this list (see its own button below, outside this
                    block) - it has no such alternate path anywhere else in
                    the app. Focus Audio Studio (above) is no longer in
                    this list either, per the explicit request that put it
                    on mobile too. */}
                {!isMobile && (
                <>
                {/* Quick Add Modal */}
                <div ref={quickAddRef} style={{ position: 'relative' }}>
                    <button title="Quick Add Task" onClick={() => setIsQuickAddOpen(!isQuickAddOpen)} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '50%', width: '38px', height: '38px', flexShrink: 0, color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={18} /></button>
                    {isQuickAddOpen && (
                        <div style={{ position: 'absolute', top: '120%', right: 0, width: '300px', background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '16px', zIndex: 1100, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>Quick Add Item</h4>
                                <X size={14} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsQuickAddOpen(false)} />
                            </div>

                            {/* Natural-language quick command - a real parser
                                (utils/quickCommandParser.js), routes straight
                                to Finance or Calendar. Separate from the
                                structured Planner/Study form below, which is
                                untouched. */}
                            <form
                                onSubmit={(e) => { e.preventDefault(); executeQuickCommand(); }}
                                style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid var(--border-premium)' }}
                            >
                                <label htmlFor="quick-command-input" style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Type a command</label>
                                <input
                                    id="quick-command-input" name="quickCommand" type="text" autoFocus
                                    placeholder={'e.g. "Add expense 500 for lunch"'}
                                    aria-label="Natural language quick command"
                                    value={quickCommandText}
                                    onChange={(e) => { setQuickCommandText(e.target.value); setQuickCommandFeedback(null); }}
                                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                                />
                                {quickCommandPreview && (
                                    <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '600' }}>{quickCommandPreview.summary}</span>
                                )}
                                {quickCommandText.trim() && !quickCommandPreview && (
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Try "Add expense 500 for lunch" or "Schedule gym tomorrow at 6 PM".</span>
                                )}
                                {quickCommandFeedback && (
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: quickCommandFeedback.type === 'error' ? '#EF4444' : '#10B981' }}>{quickCommandFeedback.message}</span>
                                )}
                                <button
                                    type="submit" disabled={!quickCommandPreview}
                                    style={{ padding: '8px', background: quickCommandPreview ? 'var(--primary)' : 'var(--widget-bg)', color: quickCommandPreview ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '12px', cursor: quickCommandPreview ? 'pointer' : 'default' }}
                                >
                                    Run Command
                                </button>
                            </form>

                            <form onSubmit={handleQuickSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <input type="text" placeholder="Enter title..." aria-label="Quick add title" value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                                <select value={quickCategory} onChange={(e) => setQuickCategory(e.target.value)} aria-label="Quick add category" style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}>
                                    <option value="Planner" style={{ background: 'var(--surface-inset)' }}>Planner Task</option>
                                    <option value="Study" style={{ background: 'var(--surface-inset)' }}>Study Item</option>
                                </select>
                                <button type="submit" style={{ padding: '8px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>Add to System</button>
                            </form>
                        </div>
                    )}
                </div>

                {/* AI Assistant Single Click */}
                <button title="Nexus AI Assistant" onClick={() => setActiveTab('AI')} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '50%', width: '38px', height: '38px', flexShrink: 0, color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkles size={18} /></button>
                </>
                )}

                {/* Quick Notes - deliberately OUTSIDE the !isMobile block
                    above (unlike Quick Add/Focus Audio/AI Assistant): those
                    three each have a real, reachable alternate path on
                    mobile (Planner page, Audio Hub page, the hamburger
                    menu), but Quick Notes has none - QuickNotesModal is
                    only ever rendered from here, so hiding this button on
                    mobile made the entire feature permanently unreachable
                    on a phone, not just relocated. Kept as its own
                    unconditional icon (same treatment already given to
                    Notifications/Theme below) rather than folded into
                    MobileSidebarDrawer's nav list, since that list is
                    real page navigation and this opens a modal, not a page. */}
                <button title="Quick Notes" onClick={() => setIsQuickNotesOpen(true)} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '50%', width: '38px', height: '38px', flexShrink: 0, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><StickyNote size={18} /></button>

                {/* Notification Center (Point 11) - real data derived in
                    useNotifications.js from severe weather, upcoming
                    Calendar events, and overdue/due-soon Finance bills &
                    Planner tasks. The panel itself is always mounted (see
                    NotificationDropdown.jsx) so its CSS entrance/exit
                    transitions actually play; this wrapping notifRef div
                    is what the existing header-wide click-outside effect
                    above already targets, unchanged from before. */}
                <div ref={notifRef} style={{ position: 'relative' }}>
                    <button
                        title="Notifications"
                        aria-expanded={isNotifOpen}
                        onClick={() => setIsNotifOpen((v) => !v)}
                        style={{
                            position: 'relative',
                            background: isNotifOpen ? 'var(--primary-muted, rgba(99,102,241,0.15))' : 'var(--widget-bg)',
                            border: `1px solid ${isNotifOpen ? 'var(--primary, #6366f1)' : 'var(--border-premium)'}`,
                            borderRadius: '50%', width: '38px', height: '38px', flexShrink: 0,
                            color: isNotifOpen ? 'var(--primary, #6366f1)' : 'var(--text-primary)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                        }}
                    >
                        <Bell size={18} />
                        {unreadCount > 0 && (
                            <span className="nexus-notif-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                        )}
                    </button>
                    <NotificationDropdown
                        isOpen={isNotifOpen}
                        anchorRef={notifRef}
                        onClose={() => setIsNotifOpen(false)}
                        notifications={notifications}
                        unreadCount={unreadCount}
                        onMarkRead={markRead}
                        onMarkAllRead={markAllRead}
                        onClearAll={clearAll}
                        setActiveTab={setActiveTab}
                    />
                </div>
                
                {/* Theme Toggle - now shown on mobile too, sitting right
                    between Notifications and the Profile avatar (its
                    existing DOM position already put it exactly there;
                    it just needed to stop being hidden below the mobile
                    breakpoint). Still also reachable via Settings. */}
                <button title="Cycle Theme" onClick={cycleTheme} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '50%', width: '38px', height: '38px', flexShrink: 0, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {getThemeIcon()}
                </button>

                {/* Profile Section - name/level text hidden on mobile,
                    avatar-only, a real, standard mobile-app space-saving
                    convention. */}
                <div onClick={() => setActiveTab('Profile')} style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: isMobile ? 0 : '14px', borderLeft: isMobile ? 'none' : '1px solid var(--border-premium)', cursor: 'pointer', flexShrink: 0, minWidth: 0 }}>
                    <div style={{
                        // Slightly smaller on mobile - fits the header's own
                        // slim 60px height comfortably and brings it in line
                        // with the other 34-38px icons next to it instead of
                        // sticking out as the single largest element.
                        width: isMobile ? '36px' : '44px', height: isMobile ? '36px' : '44px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                        WebkitMaskImage: 'radial-gradient(white, black)', maskImage: 'radial-gradient(white, black)',
                        background: profileData.avatarUrl ? 'transparent' : 'linear-gradient(135deg, #3B82F6, #8B5CF6, #EC4899)',
                        boxShadow: '0 0 15px rgba(139, 92, 246, 0.4), inset 0 2px 4px rgba(255,255,255,0.3)',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: '900', fontSize: isMobile ? '15px' : '18px', border: '1px solid rgba(255,255,255,0.2)',
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
        {isQuickNotesOpen && (
            <QuickNotesModal
                onClose={() => setIsQuickNotesOpen(false)}
                jumpTarget={pendingNotesJump}
                onJumpConsumed={() => setPendingNotesJump(null)}
            />
        )}
        </>
    );
};

export default Header;