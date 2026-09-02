// src/components/ai/VoiceStatusPanel.jsx
//
// The AI sidebar's own "Voice Assistant" section - deliberately NOT a
// second copy of the full VoiceAssistantSettings form. A real, reported
// bug: clicking "Voice Assistant" swapped the main content area to
// AIVoiceAssistantView.jsx (which renders that full settings form) WHILE
// the sidebar next to it also rendered <VoiceAssistantSettings compact />
// - the exact same Language/Voice/Volume/Speed/Auto-read/Test Voice
// controls, visible twice on screen at once. This replaces that
// duplicate with the one thing neither settings copy offers: live
// speaking status plus a real Stop control - today nothing in the app
// lets you interrupt an in-progress reading (Test Voice, the Daily
// Briefing, or the chat's own Read Aloud/header Play button all just
// call speechSynthesis.speak() with no way to cut it off except waiting
// it out) - alongside a compact read-only summary of the active voice
// so this panel is still useful without re-showing the editable form.
import { useState, useEffect } from 'react';
import { Volume2, VolumeX, Languages, Gauge, Square } from 'lucide-react';
import { curateVoices } from '../../utils/briefingText.js';

const isTtsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

const LANGUAGE_LABELS = { en: 'English', hi: 'हिन्दी (Hindi)', hinglish: 'Hinglish' };

// Mirrors VoiceAssistantSettings.jsx's own defaults for just the three
// fields this read-only summary needs - kept local and minimal (same
// "fully self-contained" convention that file already documents) rather
// than threading its full settings object down through props.
const readVoiceSummary = () => {
    try {
        const saved = JSON.parse(localStorage.getItem('nexus_global_settings') || '{}');
        return {
            aiVoiceLanguage: ['en', 'hi', 'hinglish'].includes(saved.aiVoiceLanguage) ? saved.aiVoiceLanguage : 'en',
            aiVoiceURI: saved.aiVoiceURI || '',
            aiVoiceRate: typeof saved.aiVoiceRate === 'number' ? saved.aiVoiceRate : 1,
        };
    } catch (e) {
        return { aiVoiceLanguage: 'en', aiVoiceURI: '', aiVoiceRate: 1 };
    }
};

const VoiceStatusPanel = () => {
    const [settings, setSettings] = useState(readVoiceSummary);
    const [availableVoices, setAvailableVoices] = useState(() => (
        isTtsSupported() ? curateVoices(window.speechSynthesis.getVoices()) : []
    ));
    const [isSpeaking, setIsSpeaking] = useState(() => isTtsSupported() && window.speechSynthesis.speaking);

    useEffect(() => {
        const sync = () => setSettings(readVoiceSummary());
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

    // The Web Speech API has no "speaking state changed" event to
    // subscribe to - a cheap poll while this small panel is mounted is
    // the same real approach VoiceWaveform.jsx already uses for its own
    // live levels, far simpler than a custom event bus for one indicator.
    useEffect(() => {
        if (!isTtsSupported()) return undefined;
        const id = setInterval(() => setIsSpeaking(window.speechSynthesis.speaking), 400);
        return () => clearInterval(id);
    }, []);

    // Deliberately NOT gated on isSpeaking - that flag comes from polling
    // window.speechSynthesis.speaking (see above), which some browsers
    // report a beat late or inconsistently; a real, reported bug was
    // clicking Stop appearing to do nothing, because the button was
    // disabled whenever that poll hadn't (yet, or reliably) caught up to
    // an utterance actually playing. cancel() is safe to call even when
    // nothing is speaking - it's just a no-op then - so the button now
    // always works rather than depending on this panel's own guess at
    // the current state.
    const handleStop = () => {
        if (isTtsSupported()) window.speechSynthesis.cancel();
        setIsSpeaking(false);
    };

    const activeVoice = settings.aiVoiceURI ? availableVoices.find((v) => v.voiceURI === settings.aiVoiceURI) : null;
    const voiceLabel = activeVoice ? `${activeVoice.name} (${activeVoice.lang})` : 'Browser Default';
    const langLabel = LANGUAGE_LABELS[settings.aiVoiceLanguage] || LANGUAGE_LABELS.en;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '10px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: isSpeaking ? 'var(--primary)' : 'var(--text-muted)' }}>
                    {isSpeaking ? <Volume2 size={13} /> : <VolumeX size={13} />}
                    {isSpeaking ? 'Speaking now' : 'Idle'}
                </span>
                <button
                    type="button" onClick={handleStop}
                    title="Stop speaking" aria-label="Stop speaking"
                    style={{
                        display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 9px', borderRadius: '8px',
                        border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)',
                        fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                    }}
                >
                    <Square size={11} fill="currentColor" /> Stop
                </button>
            </div>

            {/* Read-only - the editable copies of these same three fields
                already live one panel over in the main content area
                (AIVoiceAssistantView.jsx), which is showing at the exact
                same time this sidebar panel is. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', padding: '0 2px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Languages size={12} /> {langLabel}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={voiceLabel}><Volume2 size={12} /> {voiceLabel}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Gauge size={12} /> {settings.aiVoiceRate.toFixed(2)}x speed</span>
            </div>
        </div>
    );
};

export default VoiceStatusPanel;
