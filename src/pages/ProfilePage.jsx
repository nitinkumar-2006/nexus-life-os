// src/pages/ProfilePage.jsx
import { useState, useEffect } from 'react';
import ImageCropModal from '../components/ImageCropModal.jsx';
import { useStreaming } from '../context/StreamingContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCloudSync } from '../context/CloudSyncContext.jsx';
import { sanitizeNumberInput, normalizeNumberOnBlur } from '../utils/smartNumberInput.js';
import { useGlobalSettings } from '../context/GlobalUserSettingsContext.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import {
    User, BookOpen, Flame, Save,
    CheckCircle, Sparkles, Edit3, Dumbbell,
    Wallet, Trophy, Activity, Terminal, Code, Star, Cpu, Database,
    BarChart, Globe, GitBranch, Camera, Image as ImageIcon,
    X, Quote, Calendar, Clock, Target, ArrowUpRight, CheckSquare, Apple, Disc, Cloud, LogOut,
    Briefcase, GraduationCap
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
        display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 0', minWidth: 0,
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

const StreamingStatusWidget = () => {
    const { appleMusicAuth, spotifyAuth, activeSource } = useStreaming();

    return (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '10px', width: '100%', maxWidth: '320px', minWidth: '280px' }}>
            <StreamingServiceBox
                label="Apple Music"
                icon={<Apple size={16} color="#FA233B" style={{ flexShrink: 0 }} />}
                connected={appleMusicAuth.connected}
                isActive={activeSource === 'apple'}
                brandColor="#FA233B"
            />
            <StreamingServiceBox
                label="Spotify"
                icon={<Disc size={16} color="#1DB954" style={{ flexShrink: 0 }} />}
                connected={spotifyAuth.connected}
                isActive={activeSource === 'spotify'}
                brandColor="#1DB954"
            />
        </div>
    );
};

