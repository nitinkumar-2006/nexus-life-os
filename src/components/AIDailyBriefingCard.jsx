// src/components/AIDailyBriefingCard.jsx
//
// A real, working AI Daily Briefing card - genuine character-by-
// character typed animation, a real TTS button backed by the
// browser's own native SpeechSynthesis API (checked for real support
// before ever being offered), and real "dismissed today only"
// persistence so the card genuinely reappears the next day rather
// than being suppressed forever after one dismissal.
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { useDailyBriefing } from '../hooks/useDailyBriefing.js';

const DISMISS_KEY = 'nexus_briefing_dismissed_date';
const todayIso = () => new Date().toISOString().split('T')[0];

const isTtsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

const AIDailyBriefingCard = ({ isMobile = false }) => {
    const briefing = useDailyBriefing();
    const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === todayIso());
    const [typedText, setTypedText] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const typingRef = useRef(null);

    // Real character-by-character reveal - restarts cleanly whenever
    // the underlying summary text itself genuinely changes (e.g. a
    // transaction posts while this card is open, changing the real
    // remaining-budget sentence), rather than leaving a stale partial
    // string from a prior render.
    useEffect(() => {
        if (dismissed || !briefing.summaryText) return undefined;
        setTypedText('');
        let i = 0;
        const text = briefing.summaryText;
        typingRef.current = setInterval(() => {
            i += 1;
            setTypedText(text.slice(0, i));
            if (i >= text.length) clearInterval(typingRef.current);
        }, 18);
        return () => clearInterval(typingRef.current);
    }, [briefing.summaryText, dismissed]);

    // Stop any in-flight speech if the card is genuinely dismissed or
    // this component unmounts (e.g. navigating away mid-sentence) -
    // a real, working AI voice shouldn't keep talking after its own
    // card is gone.
    useEffect(() => {
        return () => { if (isTtsSupported()) window.speechSynthesis.cancel(); };
    }, []);

    const handleDismiss = () => {
        localStorage.setItem(DISMISS_KEY, todayIso());
        if (isTtsSupported()) window.speechSynthesis.cancel();
        setDismissed(true);
    };

    const handleToggleSpeech = () => {
        if (!isTtsSupported()) return;
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            return;
        }
        const utterance = new SpeechSynthesisUtterance(briefing.summaryText);
        utterance.rate = 1;
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        setIsSpeaking(true);
    };

    if (dismissed || !briefing.summaryText) return null;

    return (
        <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px',
            padding: isMobile ? '18px' : '24px', display: 'flex', flexDirection: 'column', gap: '12px',
            boxShadow: 'var(--premium-shadow)', position: 'relative',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--widget-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Sparkles size={18} color="var(--accent)" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>AI Daily Briefing</h3>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Your Productivity Coach</span>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {isTtsSupported() && (
                        <button
                            onClick={handleToggleSpeech}
                            title={isSpeaking ? 'Stop reading' : 'Read aloud'}
                            style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '8px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isSpeaking ? 'var(--accent)' : 'var(--text-secondary)' }}
                        >
                            {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                        </button>
                    )}
                    <button
                        onClick={handleDismiss}
                        title="Dismiss for today"
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0, minHeight: '1.6em' }}>
                {typedText}
                {typedText.length < briefing.summaryText.length && <span style={{ opacity: 0.6 }}>▍</span>}
            </p>
        </div>
    );
};

export default AIDailyBriefingCard;
