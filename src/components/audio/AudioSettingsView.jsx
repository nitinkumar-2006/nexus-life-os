// src/components/audio/AudioSettingsView.jsx
//
// A real, localized settings view rendered INSIDE the Audio Hub workspace
// (AudioHubPage's own activeView === 'settings') - not a redirect to the
// global Nexus OS Settings page, per explicit request. Only contains
// configuration that's actually about the music player.
//
// Honest scope: of the four areas the spec names (Audio Quality, API Key
// management, Crossfade, Equalizer) -
// - Crossfade is real: AudioPlayerContext already has a genuine, working
//   crossfadeEnabled/setCrossfadeEnabled pair (a real dual-<audio>-element
//   crossfade, not a cosmetic toggle) - wired directly here.
// - API Key management is real: reuses the exact same connected/
//   configured state and connect/disconnect functions LibraryTab's own
//   streaming row and TransferMusicModal use, so a change here can never
//   drift from what those show.
// - Audio Quality has no real backing state anywhere in this app (local
//   files/streaming APIs don't expose a selectable bitrate here) - shown
//   as an honest "not configurable yet" note rather than a fake dropdown.
// - Equalizer has no real backing engine (this app plays through plain
//   <audio> elements, no Web Audio gain/filter graph) - same honest
//   "not available in this build" treatment, not a set of sliders that
//   would silently do nothing.
import React, { useState } from 'react';
import { SlidersHorizontal, Gauge, KeyRound, Apple, Disc, Video, Music2, Check, Loader2 } from 'lucide-react';
import { useAudioPlayer } from '../../context/AudioPlayerContext.jsx';
import { useStreaming } from '../../context/StreamingContext.jsx';
import StreamingSetupModal from './StreamingSetupModal.jsx';

const SERVICES = [
    { id: 'apple', label: 'Apple Music', icon: Apple, color: '#FA233B' },
    { id: 'spotify', label: 'Spotify', icon: Disc, color: '#1DB954' },
    { id: 'youtube', label: 'YouTube', icon: Video, color: '#FF0000' },
    { id: 'saavn', label: 'Saavn', icon: Music2, color: '#2BC5B4' },
];

const SectionCard = ({ icon: Icon, title, description, children }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'var(--primary-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                <Icon size={16} color="var(--primary)" />
            </div>
            <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>{title}</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{description}</p>
            </div>
        </div>
        <div style={{ marginLeft: '42px' }}>{children}</div>
    </div>
);

const Toggle = ({ checked, onChange }) => (
    <button
        onClick={() => onChange(!checked)}
        role="switch" aria-checked={checked}
        style={{
            width: '42px', height: '24px', borderRadius: '9999px', border: 'none', cursor: 'pointer', padding: '3px',
            background: checked ? 'var(--primary)' : 'var(--widget-bg)', display: 'flex', justifyContent: checked ? 'flex-end' : 'flex-start',
            transition: 'background 0.15s ease',
        }}
    >
        <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
);

const AudioSettingsView = () => {
    const { crossfadeEnabled, setCrossfadeEnabled } = useAudioPlayer();
    const {
        spotifyAuth, connectSpotify, disconnectSpotify,
        appleMusicAuth, connectAppleMusic, disconnectAppleMusic,
        youtubeAuth, connectYoutube, disconnectYoutube,
        saavnAuth, connectSaavn, disconnectSaavn,
        isSpotifyConfigured, isAppleMusicConfigured, isYoutubeConfigured, isSaavnConfigured,
    } = useStreaming();
    const [connecting, setConnecting] = useState(null);
    const [setupModalService, setSetupModalService] = useState(null);

    const authFor = (id) => ({ apple: appleMusicAuth, spotify: spotifyAuth, youtube: youtubeAuth, saavn: saavnAuth }[id]);
    const configuredFor = (id) => ({ apple: isAppleMusicConfigured, spotify: isSpotifyConfigured, youtube: isYoutubeConfigured, saavn: isSaavnConfigured }[id]);
    const connectFor = (id) => ({ apple: connectAppleMusic, spotify: connectSpotify, youtube: connectYoutube, saavn: connectSaavn }[id]);
    const disconnectFor = (id) => ({ apple: disconnectAppleMusic, spotify: disconnectSpotify, youtube: disconnectYoutube, saavn: disconnectSaavn }[id]);

    const handleToggleConnect = async (id) => {
        const auth = authFor(id);
        if (auth.connected) { disconnectFor(id)(); return; }
        if (!configuredFor(id)) { setSetupModalService(id); return; }
        setConnecting(id);
        try { await connectFor(id)(); } finally { setConnecting(null); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '560px' }}>
            <SectionCard icon={KeyRound} title="API Key Management" description="Connect or disconnect each streaming service's account.">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {SERVICES.map((service) => {
                        const Icon = service.icon;
                        const auth = authFor(service.id);
                        const isConnecting = connecting === service.id;
                        return (
                            <div key={service.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px' }}>
                                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: `${service.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Icon size={15} color={service.color} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{service.label}</div>
                                    <div style={{ fontSize: '11px', color: auth.connected ? 'var(--success)' : 'var(--text-muted)' }}>
                                        {auth.connected ? 'Connected' : configuredFor(service.id) ? 'Configured - not connected' : 'Not configured'}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleToggleConnect(service.id)}
                                    disabled={isConnecting}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700',
                                        border: `1px solid ${auth.connected ? 'rgba(239,68,68,0.4)' : 'var(--border-premium)'}`,
                                        background: auth.connected ? 'rgba(239,68,68,0.1)' : 'transparent',
                                        color: auth.connected ? '#EF4444' : 'var(--text-secondary)', cursor: isConnecting ? 'wait' : 'pointer',
                                    }}
                                >
                                    {isConnecting && <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />}
                                    {auth.connected ? 'Disconnect' : 'Connect'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </SectionCard>

            <SectionCard icon={SlidersHorizontal} title="Crossfade" description="Smoothly blend the end of one track into the start of the next.">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>Enable crossfade</span>
                    <Toggle checked={crossfadeEnabled} onChange={setCrossfadeEnabled} />
                </div>
            </SectionCard>

            <SectionCard icon={Gauge} title="Audio Quality" description="Playback bitrate/quality selection.">
                <div style={{ padding: '10px 14px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Not configurable yet - local files play at their own encoded quality, and connected streaming services use their own default.
                </div>
            </SectionCard>

            <SectionCard icon={SlidersHorizontal} title="Equalizer" description="Adjust frequency bands during playback.">
                <div style={{ padding: '10px 14px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Not available in this build - Nexus OS doesn't have an audio-processing graph wired up yet, only plain playback.
                </div>
            </SectionCard>

            {setupModalService && (
                <StreamingSetupModal service={setupModalService} onClose={() => setSetupModalService(null)} />
            )}
        </div>
    );
};

export default AudioSettingsView;
