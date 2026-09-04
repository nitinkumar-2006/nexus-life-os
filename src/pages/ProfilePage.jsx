// src/pages/ProfilePage.jsx
import { useState, useEffect } from 'react';
import ImageCropModal from '../components/ImageCropModal.jsx';
import ProfileImageEditModal from '../components/ProfileImageEditModal.jsx';
import { useStreaming } from '../context/StreamingContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCloudSync } from '../context/CloudSyncContext.jsx';
import { sanitizeNumberInput, normalizeNumberOnBlur } from '../utils/smartNumberInput.js';
import { useGlobalSettings } from '../context/GlobalUserSettingsContext.jsx';
import { getLocalDateString } from '../utils/dateUtils.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import {
    User, BookOpen, Flame, Save,
    CheckCircle, Sparkles, Edit3, Dumbbell,
    Wallet, Trophy, Activity, Terminal, Code, Star, Cpu, Database,
    BarChart, Globe, GitBranch, Camera, Image as ImageIcon,
    X, Quote, Calendar, Clock, Target, ArrowUpRight, ArrowLeft, CheckSquare, Apple, Disc, Cloud, LogOut,
    Briefcase, GraduationCap, Video, Music2, Bot
} from 'lucide-react';

// Sleek connection status widget - shows whether Apple Music/Spotify is
// linked, and which one (if any) is the currently active playback source.
// Reads live from StreamingContext, so connecting/disconnecting from the
// Audio Hub page is reflected here immediately without any extra wiring.
// One real, self-contained status box per service - not a single pill
// whose shape changed depending on how many services happened to be
// connected. Both boxes are always present, same size, same structure,
// so they align cleanly and stay parallel in the row regardless of
// connection state, rather than reflowing awkwardly between "empty pill"
// and "N inline entries" shapes.
//
// Each platform's signature color is now a persistent identity, not
// something that only appears once connected/active - the icon is always
// rendered in that platform's real brand color (Apple's signature red,
// Spotify's signature green), so the two boxes are visually distinct at a
// glance regardless of connection state. A small dot next to the label is
// the actual live connection indicator - dim/muted when not connected,
// bright brand-colored when connected, with a glow added specifically for
// "this one is the active playback source" so all three real states
// (not connected / connected / active) stay visually distinguishable even
// though the icon and border color no longer change between them.
const StreamingServiceBox = ({ label, icon, connected, isActive, brandColor }) => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 160px', minWidth: '150px', maxWidth: '230px',
        background: 'var(--widget-bg)',
        border: `1px solid ${connected ? brandColor : `${brandColor}40`}`,
        borderRadius: '12px', padding: '10px 14px', boxSizing: 'border-box',
    }}>
        {icon}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: '600', color: connected ? brandColor : 'var(--text-muted)' }}>
                <span style={{
                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                    background: connected ? brandColor : 'var(--text-muted)',
                    boxShadow: isActive ? `0 0 6px ${brandColor}` : 'none',
                }} />
                {connected ? (isActive ? 'Active' : 'Connected') : 'Not Connected'}
            </span>
        </div>
    </div>
);

// Real brand color/label per AI provider - copied to match SettingsPage's
// own "AI & Learning API Integrations" card exactly (OpenAI/Gemini/Grok/
// DeepSeek), and the confirmed-key flag each provider's own field there
// already sets (settings.geminiApiKeyConfirmed etc.) is the single real
// source of "did this user actually finish connecting it", not just
// "did they paste something into the field".
const AI_PROVIDER_META = {
    gemini: { label: 'Gemini', confirmedKey: 'geminiApiKeyConfirmed', color: '#4285F4' },
    openai: { label: 'ChatGPT', confirmedKey: 'openaiApiKeyConfirmed', color: '#10A37F' },
    grok: { label: 'Grok', confirmedKey: 'grokApiKeyConfirmed', color: '#F97316' },
    deepseek: { label: 'DeepSeek', confirmedKey: 'deepseekApiKeyConfirmed', color: '#4D6BFE' },
};

const readAiConnectionState = () => {
    let confirmedByProvider = {};
    try {
        const saved = JSON.parse(localStorage.getItem('nexus_global_settings') || '{}');
        confirmedByProvider = {
            gemini: !!saved.geminiApiKeyConfirmed,
            openai: !!saved.openaiApiKeyConfirmed,
            grok: !!saved.grokApiKeyConfirmed,
            deepseek: !!saved.deepseekApiKeyConfirmed,
        };
    } catch (e) { /* malformed store - every provider reports not-confirmed below */ }
    let activeProvider = 'gemini';
    try { activeProvider = localStorage.getItem('nexus_ai_provider') || 'gemini'; } catch (e) { /* default stands */ }
    return { activeProvider, confirmedByProvider };
};

