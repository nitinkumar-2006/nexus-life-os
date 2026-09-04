// src/components/audio/TransferMusicModal.jsx
//
// The real "Transfer Music" service switcher (Part 5 of the sidebar-
// architecture spec): a centered modal listing every platform this app
// can play through - Local Library plus each streaming service - and
// switching activeSource immediately on selection. Reuses the exact same
// StreamingContext connect/disconnect functions and configured/connected
// flags LibraryTab's own StreamingServiceControl row already relies on, so
// behavior here can never drift from the Home tab's own connect buttons.
import React, { useEffect, useState } from 'react';
import { X, Check, Apple, Disc, Video, Music2, HardDrive, Loader2 } from 'lucide-react';
import { useStreaming } from '../../context/StreamingContext.jsx';
import StreamingSetupModal from './StreamingSetupModal.jsx';

const SERVICES = [
    { id: 'apple', label: 'Apple Music', icon: Apple, color: '#FA233B' },
    { id: 'spotify', label: 'Spotify', icon: Disc, color: '#1DB954' },
    { id: 'youtube', label: 'YouTube', icon: Video, color: '#FF0000' },
    { id: 'saavn', label: 'Saavn', icon: Music2, color: '#2BC5B4' },
];

const TransferMusicModal = ({ onClose }) => {
    const {
        spotifyAuth, connectSpotify, disconnectSpotify,
        appleMusicAuth, connectAppleMusic, disconnectAppleMusic,
        youtubeAuth, connectYoutube, disconnectYoutube,
        saavnAuth, connectSaavn, disconnectSaavn,
        activeSource, setActiveSource,
        isSpotifyConfigured, isAppleMusicConfigured, isYoutubeConfigured, isSaavnConfigured,
    } = useStreaming();

    const [connecting, setConnecting] = useState(null);
    const [setupModalService, setSetupModalService] = useState(null);

    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const authFor = (id) => ({ apple: appleMusicAuth, spotify: spotifyAuth, youtube: youtubeAuth, saavn: saavnAuth }[id]);
    const configuredFor = (id) => ({ apple: isAppleMusicConfigured, spotify: isSpotifyConfigured, youtube: isYoutubeConfigured, saavn: isSaavnConfigured }[id]);
    const connectFor = (id) => ({ apple: connectAppleMusic, spotify: connectSpotify, youtube: connectYoutube, saavn: connectSaavn }[id]);
    const disconnectFor = (id) => ({ apple: disconnectAppleMusic, spotify: disconnectSpotify, youtube: disconnectYoutube, saavn: disconnectSaavn }[id]);

    const handleSelect = async (id) => {
        const auth = authFor(id);
        if (auth.connected) {
            // Real, immediate switch - this is exactly what LibraryTab's own
            // "Set Active" toggle does, just reachable from here too.
            setActiveSource(id);
            onClose();
            return;
        }
        if (!configuredFor(id)) { setSetupModalService(id); return; }
        setConnecting(id);
        try { await connectFor(id)(); } finally { setConnecting(null); }
    };

    const handleSelectLocal = () => {
        setActiveSource('local');
        onClose();
    };

    return (
        <>
            <div
                onClick={onClose}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
            >
                <div
                    role="dialog" aria-label="Transfer Music"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        width: '100%', maxWidth: '380px', background: 'var(--popover-bg, var(--bg-surface))',
                        backdropFilter: 'blur(max(var(--glass-blur, 20px), 16px)) saturate(140%)',
                        WebkitBackdropFilter: 'blur(max(var(--glass-blur, 20px), 16px)) saturate(140%)',
                        border: '1px solid var(--border-premium)', borderRadius: '20px', boxShadow: 'var(--premium-shadow)',
                        display: 'flex', flexDirection: 'column', animation: 'nexusAudioOverlayFadeIn 0.2s cubic-bezier(0.16,1,0.3,1)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border-premium)' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>Transfer Music</h3>
                            <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>Switch which service powers playback</p>
                        </div>
                        <button onClick={onClose} aria-label="Close" style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '8px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            <X size={15} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px' }}>
                        <button
                            onClick={handleSelectLocal}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 12px', borderRadius: '12px', border: 'none',
                                background: activeSource === 'local' || !activeSource ? 'var(--primary-muted)' : 'transparent', cursor: 'pointer', textAlign: 'left',
                            }}
                        >
                            <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'var(--widget-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <HardDrive size={16} color="var(--text-secondary)" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Local Library</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Your own uploaded &amp; mock tracks</div>
                            </div>
                            {(activeSource === 'local' || !activeSource) && <Check size={16} color="var(--primary)" />}
                        </button>

                        {/* Only genuinely CONNECTED services render here now
                            - a real, confirmed report: showing all 4 (Not
                            connected/Not set up included) reads as "you can
                            transfer to this", which you genuinely can't -
                            there's nothing yet to switch TO. Connecting a
                            new service is Connections' own job (real
                            Connect/setup buttons live there); this modal is
                            now honestly just "which of your ALREADY-
                            connected services should play", matching what
                            its own name promises. */}
                        {SERVICES.filter((service) => authFor(service.id).connected).map((service) => {
                            const Icon = service.icon;
                            const auth = authFor(service.id);
                            const isActive = activeSource === service.id;
                            const isConnecting = connecting === service.id;
                            // Real, confirmed root cause of "clicking Spotify
                            // does nothing, stays on Local": setActiveSource
                            // DOES switch immediately, but a separate effect
                            // in StreamingContext.jsx then tries to actually
                            // initialize a real Spotify Web Playback device
                            // - and silently reverts back to 'local' if that
                            // fails (e.g. "Premium required for playback",
                            // a genuine Spotify API restriction, not a bug
                            // in this app). That revert was real and
                            // correct (you shouldn't stay "active" on a
                            // source that can't actually play) - what was
                            // missing was ever SHOWING why, so it just
                            // looked like clicking silently did nothing.
                            // auth.error already carries the real message
                            // (see StreamingContext.jsx's own error
                            // strings) - surfaced here instead of the
                            // generic "Connected" subtitle whenever present.
                            const subtitle = auth.error
                                ? auth.error
                                : (service.id === 'spotify' && spotifyAuth.profileName ? spotifyAuth.profileName : 'Connected');
                            return (
                                <button
                                    key={service.id}
                                    onClick={() => handleSelect(service.id)}
                                    disabled={isConnecting}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 12px', borderRadius: '12px', border: 'none',
                                        background: isActive ? 'var(--primary-muted)' : 'transparent', cursor: isConnecting ? 'wait' : 'pointer', textAlign: 'left',
                                    }}
                                >
                                    <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: `${service.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {isConnecting ? <Loader2 size={16} color={service.color} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Icon size={16} color={service.color} />}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{service.label}</div>
                                        <div style={{ fontSize: '11px', color: auth.error ? '#F87171' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: auth.error ? 'normal' : 'nowrap' }}>{subtitle}</div>
                                    </div>
                                    {isActive && <Check size={16} color="var(--primary)" />}
                                    {auth.connected && !isActive && (
                                        <span
                                            role="button" tabIndex={0}
                                            onClick={(e) => { e.stopPropagation(); disconnectFor(service.id)(); }}
                                            title={`Disconnect ${service.label}`}
                                            style={{ fontSize: '10px', fontWeight: '700', color: '#EF4444', cursor: 'pointer', flexShrink: 0 }}
                                        >
                                            Disconnect
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
            {setupModalService && (
                <StreamingSetupModal service={setupModalService} onClose={() => setSetupModalService(null)} />
            )}
        </>
    );
};

export default TransferMusicModal;
