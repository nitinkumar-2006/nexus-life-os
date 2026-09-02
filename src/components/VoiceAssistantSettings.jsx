// src/components/VoiceAssistantSettings.jsx
//
// The real controls behind the AI Daily Briefing's voice - shared,
// self-contained, and rendered in two places (Settings > Audio, and the
// AI page's own dedicated Voice Assistant main-content view, see
// AIVoiceAssistantView.jsx) rather than duplicated, so both copies can
// never drift out of sync. It used to ALSO render a third, compact copy
// inside AISidebar.jsx's own Voice Assistant panel - a real, reported
// bug, since that panel sits on screen at the very same time as
// AIVoiceAssistantView.jsx's full copy, showing every control twice at
// once; the sidebar now shows VoiceStatusPanel.jsx (live speaking
// status + Stop) instead, so the `compact` prop below is currently
// unused but kept for any future narrow placement. Fully self-contained
// on purpose: reads/writes nexus_global_settings directly (the same
// convention useDailyBriefing.js/AIDailyBriefingCard.jsx already use for
// these exact keys) instead of taking settings as props - this way it
// works correctly wherever it's dropped, with zero prop-threading, and
// stays live-synced with the other copy via the same
// 'nexus_settings_updated' event every settings write in this app
// already dispatches.
import { useState, useEffect } from 'react';
import { Mic, Volume2, Languages, Gauge, Play, Power } from 'lucide-react';
import { buildBriefingSentences, LANG_TAGS, curateVoices } from '../utils/briefingText.js';

const DEFAULTS = {
    // Off by default (opt-in) - the whole Daily Briefing card on Home
    // stays hidden until a user genuinely flips this on themselves; see
    // AIDailyBriefingCard.jsx's own matching default.
    aiVoiceAssistantEnabled: false,
    aiVoiceLanguage: 'en',
    aiVoiceURI: '',
    aiVoiceVolume: 1,
    aiVoiceRate: 1,
    aiVoiceAutoPlay: false,
};

const readSettings = () => {
    try {
        const saved = JSON.parse(localStorage.getItem('nexus_global_settings') || '{}');
        return {
            aiVoiceAssistantEnabled: typeof saved.aiVoiceAssistantEnabled === 'boolean' ? saved.aiVoiceAssistantEnabled : DEFAULTS.aiVoiceAssistantEnabled,
            aiVoiceLanguage: ['en', 'hi', 'hinglish'].includes(saved.aiVoiceLanguage) ? saved.aiVoiceLanguage : DEFAULTS.aiVoiceLanguage,
            aiVoiceURI: saved.aiVoiceURI || DEFAULTS.aiVoiceURI,
            aiVoiceVolume: typeof saved.aiVoiceVolume === 'number' ? saved.aiVoiceVolume : DEFAULTS.aiVoiceVolume,
            aiVoiceRate: typeof saved.aiVoiceRate === 'number' ? saved.aiVoiceRate : DEFAULTS.aiVoiceRate,
            aiVoiceAutoPlay: typeof saved.aiVoiceAutoPlay === 'boolean' ? saved.aiVoiceAutoPlay : DEFAULTS.aiVoiceAutoPlay,
        };
    } catch (e) {
        return DEFAULTS;
    }
};

const isTtsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