// Every real, actually-connected service/provider renders here, and only
// those - per explicit request, a "Not Connected" box for something the
// user never linked isn't real status, it's a placeholder ad for a
// feature they haven't used. This used to only check Apple Music/
// Spotify, which is exactly why connecting Gemini or YouTube never
// showed up here - now covers every real connection this app tracks
// (all four StreamingContext sources, plus whichever AI provider is
// both selected in the AI page AND has a confirmed key in Settings),
// each checked independently so linking any one of them live makes it
// appear here immediately with no extra wiring.
const ConnectionsStatusWidget = ({ isMobile }) => {
    const { appleMusicAuth, spotifyAuth, youtubeAuth, saavnAuth, activeSource } = useStreaming();
    const [aiState, setAiState] = useState(readAiConnectionState);

    useEffect(() => {
        const sync = () => setAiState(readAiConnectionState());
        window.addEventListener('nexus_settings_updated', sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener('nexus_settings_updated', sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

    const aiMeta = AI_PROVIDER_META[aiState.activeProvider];
    const aiConnected = !!aiMeta && !!aiState.confirmedByProvider[aiState.activeProvider];

    const hasAny = appleMusicAuth.connected || spotifyAuth.connected || youtubeAuth.connected || saavnAuth.connected || aiConnected;

    if (!hasAny) {
        return (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
                No services connected yet - link music from Audio Hub or an AI provider in Settings.
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: '10px', width: '100%', justifyContent: isMobile ? 'center' : 'flex-start' }}>
            {appleMusicAuth.connected && (
                <StreamingServiceBox
                    label="Apple Music"
                    icon={<Apple size={16} color="#FA233B" style={{ flexShrink: 0 }} />}
                    connected
                    isActive={activeSource === 'apple'}
                    brandColor="#FA233B"
                />
            )}
            {spotifyAuth.connected && (
                <StreamingServiceBox
                    label="Spotify"
                    icon={<Disc size={16} color="#1DB954" style={{ flexShrink: 0 }} />}
                    connected
                    isActive={activeSource === 'spotify'}
                    brandColor="#1DB954"
                />
            )}
            {youtubeAuth.connected && (
                <StreamingServiceBox
                    label="YouTube"
                    icon={<Video size={16} color="#FF0000" style={{ flexShrink: 0 }} />}
                    connected
                    isActive={activeSource === 'youtube'}
                    brandColor="#FF0000"
                />
            )}
            {saavnAuth.connected && (
                <StreamingServiceBox
                    label="Saavn"
                    icon={<Music2 size={16} color="#2BC5B4" style={{ flexShrink: 0 }} />}
                    connected
                    isActive={false}
                    brandColor="#2BC5B4"
                />
            )}
            {aiConnected && (
                <StreamingServiceBox
                    label={aiMeta.label}
                    icon={<Bot size={16} color={aiMeta.color} style={{ flexShrink: 0 }} />}
                    connected
                    isActive
                    brandColor={aiMeta.color}
                />
            )}
        </div>
    );
};

// A single, clean, minimalist stat card - the one shared shape behind
// every quick-glance number in the profile header (Level, Hubs, Done,
// Cache, Semester). One consistent size/shape so the whole row reads as
// real, separated cards, not a mix of a floating avatar badge, a
// standalone pill, and a 3-card grid all styled differently.
// Real, live-caught mobile bug: this card was built and sized for short,
// bounded values (a level number, a percentage, a byte-size, a task
// count - none longer than ~7 characters at this 17px size). SEMESTER is
// the one genuinely free-text field among the six cards that reuse this
// component (profile.semester is a plain text input, no length limit -
// see its own placeholder "e.g. 6th Semester") - "3rd Semester" measured
// as visibly clipped ("3rd Se...") at the fixed 17px size, the only one
// of the six that didn't fit. Rather than truncate real user-entered
// text or shrink every OTHER card's font for one outlier, the value's
// own font size now steps down for a longer string - short values
// (the other five cards, always) render exactly as before.
const ProfileStatCard = ({ icon: Icon, iconColor, value, label }) => (
    <div className="profile-glass-card" style={{
        background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '16px',
        padding: '16px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: 0,
    }}>
        <Icon size={18} color={iconColor} />
        <span style={{ fontSize: String(value ?? '').length > 10 ? '11px' : String(value ?? '').length > 8 ? '13px' : '17px', fontWeight: '800', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{value}</span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.5px', textAlign: 'center' }}>{label}</span>
    </div>
);

const ProfilePage = () => {
    const isMobile = useIsMobile();
    const { settings, updateSetting } = useGlobalSettings();
    const { user, isConfigured, logout } = useAuth();
    const { isSyncing, lastSyncedAt } = useCloudSync();
    // 🚨 Fresh Default State matching clean OS reset ("New User")
    const defaultProfile = {
        name: '',
        email: '',
        role: '',
        college: '',
        semester: '',
        bio: '',
        quoteOfDay: '',
        currentStatus: 'Not Set',
        githubUrl: '',
        linkedinUrl: '',
        portfolioUrl: '',
        avatarUrl: '', 
        coverUrl: '',
        // Live Focus / "What I'm Learning" - a single free-text line, empty by
        // default so it correctly shows "Not Set" until the user fills it in.
        currentFocus: '',
        // Skills & Tech Stack tracker. The three category labels the app
        // ships with are pre-named (as requested) but every progress value
        // starts at a real, honest 0% - not a fabricated number - until the
        // user sets their own. Fully editable: add/remove/rename freely.
        skills: [
            { id: 'skill-c', name: 'C', progress: 0 },
            { id: 'skill-java', name: 'Java', progress: 0 },
            { id: 'skill-aiml', name: 'AI/ML', progress: 0 },
        ],
        // Milestone & Achievement Timeline - empty until the user adds one.
        milestones: [],
    };

    const [profile, setProfile] = useState(() => {
        const saved = localStorage.getItem('nexus_user_profile');
        if (saved) {
            try { return { ...defaultProfile, ...JSON.parse(saved) }; } catch (e) { return defaultProfile; }
        }
        return defaultProfile;
    });

    const [isSaved, setIsSaved] = useState(false);
    // Surfaces a genuine write failure (e.g. QuotaExceededError from the
    // embedded avatar/cover base64 images added via ImageCropModal) rather
    // than leaving Save silently do nothing - previously an uncaught throw
    // here meant the form just sat there with no feedback at all.
    const [saveError, setSaveError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTabState] = useState('overview');
    const [completionPercentage, setCompletionPercentage] = useState(0);

    // Live Synced Module Stats
    const [stats, setStats] = useState({
        completedTasks: 0,
        studyCount: 0,
        storageSize: '0 KB',
        productivityScore: 0,
        recentActivity: [],
        heatmapData: [],
        level: 1, 
        xpProgress: 0,
        dailyFocus: 'Not Set',
        weeklyConsistency: '0%',
        monthlyTasks: 0
    });

    // Calculate Profile Completion
    useEffect(() => {
        const { skills, milestones, ...scalarFields } = profile;
        const fields = Object.values(scalarFields);
        const filledFields = fields.filter(field => field !== '' && field !== 0 && field !== null).length;
        // Arrays need their own "is this meaningfully filled in" check, since
        // a plain !== '' comparison treats even an empty array as "filled".
        const skillsFilled = Array.isArray(skills) && skills.some((s) => s.progress > 0) ? 1 : 0;
        const milestonesFilled = Array.isArray(milestones) && milestones.length > 0 ? 1 : 0;
        const totalFields = fields.length + 2;
        const percentage = Math.round(((filledFields + skillsFilled + milestonesFilled) / totalFields) * 100);
        setCompletionPercentage(percentage);
    }, [profile]);

    // Uploading now opens the crop modal instead of saving instantly - the
    // raw file is read into a data URL just to preview/crop; nothing is
    // written to `profile` until the user confirms the crop.
    const [cropModal, setCropModal] = useState(null); // null | { type: 'avatarUrl'|'coverUrl', src: string }
    // Which image the tap-to-edit modal (opened by tapping the avatar or
    // cover banner directly, outside the big Edit Profile form) is
    // currently targeting.
    const [editingImageType, setEditingImageType] = useState(null); // null | 'avatarUrl' | 'coverUrl'

    const handleImageUpload = (e, type) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCropModal({ type, src: reader.result });
            };
            reader.readAsDataURL(file);
        }
        e.target.value = ''; // allow re-selecting the same file later
    };

    // Reachable both from inside the Edit Profile form (Upload Avatar/Cover
    // buttons) and from the standalone tap-to-edit modal below - persisting
    // immediately (rather than only on the form's own Save button) is what
    // makes the second path actually save anything, and is harmless from
    // the first path since Save just writes the same already-current value.
    const handleCropSave = (croppedDataUrl) => {
        if (!cropModal) return;
        persistProfile({ ...profile, [cropModal.type]: croppedDataUrl });
        setCropModal(null);
    };

    const handleCropCancel = () => setCropModal(null);

    const handlePresetSelect = (type, dataUrl) => {
        persistProfile({ ...profile, [type]: dataUrl });
        setEditingImageType(null);
    };

    const handleImageEditModalUpload = (e) => {
        const type = editingImageType;
        setEditingImageType(null);
        handleImageUpload(e, type);
    };

    // Pull REAL metrics from localStorage
    useEffect(() => {
        try {
            const planner = JSON.parse(localStorage.getItem('nexus_planner_tasks') || '[]');
            // Syllabus is the real, current owner of subject data now -
            // nexus_study_subjects is a dead key StudyPage stopped writing
            // to once Syllabus took over (see StudyPage.jsx's own comment);
            // reading it here always returned an empty array for any user
            // on the current Syllabus flow, silently zeroing out this
            // page's "Study Hub" activity feed entries and studyCount.
            const study = JSON.parse(localStorage.getItem('nexus_syllabus_subjects') || '[]');
            
            const completed = planner.filter(t => t.completed).length;
            const total = planner.length;
            const score = total > 0 ? Math.round((completed / total) * 100) : 0;

            const totalXP = completed * 50;
            const calculatedLevel = Math.floor(totalXP / 500) + 1;
            const xpPercentage = totalXP > 0 ? ((totalXP % 500) / 500 * 100) : 0;

            let totalBytes = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalBytes += (localStorage[key].length + key.length) * 2;
                }
            }
            const sizeKB = totalBytes > 0 ? (totalBytes / 1024).toFixed(1) + ' KB' : '0 KB';

            // Real GitHub-style heatmap, derived from actual task creation
            // timestamps (every task's `id` is a Date.now() value set when
            // it was created - see header.jsx/PlannerPage.jsx) - not a
            // fabricated pattern. Always a full, fixed 371-day (53-week)
            // grid, matching how GitHub's own heatmap actually behaves: it
            // always shows a complete year shape, even for an account that
            // joined yesterday - the DATA inside is what's genuinely real
            // (mostly empty/level-0 for any day before real activity
            // existed), not the grid's own size. An earlier version here
            // sized the grid to days-since-account-creation instead, which
            // in practice just meant a brand-new account saw a handful of
            // cells instead of the familiar full-year shape - confirmed
            // over live feedback that this read as broken/incomplete
            // rather than "correctly short," so this reverts to the fixed
            // size while keeping the real per-day counts unchanged.
            const activityByDay = {};
            planner.forEach((t) => {
                if (typeof t.id === 'number' && t.id > 1000000000000) {
                    const key = getLocalDateString(new Date(t.id));
                    activityByDay[key] = (activityByDay[key] || 0) + 1;
                }
            });
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const ANNUAL_DAYS = 371; // 53 weeks x 7 - a clean GitHub-style grid
            const realHeatmap = Array.from({ length: ANNUAL_DAYS }, (_, i) => {
                const d = new Date(today);
                d.setDate(d.getDate() - (ANNUAL_DAYS - 1 - i));
                const key = getLocalDateString(d);
                const count = activityByDay[key] || 0;
                let level = 0;
                if (count >= 1) level = 1;
                if (count >= 3) level = 2;
                if (count >= 6) level = 3;
                if (count >= 10) level = 4;
                return { date: key, count, level };
            });

            let feed = [];
            study.forEach(s => feed.push({ title: `Study Hub: ${s.name || s.title || 'Subject'}`, time: 'Active' }));
            planner.slice(-5).forEach(t => feed.push({ title: `Task: ${t.title}`, time: t.completed ? 'Completed' : 'Pending' }));

            // Today's Focus - a real, computed value: the highest-priority
            // pending task genuinely due today (High > Medium > Low,
            // earliest-created as the tiebreak), falling back to the Growth
            // tab's own "Live Focus" line when nothing is due today, and
            // only ever "Not Set" when neither exists. Previously this
            // effect never wrote dailyFocus back at all, so the Analytics
            // tab was permanently stuck on its own initial "Not Set" value
            // no matter what was actually on the planner.
            const todayKey = getLocalDateString(today);
            const priorityRank = { High: 0, Medium: 1, Low: 2 };
            const todaysPending = planner
                .filter((t) => !t.completed && t.dueDate === todayKey)
                .sort((a, b) => (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3) || (a.id || 0) - (b.id || 0));
            const dailyFocus = todaysPending[0]?.title || profile.currentFocus || 'Not Set';

            // Weekly Consistency - the real % of the last 7 days (today
            // included) that had at least one genuine task created, reusing
            // the exact same activityByDay map the heatmap above is built
            // from so this can never disagree with what the heatmap itself
            // shows for the same week. Also never written back before this
            // fix - permanently stuck at its own "0%" initial value.
            let activeDaysInWeek = 0;
            for (let i = 0; i < 7; i += 1) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                if ((activityByDay[getLocalDateString(d)] || 0) > 0) activeDaysInWeek += 1;
            }
            const weeklyConsistency = `${Math.round((activeDaysInWeek / 7) * 100)}%`;

            // Tasks This Month - genuinely scoped to the current calendar
            // month by each task's own dueDate. `total` (planner.length,
            // used just above for the all-time productivityScore) was
            // being shown under this exact "This Month" label before this
            // fix - a real, different, always-larger number for anyone
            // with tasks from a prior month still on their planner.
            const currentMonthKey = todayKey.slice(0, 7); // 'YYYY-MM'
            const monthlyTaskCount = planner.filter((t) => typeof t.dueDate === 'string' && t.dueDate.startsWith(currentMonthKey)).length;

            setStats(prev => ({
                ...prev,
                completedTasks: completed,
                studyCount: study.length,
                storageSize: sizeKB,
                productivityScore: score,
                recentActivity: feed,
                heatmapData: realHeatmap,
                level: calculatedLevel,
                xpProgress: xpPercentage,
                dailyFocus,
                weeklyConsistency,
                monthlyTasks: monthlyTaskCount
            }));
        } catch (err) {
            console.error("Profile metrics sync error:", err);
        }
    }, [isEditing]);

    const handleSave = (e) => {
        e.preventDefault();
        try {
            localStorage.setItem('nexus_user_profile', JSON.stringify(profile));
        } catch (err) {
            setSaveError(err && err.name === 'QuotaExceededError'
                ? 'Storage is full - try a smaller photo, or clear some data in Settings.'
                : 'Could not save your profile. Please try again.');
            setTimeout(() => setSaveError(''), 5000);
            return;
        }

        // ⚡ INSTANT LIVE SYNC: Broadcast events so Header and GreetingCard update immediately
        window.dispatchEvent(new Event('nexus_profile_updated'));
        window.dispatchEvent(new Event('storage'));

        setSaveError('');
        setIsSaved(true);
        setIsEditing(false);
        setTimeout(() => setIsSaved(false), 3000);
    };

    const handleCancel = () => {
        const saved = localStorage.getItem('nexus_user_profile');
        if (saved) {
            setProfile({ ...defaultProfile, ...JSON.parse(saved) });
        } else {
            setProfile(defaultProfile);
        }
        setIsEditing(false);
    };

    // Skills, current focus, and milestones are edited inline in the Growth
    // tab (not through the big form), so each change persists immediately -
    // consistent with how live counters elsewhere in the app work.
    const persistProfile = (updated) => {
        setProfile(updated);
        try {
            localStorage.setItem('nexus_user_profile', JSON.stringify(updated));
        } catch (err) {
            setSaveError(err && err.name === 'QuotaExceededError'
                ? 'Storage is full - try a smaller photo, or clear some data in Settings.'
                : 'Could not save your profile. Please try again.');
            setTimeout(() => setSaveError(''), 5000);
            return;
        }
        window.dispatchEvent(new Event('nexus_profile_updated'));
        window.dispatchEvent(new Event('storage'));
    };

    const updateSkillProgress = (id, progress) => {
        persistProfile({ ...profile, skills: profile.skills.map((s) => (s.id === id ? { ...s, progress } : s)) });
    };

    const addSkill = () => {
        const name = window.prompt('Skill or technology name:');
        if (!name || !name.trim()) return;
        const newSkill = { id: `skill-${Date.now()}`, name: name.trim(), progress: 0 };
        persistProfile({ ...profile, skills: [...profile.skills, newSkill] });
    };

    const removeSkill = (id) => {
        persistProfile({ ...profile, skills: profile.skills.filter((s) => s.id !== id) });
    };

    const addMilestone = () => {
        const title = window.prompt('Milestone or achievement title:');
        if (!title || !title.trim()) return;
        const date = window.prompt('Date (e.g. "March 2026"):') || '';
        const newMilestone = { id: `milestone-${Date.now()}`, title: title.trim(), date: date.trim() };
        persistProfile({ ...profile, milestones: [newMilestone, ...profile.milestones] });
    };

    const removeMilestone = (id) => {
        persistProfile({ ...profile, milestones: profile.milestones.filter((m) => m.id !== id) });
    };

    const displayName = profile.name || 'New User';
    const avatarInitial = profile.avatarUrl ? '' : (profile.name ? profile.name.charAt(0).toUpperCase() : 'U');
    const statusColor = profile.currentStatus.startsWith('🔴')
        ? '#EF4444'
        : profile.currentStatus.startsWith('🟡')
            ? '#F59E0B'
            : profile.currentStatus.startsWith('🌙')
                ? '#818CF8'
                : profile.currentStatus.startsWith('🟢')
                    ? '#10B981'
                    : '#94A3B8'; // "Not Set" - neutral grey, not a false "active" green

    return (
        <div className="profile-page-root" style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px', animation: 'fadeInScale 0.3s ease', position: 'relative', paddingBottom: '40px' }}>

            {/* Success Toast - was previously positioned relative to the
                header section removed above; now positioned relative to
                this same outer page container instead, so it still
                centers correctly at the very top of the page. */}
            {isSaved && (
                <div style={{ position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%)', zIndex: 100, display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 24px', background: '#059669', color: '#fff', borderRadius: '12px', fontWeight: '700', fontSize: '14px', boxShadow: '0 10px 30px rgba(16, 185, 129, 0.3)', animation: 'slideDown 0.3s ease' }}>
                    <CheckCircle size={20} /> Identity successfully synchronized with Header & Greeting!
                </div>
            )}

            {saveError && (
                <div style={{ position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%)', zIndex: 100, display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 24px', background: '#DC2626', color: '#fff', borderRadius: '12px', fontWeight: '700', fontSize: '14px', boxShadow: '0 10px 30px rgba(220, 38, 38, 0.3)', animation: 'slideDown 0.3s ease' }}>
                    <X size={20} /> {saveError}
                </div>
            )}

            {/* Main Profile Dashboard - completely hidden while editing,
                per this request's own explicit "completely hide the main
                Profile dashboard" ask. isEditing and isSaved are never
                true at the same time (saving sets isEditing false and
                isSaved true together), so the toast above stays outside
                this conditional safely. */}
            {!isEditing && (
            <>
            {/* Profile Cover Card */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '24px', overflow: 'hidden', boxShadow: 'var(--premium-shadow)' }}>
                {/* Dynamic Cover Banner - a plain, non-clickable div now,
                    not a giant button spanning the whole banner: clicking
                    anywhere on the banner used to open the cover editor,
                    which is a real over-eager click target once the
                    "Change Cover" label itself was the only thing meant to
                    trigger it. That label previously also sat bottom-left,
                    directly under where the avatar (its own -56px negative
                    margin pulls it up into the banner) visually overlaps -
                    moved here to stack with the status pill in the top-
                    right corner instead, clear of the avatar entirely. */}
                <div
                    className="profile-cover-banner"
                    style={{
                        height: '160px', width: '100%',
                        // Quoted url() - unquoted CSS url() tokens treat the
                        // first unescaped ')' as the closing delimiter, which
                        // silently breaks on preset cover SVGs (their
                        // data URI contains literal '(' / ')' from rgba()
                        // fills that encodeURIComponent doesn't escape).
                        // Real base64 photo uploads never hit this since
                        // base64's alphabet has no parentheses, which is why
                        // this went unnoticed until presets were added.
                        background: profile.coverUrl ? `url("${profile.coverUrl}") center/cover no-repeat` : 'linear-gradient(135deg, rgba(var(--primary-rgb, 255, 180, 0), 0.2), rgba(16, 185, 129, 0.1))',
                        position: 'relative',
                        borderBottom: '1px solid var(--border-premium)',
                        padding: '16px 24px',
                        boxSizing: 'border-box',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '8px',
                    }}
                >
                    <span style={{ fontSize: '12px', background: 'rgba(0,0,0,0.5)', padding: '6px 14px', borderRadius: '20px', color: statusColor, fontWeight: '700', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '6px', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor, display: 'inline-block', boxShadow: `0 0 10px ${statusColor}` }}></span> {profile.currentStatus.replace(/🟢|🔴|🟡|🌙/g, '').trim()}
                    </span>
                    <button
                        type="button"
                        onClick={() => setEditingImageType('coverUrl')}
                        aria-label="Change cover banner"
                        title="Change cover banner"
                        style={{ fontSize: '11px', fontWeight: '700', color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '5px 12px', borderRadius: '20px', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                        <ImageIcon size={12} /> Change Cover
                    </button>
                </div>

                {/* Profile Details Body */}
                <div style={{ padding: isMobile ? '0 20px 28px 20px' : '0 32px 32px 32px', position: 'relative' }}>
                    {/* Dynamic Avatar - centered on mobile (Instagram/
                        LinkedIn-style centered mobile header) instead of
                        pinned to the left edge, matching the rest of the
                        mobile header below (name/bio/actions also
                        centered). No badge pinned to its corner anymore -
                        Level now lives as a real, separate card in the
                        stats row below instead of crowding the avatar. */}
                    <div style={{
                        width: '112px', height: '112px', borderRadius: '50%',
                        margin: isMobile ? '-56px auto 0 auto' : '-56px 0 0 0',
                        // Premium ring glow layered onto the original drop-
                        // shadow (not moved to a CSS class - inline style
                        // always wins over an external one for the same
                        // property, so a className-based box-shadow here
                        // would just be silently overridden, not combined).
                        // Ring thinned to 2px (was 4px) and the glow pulled
                        // in slightly - the original read as too heavy/
                        // chunky around the avatar per explicit feedback.
                        boxShadow: '0 8px 25px rgba(0,0,0,0.4), 0 0 0 2px var(--bg-surface), 0 0 18px 2px rgba(var(--primary-rgb), 0.35)', position: 'relative', zIndex: 2,
                        flexShrink: 0, background: 'transparent'
                    }}>
                        <button
                            type="button"
                            data-diag="profile-avatar"
                            onClick={() => setEditingImageType('avatarUrl')}
                            aria-label="Change avatar"
                            title="Change avatar"
                            style={{
                                position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden',
                                WebkitMaskImage: 'radial-gradient(white, black)', maskImage: 'radial-gradient(white, black)',
                                background: profile.avatarUrl ? 'transparent' : 'var(--primary)',
                                border: '6px solid var(--bg-surface)', boxSizing: 'border-box',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--text-on-primary)', fontSize: '42px', fontWeight: '800',
                                padding: 0, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                        >
                            {profile.avatarUrl ? (
                                <img
                                    src={profile.avatarUrl}
                                    alt="Avatar"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: 'transparent' }}
                                />
                            ) : avatarInitial}
                            <span style={{ position: 'absolute', bottom: 0, right: 0, width: '30px', height: '30px', borderRadius: '50%', background: 'var(--accent)', border: '3px solid var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
                                <Camera size={13} color="#fff" />
                            </span>
                        </button>
                    </div>

                    {/* Identity block: name, verified badge, professional
                        headline, bio, and ONE consolidated action row
                        (Edit Profile + every real social link) - all in a
                        single column now, not split across a left "info"
                        side and a disconnected right "actions" column
                        like before. This is the actual fix for the
                        "scattered tags" complaint. */}
                    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'center' : 'flex-start', textAlign: isMobile ? 'center' : 'left', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                            <h2 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{displayName}</h2>
                            {profile.name && <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 10px', background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.2)', flexShrink: 0 }}>Verified</span>}
                        </div>

                        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', fontWeight: '600', margin: '4px 0 0 0' }}>
                            {profile.role || 'Role Not Set'} <span style={{ color: 'var(--text-muted)' }}>•</span> {profile.college || 'Institution Not Set'}
                        </p>

                        {profile.quoteOfDay && (
                            <div style={{ display: 'flex', gap: '10px', background: 'var(--widget-bg)', padding: '12px 16px', borderRadius: '12px', borderLeft: '4px solid var(--accent)', marginTop: '14px', maxWidth: '600px', minWidth: 0, textAlign: 'left' }}>
                                <Quote size={18} color="var(--accent)" style={{ opacity: 0.7, marginTop: '2px', flexShrink: 0 }} />
                                <p style={{ fontSize: '14px', color: 'var(--text-primary)', fontStyle: 'italic', fontWeight: '500', lineHeight: '1.4', minWidth: 0, overflowWrap: 'break-word', margin: 0 }}>{profile.quoteOfDay}</p>
                            </div>
                        )}

                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '600px', lineHeight: '1.6', margin: '12px 0 0 0' }}>{profile.bio || 'Edit your profile to add a bio and configure your personal operating system.'}</p>

                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '18px', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                            <button
                                onClick={() => !isEditing && setIsEditing(true)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}
                            >
                                <Edit3 size={16} /> Edit Profile
                            </button>
                            {profile.githubUrl && (
                                <a href={profile.githubUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-primary)', background: 'var(--surface-inset)', padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)', textDecoration: 'none', fontWeight: '600' }}>
                                    <GitBranch size={16} color="var(--text-muted)" /> GitHub <ArrowUpRight size={14} style={{ opacity: 0.5 }} />
                                </a>
                            )}
                            {profile.linkedinUrl && (
                                <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-primary)', background: 'var(--surface-inset)', padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)', textDecoration: 'none', fontWeight: '600' }}>
                                    <Globe size={16} color="#0A66C2" /> LinkedIn <ArrowUpRight size={14} style={{ opacity: 0.5 }} />
                                </a>
                            )}
                            {profile.portfolioUrl && (
                                <a href={profile.portfolioUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-primary)', background: 'var(--surface-inset)', padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)', textDecoration: 'none', fontWeight: '600' }}>
                                    <Code size={16} color="var(--accent)" /> Portfolio <ArrowUpRight size={14} style={{ opacity: 0.5 }} />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Organized stat cards - Level, Profile Completion,
                        Hubs, Done, Cache, and Semester/Targets, each its
                        own clean, minimal card sharing one consistent
                        shape (ProfileStatCard), instead of a floating
                        avatar badge, a standalone pill, and a 3-card grid
                        that were all styled differently before. */}
                    <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid var(--border-premium)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fit, minmax(110px, 1fr))', gap: '12px' }}>
                            <ProfileStatCard icon={Flame} iconColor="#F59E0B" value={`Lvl ${stats.level}`} label="LEVEL" />
                            <div className="profile-glass-card" style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '16px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                <CheckCircle size={18} color={completionPercentage === 100 ? '#10B981' : 'var(--accent)'} />
                                <span style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>{completionPercentage}%</span>
                                <div style={{ width: '100%', height: '5px', background: 'var(--surface-inset)', borderRadius: '10px', overflow: 'hidden' }}>
                                    <div style={{ width: `${completionPercentage}%`, height: '100%', background: completionPercentage === 100 ? '#10B981' : 'var(--accent)' }}></div>
                                </div>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.5px' }}>PROFILE</span>
                            </div>
                            <ProfileStatCard icon={BookOpen} iconColor="#3B82F6" value={stats.studyCount} label="HUBS" />
                            <ProfileStatCard icon={CheckSquare} iconColor="var(--accent)" value={stats.completedTasks} label="DONE" />
                            <ProfileStatCard icon={Database} iconColor="#10B981" value={stats.storageSize} label="CACHE" />
                            <ProfileStatCard icon={GraduationCap} iconColor="#A78BFA" value={profile.semester || 'Not Set'} label="SEMESTER" />
                        </div>

                        <div style={{ marginTop: '20px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.5px', display: 'block', marginBottom: '10px', textAlign: isMobile ? 'center' : 'left' }}>CONNECTIONS</span>
                            <ConnectionsStatusWidget isMobile={isMobile} />
                        </div>
                    </div>

                    {/* Profile Navigation Tabs - a clean, horizontally-
                        scrollable pill row on mobile (Instagram/LinkedIn-
                        style tab strip) instead of 5 icon+text buttons
                        wrapping across multiple cramped lines. Desktop
                        keeps its existing wrap-to-multiple-lines layout. */}
                    <div className="profile-tabs-row" style={{
                        display: 'flex', gap: '12px', marginTop: '32px', borderBottom: '1px solid var(--border-premium)', paddingBottom: '16px',
                        flexWrap: isMobile ? 'nowrap' : 'wrap',
                        overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch',
                        marginLeft: isMobile ? '-4px' : 0, marginRight: isMobile ? '-4px' : 0, paddingLeft: isMobile ? '4px' : 0, paddingRight: isMobile ? '4px' : 0,
                    }}>
                        <button onClick={() => setActiveTabState('overview')} style={{ background: activeTab === 'overview' ? 'var(--primary-muted)' : 'var(--widget-bg)', color: activeTab === 'overview' ? 'var(--accent)' : 'var(--text-secondary)', border: activeTab === 'overview' ? '1px solid var(--primary-muted)' : '1px solid var(--border-premium)', boxShadow: activeTab === 'overview' ? '0 0 14px rgba(var(--primary-rgb), 0.35)' : 'none', padding: '10px 18px', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', flexShrink: 0, whiteSpace: 'nowrap' }}><Sparkles size={16} /> Overview & Targets</button>
                        <button onClick={() => setActiveTabState('analytics')} style={{ background: activeTab === 'analytics' ? 'var(--primary-muted)' : 'var(--widget-bg)', color: activeTab === 'analytics' ? 'var(--accent)' : 'var(--text-secondary)', border: activeTab === 'analytics' ? '1px solid var(--primary-muted)' : '1px solid var(--border-premium)', boxShadow: activeTab === 'analytics' ? '0 0 14px rgba(var(--primary-rgb), 0.35)' : 'none', padding: '10px 18px', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', flexShrink: 0, whiteSpace: 'nowrap' }}><BarChart size={16} /> Productivity & Trends</button>
                        <button onClick={() => setActiveTabState('activity')} style={{ background: activeTab === 'activity' ? 'var(--primary-muted)' : 'var(--widget-bg)', color: activeTab === 'activity' ? 'var(--accent)' : 'var(--text-secondary)', border: activeTab === 'activity' ? '1px solid var(--primary-muted)' : '1px solid var(--border-premium)', boxShadow: activeTab === 'activity' ? '0 0 14px rgba(var(--primary-rgb), 0.35)' : 'none', padding: '10px 18px', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', flexShrink: 0, whiteSpace: 'nowrap' }}><Activity size={16} /> Activity Feed</button>
                        <button onClick={() => setActiveTabState('badges')} style={{ background: activeTab === 'badges' ? 'var(--primary-muted)' : 'var(--widget-bg)', color: activeTab === 'badges' ? 'var(--accent)' : 'var(--text-secondary)', border: activeTab === 'badges' ? '1px solid var(--primary-muted)' : '1px solid var(--border-premium)', boxShadow: activeTab === 'badges' ? '0 0 14px rgba(var(--primary-rgb), 0.35)' : 'none', padding: '10px 18px', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', flexShrink: 0, whiteSpace: 'nowrap' }}><Trophy size={16} /> Badges & Storage</button>
                        <button onClick={() => setActiveTabState('growth')} style={{ background: activeTab === 'growth' ? 'var(--primary-muted)' : 'var(--widget-bg)', color: activeTab === 'growth' ? 'var(--accent)' : 'var(--text-secondary)', border: activeTab === 'growth' ? '1px solid var(--primary-muted)' : '1px solid var(--border-premium)', boxShadow: activeTab === 'growth' ? '0 0 14px rgba(var(--primary-rgb), 0.35)' : 'none', padding: '10px 18px', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', flexShrink: 0, whiteSpace: 'nowrap' }}><Target size={16} /> Growth & Skills</button>
                    </div>

                    {/* Tab Contents */}
                    <div style={{ marginTop: '24px', minHeight: '200px' }}>
                        
                        {/* OVERVIEW TAB */}
                        {activeTab === 'overview' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', animation: 'fadeIn 0.3s ease' }}>
                                <div className="profile-glass-card" style={{ background: 'var(--widget-bg)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-premium)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                        <BookOpen size={18} color="var(--text-muted)" />
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.5px' }}>SEMESTER STATUS</span>
                                    </div>
                                    <strong style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: '800' }}>{profile.semester || 'Not Set'}</strong>
                                </div>
                                <div className="profile-glass-card" style={{ background: 'var(--widget-bg)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-premium)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                        <Wallet size={18} color="var(--text-muted)" />
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.5px' }}>MONTHLY BUDGET CAP</span>
                                    </div>
                                    <strong style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: '800' }}>₹{settings.monthlyBudgetCap || 0}</strong>
                                </div>
                                <div className="profile-glass-card" style={{ background: 'var(--widget-bg)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-premium)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                        <Dumbbell size={18} color="var(--text-muted)" />
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.5px' }}>DAILY HYDRATION TARGET</span>
                                    </div>
                                    <strong style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: '800' }}>{settings.dailyHydrationGoal || 0} L</strong>
                                </div>
                            </div>
                        )}

                        {/* ANALYTICS & TRENDS TAB */}
                        {activeTab === 'analytics' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                     <div className="profile-glass-card" style={{ background: 'var(--widget-bg)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                            <Target size={16} color="var(--accent)"/>
                                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Today's Focus</span>
                                        </div>
                                        <strong style={{ fontSize: '20px', color: 'var(--text-primary)', fontWeight: '800' }}>{stats.dailyFocus}</strong>
                                    </div>
                                    <div style={{ background: 'var(--widget-bg)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                            <Calendar size={16} color="#10B981"/>
                                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Weekly Consistency</span>
                                        </div>
                                        <strong style={{ fontSize: '20px', color: 'var(--text-primary)', fontWeight: '800' }}>{stats.weeklyConsistency}</strong>
                                    </div>
                                    <div style={{ background: 'var(--widget-bg)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                            <Clock size={16} color="#3B82F6"/>
                                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Tasks This Month</span>
                                        </div>
                                        <strong style={{ fontSize: '20px', color: 'var(--text-primary)', fontWeight: '800' }}>{stats.monthlyTasks}</strong>
                                    </div>
                                </div>

                                <div className="profile-glass-card" style={{ background: 'var(--widget-bg)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-premium)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>Level Progress to Lvl {stats.level + 1}</span>
                                        <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--accent)' }}>{stats.xpProgress}%</span>
                                    </div>
                                    <div style={{ width: '100%', height: '10px', background: 'var(--surface-inset)', borderRadius: '6px', overflow: 'hidden' }}>
                                        <div style={{ width: `${stats.xpProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), #F59E0B)', borderRadius: '6px', transition: 'width 0.5s ease' }}></div>
                                    </div>
                                </div>

                                <div className="profile-heatmap-scroll" style={{ background: 'var(--widget-bg)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-premium)', gridColumn: '1 / -1' }}>
                                    <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '16px' }}>Annual Activity Heatmap</span>
                                    {/* Desktop: weeks-as-columns, scrolls horizontally (GitHub's
                                        own layout) - genuinely fine there, plenty of width.
                                        Mobile: flips to days-as-columns (7 wide) / weeks-as-rows,
                                        scrolling vertically with the rest of the page instead -
                                        a real orientation change (see profilePage.css's own
                                        .profile-heatmap-grid mobile rule), not just smaller
                                        cells, since a 795px-wide grid squeezed into a 375px
                                        screen and scrolled sideways read as broken regardless
                                        of cell size. */}
                                    <div className="profile-heatmap-grid">
                                        {stats.heatmapData.map((cell, idx) => {
                                            const levelColors = ['var(--surface-inset)', 'rgba(var(--primary-rgb), 0.3)', 'rgba(var(--primary-rgb), 0.55)', 'rgba(var(--primary-rgb), 0.8)', 'var(--primary)'];
                                            return (
                                                <div
                                                    key={cell.date || idx}
                                                    className="profile-heatmap-cell"
                                                    title={`${cell.date}: ${cell.count} task${cell.count === 1 ? '' : 's'}`}
                                                    style={{ background: levelColors[cell.level] || levelColors[0], border: '1px solid var(--border-premium)' }}
                                                />
                                            );
                                        })}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                        Less
                                        {['var(--surface-inset)', 'rgba(var(--primary-rgb), 0.3)', 'rgba(var(--primary-rgb), 0.55)', 'rgba(var(--primary-rgb), 0.8)', 'var(--primary)'].map((c, i) => (
                                            <div key={i} className="profile-heatmap-legend-swatch" style={{ background: c, border: '1px solid var(--border-premium)' }} />
                                        ))}
                                        More
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ACTIVITY TAB */}
                        {activeTab === 'activity' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'fadeIn 0.3s ease' }}>
                                {stats.recentActivity.length > 0 ? (
                                    stats.recentActivity.map((act, idx) => (
                                        <div key={idx} className="profile-glass-card" style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '8px' : '0', background: 'var(--widget-bg)', padding: isMobile ? '14px 16px' : '16px 20px', borderRadius: '16px', border: '1px solid var(--border-premium)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600' }}>
                                                <div style={{ background: 'var(--surface-inset)', padding: '8px', borderRadius: '10px' }}><Terminal size={16} color="var(--accent)" /></div>
                                                <span>{act.title}</span>
                                            </div>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>{act.time}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', background: 'var(--widget-bg)', borderRadius: '16px', border: '1px dashed var(--border-premium)' }}>
                                        No recent activity recorded. Add tasks or study hubs to populate this feed.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* BADGES TAB - both badges now real, gated
                            conditions, not decorative "everyone gets one"
                            trophies: Code Pusher previously showed "Level 1
                            Achieved" for a brand-new, zero-activity account
                            (level 1 is just the starting value, nothing was
                            actually achieved) - now only appears once the
                            user has genuinely leveled up by completing real
                            tasks. Local Cache Healthy previously showed
                            "0 KB Synchronized" as if that were itself an
                            accomplishment - now only appears once there's
                            real, non-zero local data to report on. */}
                        {activeTab === 'badges' && (
                            (stats.level > 1 || parseFloat(stats.storageSize) > 0) ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', animation: 'fadeIn 0.3s ease' }}>
                                    {stats.level > 1 && (
                                        <div className="profile-glass-card" style={{ background: 'var(--widget-bg)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', padding: '14px', borderRadius: '14px' }}><Star size={22} /></div>
                                            <div>
                                                <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>Code Pusher</h4>
                                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>Level {stats.level} Achieved</span>
                                            </div>
                                        </div>
                                    )}
                                    {parseFloat(stats.storageSize) > 0 && (
                                        <div className="profile-glass-card" style={{ background: 'var(--widget-bg)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', padding: '14px', borderRadius: '14px' }}><Database size={22} /></div>
                                            <div>
                                                <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>Local Cache Healthy</h4>
                                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>{stats.storageSize} Synchronized</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', background: 'var(--widget-bg)', borderRadius: '16px', border: '1px dashed var(--border-premium)' }}>
                                    No badges earned yet. Complete tasks to level up and unlock your first one.
                                </div>
                            )
                        )}

                        {/* GROWTH TAB */}
                        {activeTab === 'growth' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease' }}>

                                {/* Live Focus / What I'm Learning */}
                                <div className="profile-glass-card" style={{ background: 'var(--widget-bg)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-premium)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                        <Target size={18} color="var(--accent)" />
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.5px' }}>LIVE FOCUS / WHAT I'M LEARNING</span>
                                    </div>
                                    <strong style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: '700', lineHeight: '1.4' }}>
                                        {profile.currentFocus || 'Not Set'}
                                    </strong>
                                    {!profile.currentFocus && (
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Set this from Edit Profile to show what you're currently working on.</p>
                                    )}
                                </div>

                                {/* Skills & Tech Stack */}
                                <div className="profile-glass-card" style={{ background: 'var(--widget-bg)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-premium)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Cpu size={18} color="var(--accent)" />
                                            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.5px' }}>SKILLS & TECH STACK</span>
                                        </div>
                                        <button type="button" onClick={addSkill} style={{ padding: '6px 14px', background: 'var(--surface-inset)', color: 'var(--accent)', border: '1px solid var(--border-premium)', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>+ Add Skill</button>
                                    </div>
                                    {profile.skills.length === 0 ? (
                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No skills tracked yet. Add one to get started.</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {profile.skills.map((skill) => (
                                                <div key={skill.id}>
                                                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '6px' : '0', marginBottom: '8px' }}>
                                                        <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{skill.name}</span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--accent)' }}>{skill.progress}%</span>
                                                            <button type="button" onClick={() => removeSkill(skill.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                                                        </div>
                                                    </div>
                                                    <input
                                                        type="range" min="0" max="100" value={skill.progress}
                                                        aria-label={`${skill.name} progress`}
                                                        onChange={(e) => updateSkillProgress(skill.id, Number(e.target.value))}
                                                        style={{ width: '100%', accentColor: 'var(--primary)' }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Milestone & Achievement Timeline */}
                                <div className="profile-glass-card" style={{ background: 'var(--widget-bg)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-premium)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Trophy size={18} color="var(--accent)" />
                                            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.5px' }}>MILESTONES & ACHIEVEMENTS</span>
                                        </div>
                                        <button type="button" onClick={addMilestone} style={{ padding: '6px 14px', background: 'var(--surface-inset)', color: 'var(--accent)', border: '1px solid var(--border-premium)', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>+ Add Milestone</button>
                                    </div>
                                    {profile.milestones.length === 0 ? (
                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No milestones added yet. Add your first completed semester, project launch, or goal.</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
                                            {profile.milestones.map((m, idx) => (
                                                <div key={m.id} style={{ display: 'flex', gap: '16px', position: 'relative', paddingBottom: idx === profile.milestones.length - 1 ? 0 : '20px' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 8px var(--primary)', flexShrink: 0, marginTop: '4px' }} />
                                                        {idx !== profile.milestones.length - 1 && <div style={{ width: '2px', flex: 1, background: 'var(--border-premium)', marginTop: '4px' }} />}
                                                    </div>
                                                    <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', minWidth: 0 }}>
                                                        <div style={{ minWidth: 0 }}>
                                                            <strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block', overflowWrap: 'break-word' }}>{m.title}</strong>
                                                            {m.date && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.date}</span>}
                                                        </div>
                                                        <button type="button" onClick={() => removeMilestone(m.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}>✕</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            </>
            )}

            {/* Editing Form */}
            {isEditing && (
                <>
                {/* Motion (transform, plus this page's own negative-margin
                    full-bleed trick) and glass (backdrop-filter, via the
                    <form>'s own background: var(--bg-surface) matching the
                    app-wide [style*="var(--bg-surface)"] rule) are
                    deliberately split across two nested elements now, not
                    combined on the one <form> like before - see
                    profilePage.css's own comment on .profile-edit-motion
                    for why: a single element carrying both an animated
                    `transform` and `backdrop-filter` can render its own
                    text visibly soft/blurry even once fully settled, not
                    just mid-transition (confirmed on the smaller Edit
                    Profile modal in Settings, same underlying pattern). */}
                <div className="profile-edit-motion" style={{
                    margin: isMobile ? '-16px -12px -24px -12px' : '-32px -40px -40px -40px',
                    minHeight: 'calc(100vh - 84px)',
                }}>
                <form onSubmit={handleSave} className="nexus-glass-modal profile-edit-form" style={{
                    background: 'var(--bg-surface)', border: '1px solid var(--border-premium)',
                    padding: '40px', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', gap: '28px',
                    minHeight: '100%',
                }}>
                    {/* Real back-out, not just Cancel at the very bottom of
                        a long form - same handleCancel behavior (discards
                        any unsaved draft, re-seeds from what's actually
                        saved), just reachable from the top too, in what
                        was previously just dead empty space above the
                        heading. */}
                    <button type="button" className="profile-edit-back-btn" onClick={handleCancel} aria-label="Back to profile" title="Back to profile">
                        <ArrowLeft size={16} /> Back
                    </button>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-premium)', paddingBottom: '16px' }}>
                        <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>Profile Hub</h3>
                    </div>

                    {/* Live avatar+cover preview - reads directly off
                        `profile` state, which already updates immediately
                        on a real upload+crop (persistProfile writes it
                        straight away, well before the form's own final
                        Save) - so this genuinely shows "how it'll look
                        together" while still editing, per explicit
                        request, rather than requiring a save-then-go-back-
                        and-check round trip.
                        The avatar is a SIBLING of the banner strip here,
                        not nested inside it - the banner's own
                        overflow:hidden (needed to clip its background
                        image to rounded corners) was also clipping the
                        avatar's lower half, since it was positioned
                        `bottom: -26px` i.e. deliberately extending past
                        that same box's own bottom edge. Matches the real,
                        already-correct structure on the main profile view
                        itself: there, the avatar is pulled up via negative
                        margin from OUTSIDE the banner's own box, never a
                        positioned descendant of it. */}
                    <div style={{ position: 'relative' }}>
                        <div style={{ height: '84px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-premium)', background: profile.coverUrl ? `url("${profile.coverUrl}") center/cover no-repeat` : 'linear-gradient(135deg, rgba(var(--primary-rgb, 255, 180, 0), 0.2), rgba(16, 185, 129, 0.1))' }}>
                            <span style={{ position: 'absolute', top: '10px', left: '14px', fontSize: '10px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: '20px' }}>Live Preview</span>
                        </div>
                        <div style={{ position: 'absolute', top: '50px', left: '20px', width: '68px', height: '68px', borderRadius: '50%', border: '3px solid var(--bg-surface)', overflow: 'hidden', boxSizing: 'border-box', background: profile.avatarUrl ? 'transparent' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-on-primary)', fontSize: '26px', fontWeight: '800' }}>
                            {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : avatarInitial}
                        </div>
                    </div>
                    <div style={{ height: '40px' }} />

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'var(--surface-inset)', border: '1px solid var(--border-premium)', borderRadius: '10px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '700' }}>
                            <Camera size={15} color="var(--accent)" />
                            {profile.avatarUrl ? 'Change Avatar' : 'Upload Avatar'}
                            <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'avatarUrl')} style={{ display: 'none' }} />
                        </label>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'var(--surface-inset)', border: '1px solid var(--border-premium)', borderRadius: '10px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '700' }}>
                            <ImageIcon size={15} color="var(--accent)" />
                            {profile.coverUrl ? 'Change Cover' : 'Upload Cover'}
                            <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'coverUrl')} style={{ display: 'none' }} />
                        </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                        <div>
                            <label htmlFor="profileName" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><User size={14}/> Full Name</label>
                            <input id="profileName" name="name" type="text" placeholder="e.g. Nitin Kumar" value={profile.name} onChange={(e) => setProfile({...profile, name: e.target.value})} className="profile-input" />
                        </div>
                        <div>
                            <label htmlFor="profileCurrentStatus" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><Activity size={14}/> Current Status</label>
                            <select id="profileCurrentStatus" name="currentStatus" value={profile.currentStatus} onChange={(e) => setProfile({...profile, currentStatus: e.target.value})} className="profile-input">
                                <option value="Not Set" style={{ background: 'var(--surface-inset)' }}>Not Set</option>
                                <option value="🟢 Active OS Session" style={{ background: 'var(--surface-inset)' }}>🟢 Active OS Session</option>
                                <option value="🔴 Deep Work Mode" style={{ background: 'var(--surface-inset)' }}>🔴 Deep Work Mode</option>
                                <option value="🟡 In Class / Meeting" style={{ background: 'var(--surface-inset)' }}>🟡 In Class / Meeting</option>
                                <option value="🌙 Resting / Offline" style={{ background: 'var(--surface-inset)' }}>🌙 Resting / Offline</option>
                            </select>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label htmlFor="profileQuoteOfDay" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><Quote size={14}/> Quote of the Day / Focus</label>
                            <input id="profileQuoteOfDay" name="quoteOfDay" type="text" placeholder="Your daily motivation..." value={profile.quoteOfDay} onChange={(e) => setProfile({...profile, quoteOfDay: e.target.value})} className="profile-input" />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label htmlFor="profileBio" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><Terminal size={14}/> Bio / Tagline</label>
                            <input id="profileBio" name="bio" type="text" placeholder="Short bio..." value={profile.bio} onChange={(e) => setProfile({...profile, bio: e.target.value})} className="profile-input" />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label htmlFor="profileCurrentFocus" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><Target size={14}/> Live Focus / What I'm Learning</label>
                            <input id="profileCurrentFocus" name="currentFocus" type="text" placeholder="e.g. Building a distributed systems project in Go" value={profile.currentFocus} onChange={(e) => setProfile({...profile, currentFocus: e.target.value})} className="profile-input" />
                        </div>
                        
                        <div>
                            <label htmlFor="profileGithubUrl" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><GitBranch size={14}/> GitHub URL</label>
                            <input id="profileGithubUrl" name="githubUrl" type="text" value={profile.githubUrl} onChange={(e) => setProfile({...profile, githubUrl: e.target.value})} placeholder="https://github.com/..." className="profile-input" />
                        </div>
                        <div>
                            <label htmlFor="profileLinkedinUrl" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><Globe size={14}/> LinkedIn URL</label>
                            <input id="profileLinkedinUrl" name="linkedinUrl" type="text" value={profile.linkedinUrl} onChange={(e) => setProfile({...profile, linkedinUrl: e.target.value})} placeholder="https://linkedin.com/in/..." className="profile-input" />
                        </div>
                        <div>
                            <label htmlFor="profilePortfolioUrl" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><Code size={14}/> Portfolio URL</label>
                            <input id="profilePortfolioUrl" name="portfolioUrl" type="text" value={profile.portfolioUrl} onChange={(e) => setProfile({...profile, portfolioUrl: e.target.value})} placeholder="https://yourportfolio.com" className="profile-input" />
                        </div>
                        <div>
                            <label htmlFor="profileRole" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><Briefcase size={14}/> Role</label>
                            <input id="profileRole" name="role" type="text" placeholder="e.g. Computer Science Student" value={profile.role} onChange={(e) => setProfile({...profile, role: e.target.value})} className="profile-input" />
                        </div>
                        <div>
                            <label htmlFor="profileCollege" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><GraduationCap size={14}/> Institution</label>
                            <input id="profileCollege" name="college" type="text" placeholder="e.g. IIT Delhi" value={profile.college} onChange={(e) => setProfile({...profile, college: e.target.value})} className="profile-input" />
                        </div>
                        <div>
                            <label htmlFor="profileSemester" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><BookOpen size={14}/> Semester / Year</label>
                            <input id="profileSemester" name="semester" type="text" placeholder="e.g. 6th Semester" value={profile.semester} onChange={(e) => setProfile({...profile, semester: e.target.value})} className="profile-input" />
                        </div>
                        <div>
                            <label htmlFor="profileMonthlyBudget" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><Wallet size={14}/> Monthly Budget Cap ({settings.currencySymbol})</label>
                            <input id="profileMonthlyBudget" name="monthlyBudgetCap" type="number" placeholder="0" value={settings.monthlyBudgetCap} onChange={(e) => updateSetting('monthlyBudgetCap', sanitizeNumberInput(e.target.value, settings.monthlyBudgetCap))} onBlur={(e) => updateSetting('monthlyBudgetCap', normalizeNumberOnBlur(e.target.value, true))} className="profile-input" />
                        </div>
                        <div>
                            <label htmlFor="profileHydrationGoal" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><Dumbbell size={14}/> Daily Water Target (L)</label>
                            <input id="profileHydrationGoal" name="dailyHydrationGoal" type="number" step="0.1" placeholder="e.g. 4.0" value={settings.dailyHydrationGoal} onChange={(e) => updateSetting('dailyHydrationGoal', sanitizeNumberInput(e.target.value, settings.dailyHydrationGoal))} onBlur={(e) => updateSetting('dailyHydrationGoal', normalizeNumberOnBlur(e.target.value, true))} className="profile-input" />
                        </div>
                    </div>

                    {/* Cloud Account & Authentication - genuinely reads live
                        from the same, shared useAuth()/useCloudSync()
                        context Settings uses, so this can never disagree
                        with the status shown there. Signing out here (via
                        the real, shared logout function) is reflected
                        instantly in Settings too, and vice versa - both
                        are the same live context, not separate copies. */}
                    <div style={{ borderTop: '1px solid var(--border-premium)', paddingTop: '20px', marginTop: '4px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                            <Cloud size={16} color="var(--accent)" /> Cloud Account & Authentication
                        </h4>
                        {isConfigured && user ? (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', padding: '16px 18px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '14px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)', flexShrink: 0, display: 'inline-block' }} />
                                        <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{user.email}</span>
                                    </div>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        {isSyncing ? 'Syncing…' : lastSyncedAt ? `Last synced ${lastSyncedAt.toLocaleTimeString()}.` : 'Not synced yet.'}
                                    </span>
                                </div>
                                <button
                                    type="button" onClick={logout} title="Sign Out"
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: 'var(--surface-inset)', color: '#EF4444', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                                >
                                    <LogOut size={15} /> Sign Out
                                </button>
                            </div>
                        ) : isConfigured ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 18px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '14px' }}>
                                <Cloud size={16} color="var(--text-muted)" />
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Not signed in - go to Settings → Cloud Sync &amp; Account Management to log in or create an account.</span>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 18px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '14px' }}>
                                <Cloud size={16} color="var(--text-muted)" />
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Cloud sync isn't configured yet - all data stays on this device.</span>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                        <button type="button" onClick={handleCancel} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                            <X size={18} /> Cancel
                        </button>
                        <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                            <Save size={18} /> Save
                        </button>
                    </div>
                </form>
                </div>
                </>
            )}

            {cropModal && (
                <ImageCropModal
                    imageSrc={cropModal.src}
                    shape={cropModal.type === 'avatarUrl' ? 'circle' : 'wide'}
                    onSave={handleCropSave}
                    onCancel={handleCropCancel}
                />
            )}

            {editingImageType && (
                <ProfileImageEditModal
                    type={editingImageType}
                    currentUrl={profile[editingImageType]}
                    onSelectPreset={(dataUrl) => handlePresetSelect(editingImageType, dataUrl)}
                    onUploadChange={handleImageEditModalUpload}
                    onClose={() => setEditingImageType(null)}
                />
            )}
        </div>
    );
};

export default ProfilePage;