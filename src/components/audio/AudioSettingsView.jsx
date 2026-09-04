// src/components/audio/AudioSettingsView.jsx
//
// A real, localized settings view rendered INSIDE the Audio Hub workspace
// (AudioHubPage's own activeView === 'settings') - not a redirect to the
// global Nexus OS Settings page, per explicit request. Only contains
// configuration that's actually about the music player. isMobile-aware
// throughout (stacked rows/full-width controls below the breakpoint)
// rather than the old fixed desktop layout squeezed into a narrow
// viewport - a real, reported gap.
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
// - Equalizer is now real too: AudioPlayerContext wires 5 genuine Web
//   Audio BiquadFilterNode bands onto both <audio> elements (see
//   EQ_BANDS/eqGains there) - dragging a slider here audibly changes
//   playback, it isn't cosmetic.
// - Playback Speed is real: a plain <audio>.playbackRate, applied to
//   whichever element is currently playing.
// - Audio Quality (bitrate selection) still has no real backing anywhere
//   in this app - local files play at their own encoded quality, and
//   neither the Spotify Web Playback SDK nor a plain <audio> element
//   exposes a bitrate switch to pick from - shown as an honest "not
//   configurable" note rather than a fake dropdown that would do nothing.
import React, { useState } from 'react';
import { SlidersHorizontal, Gauge, KeyRound, Apple, Disc, Video, Music2, Check, Loader2, RotateCcw } from 'lucide-react';
import { useAudioPlayer, EQ_BANDS } from '../../context/AudioPlayerContext.jsx';
import { useStreaming } from '../../context/StreamingContext.jsx';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import StreamingSetupModal from './StreamingSetupModal.jsx';

const SERVICES = [
    { id: 'apple', label: 'Apple Music', icon: Apple, color: '#FA233B' },
    { id: 'spotify', label: 'Spotify', icon: Disc, color: '#1DB954' },
    { id: 'youtube', label: 'YouTube', icon: Video, color: '#FF0000' },
    { id: 'saavn', label: 'Saavn', icon: Music2, color: '#2BC5B4' },
];

// isMobile drops the content indent to 0 - the 42px left margin (lining
// content up under the title, past the icon) ate a real chunk of an
// already-narrow phone screen for no benefit there; every control inside
// already reads fine flush with the section's own icon+title above it.
const SectionCard = ({ icon: Icon, title, description, children, isMobile, right }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'var(--primary-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                <Icon size={16} color="var(--primary)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>{title}</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{description}</p>
            </div>
            {right}
        </div>
        <div style={{ marginLeft: isMobile ? 0 : '42px', minWidth: 0 }}>{children}</div>
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

// Real, working playback speeds - a plain <audio>.playbackRate under the
// hood (see setPlaybackRate in AudioPlayerContext.jsx), applied to
// whichever element is actually playing right now.
const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const AudioSettingsView = () => {
    const isMobile = useIsMobile();
    const {
        crossfadeEnabled, setCrossfadeEnabled,
        eqEnabled, setEqEnabled, eqGains, setEqGain, resetEq,
        playbackRate, setPlaybackRate,
    } = useAudioPlayer();
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '560px', minWidth: 0, boxSizing: 'border-box' }}>
            <SectionCard icon={KeyRound} title="API Key Management" description="Connect or disconnect each streaming service's account." isMobile={isMobile}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {SERVICES.map((service) => {
                        const Icon = service.icon;
                        const auth = authFor(service.id);
                        const isConnecting = connecting === service.id;
                        return (
                            <div key={service.id} style={{ display: 'flex', flexWrap: isMobile ? 'wrap' : 'nowrap', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px' }}>
                                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: `${service.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Icon size={15} color={service.color} />
                                </div>
                                <div style={{ flex: 1, minWidth: '120px' }}>
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
                                        marginLeft: isMobile ? '42px' : 0, flexShrink: 0,
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

            <SectionCard icon={SlidersHorizontal} title="Crossfade" description="Smoothly blend the end of one track into the start of the next." isMobile={isMobile}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>Enable crossfade</span>
                    <Toggle checked={crossfadeEnabled} onChange={setCrossfadeEnabled} />
                </div>
            </SectionCard>

            <SectionCard icon={Gauge} title="Playback Speed" description="Real, applies immediately to whatever's playing." isMobile={isMobile}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {PLAYBACK_SPEEDS.map((speed) => {
                        const active = playbackRate === speed;
                        return (
                            <button
                                key={speed}
                                onClick={() => setPlaybackRate(speed)}
                                style={{
                                    padding: '7px 14px', borderRadius: '9999px', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                                    border: `1px solid ${active ? 'var(--primary)' : 'var(--border-premium)'}`,
                                    background: active ? 'var(--primary)' : 'transparent',
                                    color: active ? 'var(--text-on-primary)' : 'var(--text-secondary)',
                                }}
                            >
                                {speed}x
                            </button>
                        );
                    })}
                </div>
            </SectionCard>

            <SectionCard icon={Gauge} title="Audio Quality" description="Playback bitrate/quality selection." isMobile={isMobile}>
                <div style={{ padding: '10px 14px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Not configurable yet - local files play at their own encoded quality, and neither the Spotify SDK nor a plain browser player exposes a bitrate switch to pick from.
                </div>
            </SectionCard>

            <SectionCard
                icon={SlidersHorizontal} title="Equalizer" description="A real 5-band filter, applied live to playback." isMobile={isMobile}
                right={<Toggle checked={eqEnabled} onChange={setEqEnabled} />}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', opacity: eqEnabled ? 1 : 0.5, transition: 'opacity 0.15s ease' }}>
                    {EQ_BANDS.map((band, i) => {
                        const gain = eqGains[i] || 0;
                        return (
                            <div key={band.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', width: '44px', flexShrink: 0 }}>{band.label}</span>
                                <input
                                    type="range" min={-12} max={12} step={1} value={gain}
                                    disabled={!eqEnabled}
                                    onChange={(e) => setEqGain(i, Number(e.target.value))}
                                    style={{ flex: 1, minWidth: 0, accentColor: 'var(--primary)', cursor: eqEnabled ? 'pointer' : 'default' }}
                                />
                                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', width: '38px', textAlign: 'right', flexShrink: 0 }}>{gain > 0 ? `+${gain}` : gain}</span>
                            </div>
                        );
                    })}
                    <button
                        onClick={resetEq}
                        disabled={!eqEnabled}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start',
                            padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-premium)', background: 'transparent',
                            color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', cursor: eqEnabled ? 'pointer' : 'default',
                        }}
                    >
                        <RotateCcw size={12} /> Reset to flat
                    </button>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                        Applies to Local Library and any streamed track whose source allows it. If a streamed track stops loading right after you turn this on, its host doesn't support it - your own uploaded files are never affected.
                    </p>
                </div>
            </SectionCard>

            {setupModalService && (
                <StreamingSetupModal service={setupModalService} onClose={() => setSetupModalService(null)} />
            )}
        </div>
    );
};

export default AudioSettingsView;
