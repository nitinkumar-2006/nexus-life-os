// src/components/AIDailyBriefingCard.jsx
//
// A real, working AI Daily Briefing card - genuine character-by-
// character typed animation, real "dismissed today only" persistence
// so the card genuinely reappears the next day rather than being
// suppressed forever after one dismissal, and a real master ON/OFF
// (aiVoiceAssistantEnabled, set from Settings > Audio > Voice
// Assistant or its twin panel in the AI page's sidebar) that this
// card's own rendering is fully gated behind. Voice playback itself
// has no manual button on this card anymore - see speakBriefing()
// below, triggered only by the opt-in Auto-read on open setting.
//
// Visual pass: this used to be one flat paragraph of text under a
// plain square icon, which read as an unfinished placeholder even
// though the sentence itself is genuinely built from live data (see
// useDailyBriefing.js). Now backed by the same real per-topic numbers
// as a small row of status chips (tasks/gym/diet/budget - each one
// only appears when that topic's own sentence would, mirroring
// briefingText.js's own conditionals exactly, so nothing here is ever
// invented) plus a live "AI Assistant" gradient avatar and a genuine
// link into the Voice Assistant's own settings, not just decoration.
import { useState, useEffect, useRef } from 'react';
import { Sparkles, X, ListChecks, Dumbbell, Utensils, Wallet, Settings2 } from 'lucide-react';
import { useDailyBriefing } from '../hooks/useDailyBriefing.js';
import { getLocalDateString } from '../utils/dateUtils.js';
import { LANG_TAGS } from '../utils/briefingText.js';

const DISMISS_KEY = 'nexus_briefing_dismissed_date';
// Guards auto-play to genuinely once per day, separate from DISMISS_KEY -
// dismissing the card for today shouldn't itself count as "already
// auto-played" if the card reappears (e.g. after a hot reload) before
// today's dismissal, and vice versa.
const AUTOPLAYED_KEY = 'nexus_briefing_autoplayed_date';
const todayIso = () => getLocalDateString();

const isTtsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

const readVoiceSettings = () => {
    try { return JSON.parse(localStorage.getItem('nexus_global_settings') || '{}'); } catch (e) { return {}; }
};

