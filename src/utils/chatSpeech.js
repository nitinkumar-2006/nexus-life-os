// src/utils/chatSpeech.js
//
// Shared Web Speech (TTS) helpers for the AI page's Read Aloud feature.
// Used by AIChatArea.jsx (per-message "Read aloud" menu item AND the
// header's own conditional Play/Pause control) via state owned one level
// up in AILayout.jsx - both need to drive the exact same speechSynthesis
// call/voice-settings read, so this is pulled out to one real shared
// place instead of two copies that could drift out of sync.
import { LANG_TAGS } from './briefingText.js';

export const isTtsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

// The exact same nexus_global_settings.aiVoiceURI/aiVoiceRate/
// aiVoiceVolume/aiVoiceLanguage the AI Daily Briefing card's own
// speakBriefing() reads (see AIDailyBriefingCard.jsx) - Read Aloud on a
// chat response uses the identical voice, rate, volume, and language
// tag as the rest of the app's Voice Assistant feature.
const readVoiceSettings = () => {
    try { return JSON.parse(localStorage.getItem('nexus_global_settings') || '{}'); } catch (e) { return {}; }
};

// onDone fires once - on a natural end AND on cancel/error alike - so
// whichever UI started this utterance (a message's own "Read aloud" menu
// item, or the sidebar's Play/Pause control) can reliably flip itself
// back to its idle icon either way, instead of only reacting to a clean
// finish.
export const speakMessageText = (text, onDone) => {
    if (!isTtsSupported() || !text) { onDone?.(); return; }
    const voiceSettings = readVoiceSettings();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = typeof voiceSettings.aiVoiceRate === 'number' ? voiceSettings.aiVoiceRate : 1;
    utterance.volume = typeof voiceSettings.aiVoiceVolume === 'number' ? voiceSettings.aiVoiceVolume : 1;
    utterance.lang = LANG_TAGS[voiceSettings.aiVoiceLanguage] || LANG_TAGS.en;
    const match = voiceSettings.aiVoiceURI
        ? window.speechSynthesis.getVoices().find((v) => v.voiceURI === voiceSettings.aiVoiceURI)
        : null;
    if (match) utterance.voice = match;
    if (onDone) { utterance.onend = onDone; utterance.onerror = onDone; }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
};

// Real pause/resume - NOT cancel-and-replay. A real, reported bug was
// the Play/Pause control always restarting a reading from the very
// beginning instead of actually continuing from wherever it was paused;
// speechSynthesis.pause()/resume() genuinely suspend and continue the
// SAME utterance in place (unlike cancel(), which drops it entirely), so
// this is the real fix rather than a from-scratch replay.
export const pauseSpeaking = () => { if (isTtsSupported()) window.speechSynthesis.pause(); };
export const resumeSpeaking = () => { if (isTtsSupported()) window.speechSynthesis.resume(); };
export const cancelSpeaking = () => { if (isTtsSupported()) window.speechSynthesis.cancel(); };