// A single, clean, minimalist stat card - the one shared shape behind
// every quick-glance number in the profile header (Level, Hubs, Done,
// Cache, Semester). One consistent size/shape so the whole row reads as
// real, separated cards, not a mix of a floating avatar badge, a
// standalone pill, and a 3-card grid all styled differently.
const ProfileStatCard = ({ icon: Icon, iconColor, value, label }) => (
    <div style={{
        background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '16px',
        padding: '16px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: 0,
    }}>
        <Icon size={18} color={iconColor} />
        <span style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{value}</span>
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

    const handleCropSave = (croppedDataUrl) => {
        if (!cropModal) return;
        setProfile((prev) => ({ ...prev, [cropModal.type]: croppedDataUrl }));
        setCropModal(null);
    };

    const handleCropCancel = () => setCropModal(null);

    // Pull REAL metrics from localStorage
    useEffect(() => {
        try {
            const planner = JSON.parse(localStorage.getItem('nexus_planner_tasks') || '[]');
            const study = JSON.parse(localStorage.getItem('nexus_study_subjects') || '[]');
            
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

            // Real GitHub-style annual heatmap, derived from actual task
            // creation timestamps (every task's `id` is a Date.now() value
            // set when it was created - see header.jsx/PlannerPage.jsx) -
            // not a fabricated pattern. A brand-new user with no tasks yet
            // correctly gets 371 empty (level 0) days, matching the
            // zero-dummy-data policy.
            const activityByDay = {};
            planner.forEach((t) => {
                if (typeof t.id === 'number' && t.id > 1000000000000) {
                    const key = new Date(t.id).toISOString().slice(0, 10);
                    activityByDay[key] = (activityByDay[key] || 0) + 1;
                }
            });
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const ANNUAL_DAYS = 371; // 53 weeks x 7 - a clean GitHub-style grid
            const realHeatmap = Array.from({ length: ANNUAL_DAYS }, (_, i) => {
                const d = new Date(today);
                d.setDate(d.getDate() - (ANNUAL_DAYS - 1 - i));
                const key = d.toISOString().slice(0, 10);
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
                monthlyTasks: total
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px', animation: 'fadeInScale 0.3s ease', position: 'relative', paddingBottom: '40px' }}>

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
                {/* Dynamic Cover Banner */}
                <div style={{ 
                    height: '160px', 
                    background: profile.coverUrl ? `url(${profile.coverUrl}) center/cover no-repeat` : 'linear-gradient(135deg, rgba(var(--primary-rgb, 255, 180, 0), 0.2), rgba(16, 185, 129, 0.1))', 
                    position: 'relative', 
                    borderBottom: '1px solid var(--border-premium)', 
                    padding: '16px 24px', 
                    display: 'flex', 
                    justifyContent: 'flex-end', 
                    alignItems: 'flex-start' 
                }}>
                    <span style={{ fontSize: '12px', background: 'rgba(0,0,0,0.5)', padding: '6px 14px', borderRadius: '20px', color: statusColor, fontWeight: '700', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '6px', backdropFilter: 'blur(10px)' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor, display: 'inline-block', boxShadow: `0 0 10px ${statusColor}` }}></span> {profile.currentStatus.replace(/🟢|🔴|🟡|🌙/g, '').trim()}
                    </span>
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
                        boxShadow: '0 8px 25px rgba(0,0,0,0.4)', position: 'relative', zIndex: 2,
                        flexShrink: 0, background: 'transparent'
                    }}>
                        <div
                            data-diag="profile-avatar"
                            style={{
                                position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden',
                                WebkitMaskImage: 'radial-gradient(white, black)', maskImage: 'radial-gradient(white, black)',
                                background: profile.avatarUrl ? 'transparent' : 'var(--primary)',
                                border: '6px solid var(--bg-surface)', boxSizing: 'border-box',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--text-on-primary)', fontSize: '42px', fontWeight: '800',
                            }}
                        >
                            {profile.avatarUrl ? (
                                <img
                                    src={profile.avatarUrl}
                                    alt="Avatar"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: 'transparent' }}
                                />
                            ) : avatarInitial}
                        </div>
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
                            <div style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '16px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: 0 }}>
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

                        <div style={{ marginTop: '16px', display: 'flex', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                            <StreamingStatusWidget />
                        </div>
                    </div>

                    {/* Profile Navigation Tabs - a clean, horizontally-
                        scrollable pill row on mobile (Instagram/LinkedIn-
                        style tab strip) instead of 5 icon+text buttons
                        wrapping across multiple cramped lines. Desktop
                        keeps its existing wrap-to-multiple-lines layout. */}
                    <div style={{
                        display: 'flex', gap: '12px', marginTop: '32px', borderBottom: '1px solid var(--border-premium)', paddingBottom: '16px',
                        flexWrap: isMobile ? 'nowrap' : 'wrap',
                        overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch',
                        marginLeft: isMobile ? '-4px' : 0, marginRight: isMobile ? '-4px' : 0, paddingLeft: isMobile ? '4px' : 0, paddingRight: isMobile ? '4px' : 0,
                    }}>
                        <button onClick={() => setActiveTabState('overview')} style={{ background: activeTab === 'overview' ? 'var(--primary-muted)' : 'var(--widget-bg)', color: activeTab === 'overview' ? 'var(--accent)' : 'var(--text-secondary)', border: activeTab === 'overview' ? '1px solid var(--primary-muted)' : '1px solid var(--border-premium)', padding: '10px 18px', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', flexShrink: 0, whiteSpace: 'nowrap' }}><Sparkles size={16} /> Overview & Targets</button>
                        <button onClick={() => setActiveTabState('analytics')} style={{ background: activeTab === 'analytics' ? 'var(--primary-muted)' : 'var(--widget-bg)', color: activeTab === 'analytics' ? 'var(--accent)' : 'var(--text-secondary)', border: activeTab === 'analytics' ? '1px solid var(--primary-muted)' : '1px solid var(--border-premium)', padding: '10px 18px', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', flexShrink: 0, whiteSpace: 'nowrap' }}><BarChart size={16} /> Productivity & Trends</button>
                        <button onClick={() => setActiveTabState('activity')} style={{ background: activeTab === 'activity' ? 'var(--primary-muted)' : 'var(--widget-bg)', color: activeTab === 'activity' ? 'var(--accent)' : 'var(--text-secondary)', border: activeTab === 'activity' ? '1px solid var(--primary-muted)' : '1px solid var(--border-premium)', padding: '10px 18px', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', flexShrink: 0, whiteSpace: 'nowrap' }}><Activity size={16} /> Activity Feed</button>
                        <button onClick={() => setActiveTabState('badges')} style={{ background: activeTab === 'badges' ? 'var(--primary-muted)' : 'var(--widget-bg)', color: activeTab === 'badges' ? 'var(--accent)' : 'var(--text-secondary)', border: activeTab === 'badges' ? '1px solid var(--primary-muted)' : '1px solid var(--border-premium)', padding: '10px 18px', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', flexShrink: 0, whiteSpace: 'nowrap' }}><Trophy size={16} /> Badges & Storage</button>
                        <button onClick={() => setActiveTabState('growth')} style={{ background: activeTab === 'growth' ? 'var(--primary-muted)' : 'var(--widget-bg)', color: activeTab === 'growth' ? 'var(--accent)' : 'var(--text-secondary)', border: activeTab === 'growth' ? '1px solid var(--primary-muted)' : '1px solid var(--border-premium)', padding: '10px 18px', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', flexShrink: 0, whiteSpace: 'nowrap' }}><Target size={16} /> Growth & Skills</button>
                    </div>

                    {/* Tab Contents */}
                    <div style={{ marginTop: '24px', minHeight: '200px' }}>
                        
                        {/* OVERVIEW TAB */}
                        {activeTab === 'overview' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', animation: 'fadeIn 0.3s ease' }}>
                                <div style={{ background: 'var(--widget-bg)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-premium)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                        <BookOpen size={18} color="var(--text-muted)" />
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.5px' }}>SEMESTER STATUS</span>
                                    </div>
                                    <strong style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: '800' }}>{profile.semester || 'Not Set'}</strong>
                                </div>
                                <div style={{ background: 'var(--widget-bg)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-premium)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                        <Wallet size={18} color="var(--text-muted)" />
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.5px' }}>MONTHLY BUDGET CAP</span>
                                    </div>
                                    <strong style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: '800' }}>₹{settings.monthlyBudgetCap || 0}</strong>
                                </div>
                                <div style={{ background: 'var(--widget-bg)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-premium)' }}>
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
                                     <div style={{ background: 'var(--widget-bg)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)' }}>
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

                                <div style={{ background: 'var(--widget-bg)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-premium)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>Level Progress to Lvl {stats.level + 1}</span>
                                        <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--accent)' }}>{stats.xpProgress}%</span>
                                    </div>
                                    <div style={{ width: '100%', height: '10px', background: 'var(--surface-inset)', borderRadius: '6px', overflow: 'hidden' }}>
                                        <div style={{ width: `${stats.xpProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), #F59E0B)', borderRadius: '6px', transition: 'width 0.5s ease' }}></div>
                                    </div>
                                </div>

                                <div style={{ background: 'var(--widget-bg)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-premium)', gridColumn: '1 / -1', overflowX: 'auto' }}>
                                    <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '16px' }}>Annual Activity Heatmap</span>
                                    <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 12px)', gridAutoFlow: 'column', gridAutoColumns: '12px', gap: '3px', width: 'fit-content' }}>
                                        {stats.heatmapData.map((cell, idx) => {
                                            const levelColors = ['var(--surface-inset)', 'rgba(var(--primary-rgb), 0.3)', 'rgba(var(--primary-rgb), 0.55)', 'rgba(var(--primary-rgb), 0.8)', 'var(--primary)'];
                                            return (
                                                <div
                                                    key={cell.date || idx}
                                                    title={`${cell.date}: ${cell.count} task${cell.count === 1 ? '' : 's'}`}
                                                    style={{ width: '12px', height: '12px', borderRadius: '3px', background: levelColors[cell.level] || levelColors[0], border: '1px solid var(--border-premium)' }}
                                                />
                                            );
                                        })}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                        Less
                                        {['var(--surface-inset)', 'rgba(var(--primary-rgb), 0.3)', 'rgba(var(--primary-rgb), 0.55)', 'rgba(var(--primary-rgb), 0.8)', 'var(--primary)'].map((c, i) => (
                                            <div key={i} style={{ width: '11px', height: '11px', borderRadius: '3px', background: c, border: '1px solid var(--border-premium)' }} />
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
                                        <div key={idx} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '8px' : '0', background: 'var(--widget-bg)', padding: isMobile ? '14px 16px' : '16px 20px', borderRadius: '16px', border: '1px solid var(--border-premium)' }}>
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

                        {/* BADGES TAB */}
                        {activeTab === 'badges' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', animation: 'fadeIn 0.3s ease' }}>
                                <div style={{ background: 'var(--widget-bg)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', padding: '14px', borderRadius: '14px' }}><Star size={22} /></div>
                                    <div>
                                        <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>Code Pusher</h4>
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>Level {stats.level} Achieved</span>
                                    </div>
                                </div>
                                <div style={{ background: 'var(--widget-bg)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', padding: '14px', borderRadius: '14px' }}><Database size={22} /></div>
                                    <div>
                                        <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>Local Cache Healthy</h4>
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>{stats.storageSize} Synchronized</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* GROWTH TAB */}
                        {activeTab === 'growth' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease' }}>

                                {/* Live Focus / What I'm Learning */}
                                <div style={{ background: 'var(--widget-bg)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-premium)' }}>
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
                                <div style={{ background: 'var(--widget-bg)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-premium)' }}>
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
                                <div style={{ background: 'var(--widget-bg)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-premium)' }}>
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
                <style>{`
                    @keyframes profileEditOverlayIn {
                        0% { opacity: 0; transform: translateY(24px); }
                        100% { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
                <form onSubmit={handleSave} className="nexus-glass-modal" style={{
                    background: 'var(--bg-surface)', border: '1px solid var(--border-premium)',
                    padding: '40px', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', gap: '28px',
                    /* Negative margins cancel out the content area's own
                       real, known padding (32px top, 40px sides, 40px
                       bottom - set in DashboardLayout.jsx), so this
                       overlay genuinely extends edge-to-edge within the
                       content area rather than sitting inset like a
                       normal page section - the actual mechanism behind
                       "high-impact, full-screen" and "main content area
                       entirely occupied". Doesn't require knowing the
                       sidebar's own dynamic width, since it only cancels
                       this page's own container padding, not anything
                       about the sidebar itself. Mirrors DashboardLayout's
                       own isMobile split (16px 12px 24px 12px on mobile)
                       - the desktop-only numbers alone left this box
                       genuinely wider than a real mobile viewport
                       (measured 28px/22px past the left/right edge). */
                    margin: isMobile ? '-16px -12px -24px -12px' : '-32px -40px -40px -40px',
                    minHeight: 'calc(100vh - 84px)',
                    animation: 'profileEditOverlayIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-premium)', paddingBottom: '16px' }}>
                        <div>
                            <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>Identity Configuration</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Update your personal OS parameters.</p>
                        </div>
                    </div>

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
                            <input id="profileName" name="name" type="text" placeholder="e.g. Nitin Kumar" value={profile.name} onChange={(e) => setProfile({...profile, name: e.target.value})} style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                        </div>
                        <div>
                            <label htmlFor="profileCurrentStatus" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><Activity size={14}/> Current Status</label>
                            <select id="profileCurrentStatus" name="currentStatus" value={profile.currentStatus} onChange={(e) => setProfile({...profile, currentStatus: e.target.value})} style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                                <option value="Not Set" style={{ background: 'var(--surface-inset)' }}>Not Set</option>
                                <option value="🟢 Active OS Session" style={{ background: 'var(--surface-inset)' }}>🟢 Active OS Session</option>
                                <option value="🔴 Deep Work Mode" style={{ background: 'var(--surface-inset)' }}>🔴 Deep Work Mode</option>
                                <option value="🟡 In Class / Meeting" style={{ background: 'var(--surface-inset)' }}>🟡 In Class / Meeting</option>
                                <option value="🌙 Resting / Offline" style={{ background: 'var(--surface-inset)' }}>🌙 Resting / Offline</option>
                            </select>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label htmlFor="profileQuoteOfDay" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><Quote size={14}/> Quote of the Day / Focus</label>
                            <input id="profileQuoteOfDay" name="quoteOfDay" type="text" placeholder="Your daily motivation..." value={profile.quoteOfDay} onChange={(e) => setProfile({...profile, quoteOfDay: e.target.value})} style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label htmlFor="profileBio" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><Terminal size={14}/> Bio / Tagline</label>
                            <input id="profileBio" name="bio" type="text" placeholder="Short bio..." value={profile.bio} onChange={(e) => setProfile({...profile, bio: e.target.value})} style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label htmlFor="profileCurrentFocus" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><Target size={14}/> Live Focus / What I'm Learning</label>
                            <input id="profileCurrentFocus" name="currentFocus" type="text" placeholder="e.g. Building a distributed systems project in Go" value={profile.currentFocus} onChange={(e) => setProfile({...profile, currentFocus: e.target.value})} style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                        </div>
                        
                        <div>
                            <label htmlFor="profileGithubUrl" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><GitBranch size={14}/> GitHub URL</label>
                            <input id="profileGithubUrl" name="githubUrl" type="text" value={profile.githubUrl} onChange={(e) => setProfile({...profile, githubUrl: e.target.value})} placeholder="https://github.com/..." style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                        </div>
                        <div>
                            <label htmlFor="profileLinkedinUrl" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><Globe size={14}/> LinkedIn URL</label>
                            <input id="profileLinkedinUrl" name="linkedinUrl" type="text" value={profile.linkedinUrl} onChange={(e) => setProfile({...profile, linkedinUrl: e.target.value})} placeholder="https://linkedin.com/in/..." style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                        </div>
                        <div>
                            <label htmlFor="profilePortfolioUrl" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><Code size={14}/> Portfolio URL</label>
                            <input id="profilePortfolioUrl" name="portfolioUrl" type="text" value={profile.portfolioUrl} onChange={(e) => setProfile({...profile, portfolioUrl: e.target.value})} placeholder="https://yourportfolio.com" style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                        </div>
                        <div>
                            <label htmlFor="profileRole" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><Briefcase size={14}/> Role</label>
                            <input id="profileRole" name="role" type="text" placeholder="e.g. Computer Science Student" value={profile.role} onChange={(e) => setProfile({...profile, role: e.target.value})} style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                        </div>
                        <div>
                            <label htmlFor="profileCollege" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><GraduationCap size={14}/> Institution</label>
                            <input id="profileCollege" name="college" type="text" placeholder="e.g. IIT Delhi" value={profile.college} onChange={(e) => setProfile({...profile, college: e.target.value})} style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                        </div>
                        <div>
                            <label htmlFor="profileSemester" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><BookOpen size={14}/> Semester / Year</label>
                            <input id="profileSemester" name="semester" type="text" placeholder="e.g. 6th Semester" value={profile.semester} onChange={(e) => setProfile({...profile, semester: e.target.value})} style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                        </div>
                        <div>
                            <label htmlFor="profileMonthlyBudget" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><Wallet size={14}/> Monthly Budget Cap ({settings.currencySymbol})</label>
                            <input id="profileMonthlyBudget" name="monthlyBudgetCap" type="number" placeholder="0" value={settings.monthlyBudgetCap} onChange={(e) => updateSetting('monthlyBudgetCap', sanitizeNumberInput(e.target.value, settings.monthlyBudgetCap))} onBlur={(e) => updateSetting('monthlyBudgetCap', normalizeNumberOnBlur(e.target.value, true))} style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                        </div>
                        <div>
                            <label htmlFor="profileHydrationGoal" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}><Dumbbell size={14}/> Daily Water Target (L)</label>
                            <input id="profileHydrationGoal" name="dailyHydrationGoal" type="number" step="0.1" placeholder="e.g. 4.0" value={settings.dailyHydrationGoal} onChange={(e) => updateSetting('dailyHydrationGoal', sanitizeNumberInput(e.target.value, settings.dailyHydrationGoal))} onBlur={(e) => updateSetting('dailyHydrationGoal', normalizeNumberOnBlur(e.target.value, true))} style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
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
        </div>
    );
};

export default ProfilePage;