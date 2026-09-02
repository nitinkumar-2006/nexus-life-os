// src/components/settings/SettingsProfileHeader.jsx
//
// The "Profile Overview / System Status" header card - real data only,
// no decorative placeholders: the user's own real Nexus profile
// (name/avatar, shared with ProfilePage.jsx via the same
// 'nexus_user_profile' localStorage key and 'nexus_profile_updated'
// live-sync event), the exact same real local-storage byte count
// Automation & Backup's own full storage breakdown uses (so the two
// can never silently disagree), and the real connected-account flags
// already tracked in settings (Apple Music/Spotify/GitHub).
import { useState, useEffect } from 'react';
import { User as UserIcon, Music2, GitBranch, Pencil, Sparkles, Video } from 'lucide-react';
import { isSyntheticPhoneEmail, syntheticEmailToPhone } from '../../utils/phoneAuth.js';
import EditProfileModal from './EditProfileModal.jsx';

const STORAGE_CAP_KB = 5120; // 5MB - the same conservative per-origin quota Automation & Backup's own meter already assumes

const loadNexusProfile = () => {
    try {
        const saved = JSON.parse(localStorage.getItem('nexus_user_profile') || '{}');
        return { name: saved.name || '', avatarUrl: saved.avatarUrl || '' };
    } catch (e) {
        return { name: '', avatarUrl: '' };
    }
};

const SettingsProfileHeader = ({ user, cacheSize, settings, setActiveTab }) => {
    const [profile, setProfile] = useState(loadNexusProfile);
    const [isEditOpen, setIsEditOpen] = useState(false);

    useEffect(() => {
        const sync = () => setProfile(loadNexusProfile());
        window.addEventListener('nexus_profile_updated', sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener('nexus_profile_updated', sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

    const displayName = profile.name || 'New User';
    const avatarInitial = displayName.charAt(0).toUpperCase();
    const identity = user ? (isSyntheticPhoneEmail(user.email) ? syntheticEmailToPhone(user.email) : user.email) : 'Local-only mode';

    // Same read-merge-write + live-sync-event pattern ProfilePage.jsx's
    // own handleSave/persistProfile already use against this exact
    // 'nexus_user_profile' key - editing from here or from the full
    // Profile page both keep every listener (Header, GreetingCard, this
    // card, ProfilePage itself) in sync, and neither one clobbers fields
    // the other owns (bio, socials, skills, etc. are read fresh from
    // storage here rather than reconstructed from this card's own
    // narrower local state).
    const handleSaveProfile = ({ name, avatarUrl }) => {
        let current = {};
        try { current = JSON.parse(localStorage.getItem('nexus_user_profile') || '{}'); } catch (e) { current = {}; }
        const updated = { ...current, name, avatarUrl };
        try {
            localStorage.setItem('nexus_user_profile', JSON.stringify(updated));
        } catch (err) {
            // Same quota-exceeded ceiling ProfilePage.jsx's own save
            // already accounts for (a large uncompressed avatar photo) -
            // silently keeping the old, still-valid saved profile rather
            // than leaving localStorage in a half-written state.
            return;
        }
        setProfile({ name: updated.name || '', avatarUrl: updated.avatarUrl || '' });
        window.dispatchEvent(new Event('nexus_profile_updated'));
        window.dispatchEvent(new Event('storage'));
    };

    const storagePercent = Math.min(100, (parseFloat(cacheSize) / STORAGE_CAP_KB) * 100);

    // Only real, actually-connected services render as pills now - per
    // explicit request, a "Not Connected" pill for a service the user
    // never linked isn't real status, it's a placeholder ad for a
    // feature they haven't used. *Confirmed flags only ever flip true
    // after a real, verified connection (GitHub token check, Apple
    // Music/Spotify OAuth, or - added here - a live API key check
    // against the provider's own endpoint for the 3 AI & Learning keys
    // in Security & Privacy). Real, confirmed gap: this list previously
    // only ever checked Apple Music/Spotify/GitHub, so confirming a
    // Gemini/OpenAI/YouTube key never showed up here at all, no matter
    // how "connected" that key genuinely was.
    const connections = [
        { id: 'apple-music', label: 'Apple Music', icon: Music2, connected: !!settings.appleMusicTokenConfirmed },
        { id: 'spotify', label: 'Spotify', icon: Music2, connected: !!settings.spotifyCredConfirmed },
        { id: 'github', label: 'GitHub', icon: GitBranch, connected: !!settings.githubTokenConfirmed },
        { id: 'openai', label: 'ChatGPT', icon: Sparkles, connected: !!settings.openaiApiKeyConfirmed },
        { id: 'gemini', label: 'Gemini', icon: Sparkles, connected: !!settings.geminiApiKeyConfirmed },
        { id: 'youtube', label: 'YouTube', icon: Video, connected: !!settings.youtubeApiKeyConfirmed },
        { id: 'grok', label: 'Grok', icon: Sparkles, connected: !!settings.grokApiKeyConfirmed },
        { id: 'deepseek', label: 'DeepSeek', icon: Sparkles, connected: !!settings.deepseekApiKeyConfirmed },
    ].filter((c) => c.connected);

    return (
        <div className="settings-profile-header">
            {/* Identity + edit-pencil share one row, wrapped together so
                the pencil sits level with name/email instead of landing on
                its own line below the avatar - which is exactly what
                happened on mobile before this wrapper existed, since
                .settings-profile-header switches to flex-direction: column
                there and these were two separate direct children of it.
                Still two siblings, not nested - a <button> can't contain
                another <button>. */}
            <div className="settings-profile-top-row">
                <button
                    type="button"
                    className="settings-profile-identity settings-profile-identity-link"
                    onClick={() => setActiveTab && setActiveTab('Profile')}
                    aria-label={`Open full profile for ${displayName}`}
                    title="Open full profile"
                >
                    <div className="settings-profile-avatar">
                        {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : (avatarInitial || <UserIcon size={22} />)}
                    </div>
                    <div>
                        <h2 className="settings-profile-name">{displayName}</h2>
                        <p className="settings-profile-email">{identity}</p>
                    </div>
                </button>
                <button type="button" className="settings-profile-edit-btn" onClick={() => setIsEditOpen(true)} aria-label="Edit profile" title="Edit profile">
                    <Pencil size={14} />
                </button>
            </div>

            <div className="settings-profile-divider" />

            <div className="settings-storage-block">
                <div className="settings-storage-label-row">
                    <span className="settings-storage-label">Local Storage Usage</span>
                    <span className="settings-storage-value">{cacheSize} KB / {(STORAGE_CAP_KB / 1024).toFixed(0)} MB</span>
                </div>
                <div className="settings-storage-track">
                    <div className="settings-storage-fill" style={{ width: `${storagePercent}%` }} />
                </div>
            </div>

            <div className="settings-profile-divider" />

            <div className="settings-connections-block">
                <span className="settings-connections-label">Connected Accounts</span>
                {connections.length > 0 ? (
                    <div className="settings-connections-pills">
                        {connections.map((c) => (
                            <span key={c.id} className="settings-connection-pill is-connected" title={`${c.label} connected`}>
                                <span className="settings-connection-dot" /> {c.label}
                            </span>
                        ))}
                    </div>
                ) : (
                    <span className="settings-connections-empty">None connected yet</span>
                )}
            </div>

            <EditProfileModal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                initialName={profile.name}
                initialAvatarUrl={profile.avatarUrl}
                identity={identity}
                onSave={handleSaveProfile}
            />
        </div>
    );
};

export default SettingsProfileHeader;