// setActiveTab: optional - lifted the same way GreetingCard/header.jsx
// already receive it, so the "Voice Assistant" chip below can genuinely
// open the AI page instead of being a dead label. The card still works
// with zero navigation (just renders without the chip's onClick doing
// anything useful) if a caller ever omits it.
const AIDailyBriefingCard = ({ isMobile = false, setActiveTab }) => {
    const briefing = useDailyBriefing();
    const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === todayIso());
    const [typedText, setTypedText] = useState('');
    // Master ON/OFF for the whole feature - set in Settings > Audio >
    // Voice Assistant, or the equivalent panel in the AI page's own
    // sidebar (both write the same nexus_global_settings key, live-
    // synced here the same way every other component reads it). This
    // card is the ONE thing this switch actually controls, per an
    // explicit request: off means it genuinely stops rendering here,
    // not just goes silent. Defaults to OFF (opt-in) - a user who has
    // never touched this switch has never asked for an AI voice
    // assistant, so this card has no business appearing on their Home
    // page until they genuinely turn it on themselves.
    const [assistantEnabled, setAssistantEnabled] = useState(() => {
        const saved = readVoiceSettings();
        return typeof saved.aiVoiceAssistantEnabled === 'boolean' ? saved.aiVoiceAssistantEnabled : false;
    });
    const typingRef = useRef(null);

    useEffect(() => {
        const sync = () => {
            const saved = readVoiceSettings();
            setAssistantEnabled(typeof saved.aiVoiceAssistantEnabled === 'boolean' ? saved.aiVoiceAssistantEnabled : false);
        };
        window.addEventListener('nexus_settings_updated', sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener('nexus_settings_updated', sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

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

    // Real voice + volume + rate from Settings > Audio > "Voice
    // Assistant" (or its twin panel in the AI page's sidebar) - the
    // same nexus_global_settings.aiVoiceURI/aiVoiceVolume/aiVoiceRate
    // that section's own "Test" button already previews. Language is a
    // fully separate setting (briefing.language, already resolved by
    // useDailyBriefing.js from aiVoiceLanguage) - picking a voice here
    // never changes which language got spoken, only which installed
    // voice reads it. Falls back to the browser/OS default untouched if
    // no voice was ever picked, or the picked voice is no longer
    // available on this device. The manual play/stop button that used
    // to live on this card is gone - Auto-read on open (below) is now
    // the one real way this card's own voice gets triggered.
    const speakBriefing = () => {
        if (!isTtsSupported() || !briefing.summaryText) return;
        const utterance = new SpeechSynthesisUtterance(briefing.summaryText);
        const voiceSettings = readVoiceSettings();
        utterance.rate = typeof voiceSettings.aiVoiceRate === 'number' ? voiceSettings.aiVoiceRate : 1;
        const match = voiceSettings.aiVoiceURI
            ? window.speechSynthesis.getVoices().find((v) => v.voiceURI === voiceSettings.aiVoiceURI)
            : null;
        utterance.lang = LANG_TAGS[briefing.language] || LANG_TAGS.en;
        if (match) utterance.voice = match;
        utterance.volume = typeof voiceSettings.aiVoiceVolume === 'number' ? voiceSettings.aiVoiceVolume : 1;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    };

    // Auto-read on open: fires at most once per real calendar day, and
    // only once this card's typed-out reveal has actually finished, so
    // the voice doesn't start reading over text still mid-animation.
    // Genuinely opt-in (aiVoiceAutoPlay, off by default) - most
    // browsers also won't actually produce sound before the user has
    // interacted with the page at all in that session; this fires the
    // real speak() call regardless, it just may be silently blocked by
    // the browser's own autoplay policy until then, same as any other
    // autoplay-audio feature.
    useEffect(() => {
        if (dismissed || !assistantEnabled || !briefing.summaryText) return;
        const voiceSettings = readVoiceSettings();
        if (!voiceSettings.aiVoiceAutoPlay) return;
        if (localStorage.getItem(AUTOPLAYED_KEY) === todayIso()) return;
        if (typedText.length < briefing.summaryText.length) return;
        localStorage.setItem(AUTOPLAYED_KEY, todayIso());
        speakBriefing();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dismissed, assistantEnabled, briefing.summaryText, typedText]);

    if (!assistantEnabled || dismissed || !briefing.summaryText) return null;

    // Real status chips - each built straight from useDailyBriefing.js's
    // own live numbers, and gated on the exact same conditions
    // briefingText.js uses to decide whether that topic gets its own
    // sentence at all (a gym chip never appears for a user with no
    // active plan, a budget chip never appears with no cap set, etc.),
    // so this row can never show a topic the typed sentence itself
    // stayed silent on.
    const chips = [
        {
            key: 'tasks',
            Icon: ListChecks,
            label: briefing.pendingTasksToday === 0 ? 'All clear today' : `${briefing.pendingTasksToday} task${briefing.pendingTasksToday === 1 ? '' : 's'} pending`,
        },
        briefing.gymStatus?.hasPlan ? {
            key: 'gym',
            Icon: Dumbbell,
            label: briefing.gymStatus.loggedToday ? `${briefing.gymStatus.planName} logged` : `${briefing.gymStatus.planName} not logged yet`,
        } : null,
        briefing.dietStatus?.total > 0 ? {
            key: 'diet',
            Icon: Utensils,
            label: `${briefing.dietStatus.logged}/${briefing.dietStatus.total} meals logged`,
        } : null,
        briefing.hasBudgetData ? {
            key: 'budget',
            Icon: Wallet,
            label: `${briefing.currency}${Math.round(briefing.budgetRemaining).toLocaleString()} left`,
        } : null,
    ].filter(Boolean);

    const stillTyping = typedText.length < briefing.summaryText.length;

    return (
        <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px',
            padding: isMobile ? '18px' : '24px', display: 'flex', flexDirection: 'column', gap: '14px',
            boxShadow: 'var(--premium-shadow)', position: 'relative', overflow: 'hidden',
        }}>
            {/* A faint gradient wash in the top-right corner - the same
                real "this card belongs to the AI feature" cue the header's
                own Sparkles button and the AI page share, purely
                decorative and never intercepting clicks. */}
            <div style={{
                position: 'absolute', top: '-60px', right: '-60px', width: '180px', height: '180px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), var(--accent))', opacity: 0.08, pointerEvents: 'none',
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{
                        width: '38px', height: '38px', borderRadius: '12px', flexShrink: 0, position: 'relative',
                        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 14px -4px var(--primary)',
                    }}>
                        <Sparkles size={18} color="#fff" />
                        {/* Genuine "live" indicator, not just decoration -
                            only lit while this card's own briefing is still
                            typing itself out. */}
                        {stillTyping && (
                            <span style={{
                                position: 'absolute', top: '-2px', right: '-2px', width: '9px', height: '9px', borderRadius: '50%',
                                background: '#10B981', border: '2px solid var(--bg-surface)',
                            }} />
                        )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>AI Daily Briefing</h3>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Your Productivity Coach</span>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    {typeof setActiveTab === 'function' && (
                        <button
                            onClick={() => setActiveTab('AI')}
                            title="Open Voice Assistant settings"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--widget-bg)',
                                border: '1px solid var(--border-premium)', borderRadius: '999px', color: 'var(--text-secondary)',
                                cursor: 'pointer', padding: isMobile ? '5px 8px' : '5px 10px', fontSize: '11px', fontWeight: '700',
                            }}
                        >
                            <Settings2 size={12} /> {!isMobile && 'Assistant'}
                        </button>
                    )}
                    <button
                        onClick={handleDismiss}
                        title="Dismiss for today"
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0, minHeight: '1.6em', position: 'relative' }}>
                {typedText}
                {stillTyping && <span style={{ opacity: 0.6 }}>▍</span>}
            </p>

            {!stillTyping && chips.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', position: 'relative' }}>
                    {chips.map(({ key, Icon, label }) => (
                        <span
                            key={key}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '999px',
                                background: 'var(--widget-bg)', border: '1px solid var(--border-premium)',
                                fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)',
                            }}
                        >
                            <Icon size={12} color="var(--accent)" /> {label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AIDailyBriefingCard;