// compact: the AI sidebar's own panel is much narrower than a full
// Settings card, so labels/paddings shrink a bit there rather than
// wrapping awkwardly - same real controls either way, no feature
// dropped for the compact layout.
const VoiceAssistantSettings = ({ compact = false }) => {
    const [settings, setSettings] = useState(readSettings);
    const [availableVoices, setAvailableVoices] = useState(() => (
        isTtsSupported() ? curateVoices(window.speechSynthesis.getVoices()) : []
    ));

    useEffect(() => {
        const sync = () => setSettings(readSettings());
        window.addEventListener('nexus_settings_updated', sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener('nexus_settings_updated', sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

    useEffect(() => {
        if (!isTtsSupported()) return undefined;
        const loadVoices = () => setAvailableVoices(curateVoices(window.speechSynthesis.getVoices()));
        loadVoices();
        window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
        return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    }, []);

    // Same real read-merge-write + dual-event-dispatch convention
    // SettingsPage.jsx's own handleChange already established - every
    // other listener in the app (this component's own other instance,
    // useDailyBriefing.js, AIDailyBriefingCard.jsx, CloudSyncContext's
    // auto-push) reacts to these same two events, so a change made from
    // either copy of this component takes effect everywhere instantly.
    const updateSetting = (key, value) => {
        let current = {};
        try { current = JSON.parse(localStorage.getItem('nexus_global_settings') || '{}'); } catch (e) { current = {}; }
        const next = { ...current, [key]: value };
        localStorage.setItem('nexus_global_settings', JSON.stringify(next));
        setSettings((prev) => ({ ...prev, [key]: value }));
        window.dispatchEvent(new Event('nexus_settings_updated'));
        window.dispatchEvent(new Event('storage'));
    };

    const handleTestVoice = () => {
        if (!isTtsSupported()) return;
        const sampleSentences = buildBriefingSentences(settings.aiVoiceLanguage, {
            userName: 'Nitin', pendingToday: 2,
            gymStatus: { hasPlan: true, planName: 'Push Day', loggedToday: false },
            dietStatus: { logged: 2, total: 4 },
            monthlyBudgetCap: 20000, budgetRemaining: 8500, currency: '₹',
        });
        const utterance = new SpeechSynthesisUtterance(sampleSentences.join(' '));
        utterance.rate = settings.aiVoiceRate;
        utterance.volume = settings.aiVoiceVolume;
        utterance.lang = LANG_TAGS[settings.aiVoiceLanguage] || LANG_TAGS.en;
        const match = settings.aiVoiceURI ? availableVoices.find((v) => v.voiceURI === settings.aiVoiceURI) : null;
        if (match) utterance.voice = match;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    };

    const labelStyle = { fontSize: compact ? '11px' : '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' };
    const inputStyle = { width: '100%', padding: compact ? '8px' : '10px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: compact ? '12px' : '13px', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '14px' : '18px' }}>
            {/* The real, explicit kill switch this was actually asked for -
                not just muting the voice, the whole AI Daily Briefing card
                stops rendering on Home the instant this is off (see
                AIDailyBriefingCard.jsx's own early return), and every
                control below is disabled while it's off so it's obvious
                nothing else here does anything until this is back on. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: compact ? '10px 12px' : '12px 14px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <Power size={compact ? 14 : 16} color={settings.aiVoiceAssistantEnabled ? 'var(--success)' : 'var(--text-muted)'} />
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: compact ? '12px' : '13px', fontWeight: '700', color: 'var(--text-primary)' }}>AI Voice Assistant</div>
                        {!compact && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Turns the whole Daily Briefing card on Home on or off</div>}
                    </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '38px', height: '22px', flexShrink: 0 }}>
                    {/* Only the checkbox's own onChange drives state - a
                        real, reported bug was a second onClick on the
                        span below firing ALONGSIDE the browser's native
                        "clicking a label toggles its wrapped input"
                        behavior, so one visible click fired two toggles
                        that raced each other and could net out to no
                        visible change at all. The span is purely the
                        visual track/thumb now; clicking anywhere in this
                        label already toggles the real checkbox natively. */}
                    <input
                        type="checkbox" checked={settings.aiVoiceAssistantEnabled}
                        onChange={(e) => updateSetting('aiVoiceAssistantEnabled', e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span
                        style={{
                            position: 'absolute', inset: 0, borderRadius: '999px', cursor: 'pointer', transition: 'background 0.15s ease',
                            background: settings.aiVoiceAssistantEnabled ? 'var(--primary)' : 'var(--border-premium)',
                        }}
                    >
                        <span style={{
                            position: 'absolute', top: '3px', left: settings.aiVoiceAssistantEnabled ? '19px' : '3px',
                            width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s ease',
                        }} />
                    </span>
                </label>
            </div>

            <fieldset disabled={!settings.aiVoiceAssistantEnabled} style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: compact ? '14px' : '18px', opacity: settings.aiVoiceAssistantEnabled ? 1 : 0.45 }}>
                <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(160px, 1fr))', gap: compact ? '12px' : '16px' }}>
                    <div>
                        <label style={labelStyle}><Languages size={13} /> Language</label>
                        <select value={settings.aiVoiceLanguage} onChange={(e) => updateSetting('aiVoiceLanguage', e.target.value)} style={inputStyle}>
                            <option value="en" style={{ background: 'var(--surface-inset)' }}>English</option>
                            <option value="hi" style={{ background: 'var(--surface-inset)' }}>हिन्दी (Hindi)</option>
                            <option value="hinglish" style={{ background: 'var(--surface-inset)' }}>Hinglish</option>
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}><Volume2 size={13} /> Voice</label>
                        {availableVoices.length > 0 ? (
                            <select value={settings.aiVoiceURI} onChange={(e) => updateSetting('aiVoiceURI', e.target.value)} style={inputStyle}>
                                <option value="" style={{ background: 'var(--surface-inset)' }}>Browser Default</option>
                                {availableVoices.map((v) => (
                                    <option key={v.voiceURI} value={v.voiceURI} style={{ background: 'var(--surface-inset)' }}>{v.name} ({v.lang})</option>
                                ))}
                            </select>
                        ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', padding: '8px 0' }}>No relevant voices found - browser default will be used.</span>
                        )}
                    </div>
                </div>

                <div>
                    <label style={{ ...labelStyle, justifyContent: 'space-between' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Volume2 size={13} /> Voice Volume</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>{Math.round(settings.aiVoiceVolume * 100)}%</span>
                    </label>
                    <input type="range" min="0" max="1" step="0.05" value={settings.aiVoiceVolume} onChange={(e) => updateSetting('aiVoiceVolume', parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary)' }} />
                </div>

                <div>
                    <label style={{ ...labelStyle, justifyContent: 'space-between' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Gauge size={13} /> Speaking Speed</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>{settings.aiVoiceRate.toFixed(2)}x</span>
                    </label>
                    <input type="range" min="0.5" max="2" step="0.05" value={settings.aiVoiceRate} onChange={(e) => updateSetting('aiVoiceRate', parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary)' }} />
                </div>

                {/* A real, opt-in alternative to the per-card manual play
                    button that used to sit on the Home page briefing card
                    (removed - this is now the one real place voice
                    playback is controlled from). Off by default since
                    unprompted audio the moment Home loads is a genuinely
                    reasonable thing to not want by surprise; browsers may
                    also decline to actually produce sound before the user
                    has interacted with the page at all in that session,
                    same real limitation every autoplay-audio feature has. */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: compact ? '12px' : '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Auto-read on open</div>
                        {!compact && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Speak the briefing automatically once, the first time Home loads each day</div>}
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: '38px', height: '22px', flexShrink: 0 }}>
                        <input type="checkbox" checked={settings.aiVoiceAutoPlay} onChange={(e) => updateSetting('aiVoiceAutoPlay', e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                        <span
                            style={{ position: 'absolute', inset: 0, borderRadius: '999px', cursor: 'pointer', transition: 'background 0.15s ease', background: settings.aiVoiceAutoPlay ? 'var(--primary)' : 'var(--border-premium)' }}
                        >
                            <span style={{ position: 'absolute', top: '3px', left: settings.aiVoiceAutoPlay ? '19px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s ease' }} />
                        </span>
                    </label>
                </div>

                <button
                    type="button" onClick={handleTestVoice}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: compact ? '9px 14px' : '10px 18px', borderRadius: '10px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', color: 'var(--text-primary)', fontSize: compact ? '12px' : '13px', fontWeight: '700', cursor: 'pointer', alignSelf: 'flex-start' }}
                >
                    <Play size={13} /> Test Voice
                </button>
            </fieldset>
        </div>
    );
};

export default VoiceAssistantSettings;
