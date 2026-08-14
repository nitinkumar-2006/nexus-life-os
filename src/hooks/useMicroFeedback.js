// src/hooks/useMicroFeedback.js
//
// The single, shared micro-interaction feedback service for the whole
// OS - a thin, semantic layer over the sound infrastructure that
// already exists (SoundSettingsContext's playChannelSound + the
// synthesized tones in noiseSynth.js), plus real device haptics via the
// Vibration API. Nothing here invents a new sound engine or a new
// volume/mute system: every call routes through the exact same
// playChannelSound path the Settings page's own "Test" button already
// uses, so the Master Audio Mixer's UI Feedback and Task Alerts
// volume/mute state is respected automatically, everywhere, with zero
// duplicated logic.
//
// Why a hook and not a plain exported function: it needs useSoundActions()
// under the hood, which is itself a hook (reads SoundActionsContext).
// Deliberately built on useSoundActions() rather than the heavier
// useSoundSettings() - this hook only ever needs to TRIGGER sounds, never
// read live volume/settings values, so this stays on the stable-reference
// fast path and never causes a consumer to re-render when a volume slider
// moves elsewhere in the app.
import { useCallback } from 'react';
import { useSoundActions } from '../context/SoundSettingsContext.jsx';
import { getUiClickUrl, getTaskAlertUrl } from '../utils/noiseSynth.js';

// Real, feature-detected haptic pulse - navigator.vibrate is a genuine
// browser API (Android Chrome/Firefox; not supported on iOS Safari or
// desktop, which is exactly why this is guarded rather than assumed).
// Wrapped in try/catch too since some browsers throw if called from a
// context vibrate() doesn't permit (e.g. without a recent user gesture)
// rather than just silently no-op.
const triggerHaptic = (durationMs) => {
    try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(durationMs);
        }
    } catch (e) {
        /* Haptics are a nice-to-have, never worth breaking the triggering interaction over */
    }
};

export const useMicroFeedback = () => {
    const { playChannelSound } = useSoundActions();

    // A deliberate, everyday button press - the baseline "UI Feedback"
    // tick at full intensity.
    const click = useCallback(() => {
        playChannelSound('uiFeedback', getUiClickUrl, { intensity: 1 });
        triggerHaptic(8);
    }, [playChannelSound]);

    // Tab/nav switches happen far more often than a deliberate click (a
    // user clicking through several sidebar items in a row), so this
    // plays slightly softer than a full click - present, but not
    // fatiguing on rapid repeated navigation.
    const tabSwitch = useCallback(() => {
        playChannelSound('uiFeedback', getUiClickUrl, { intensity: 0.75 });
        triggerHaptic(6);
    }, [playChannelSound]);

    // A modal appearing is a more significant UI event than a routine
    // click, so this plays at a touch above full intensity - still the
    // same underlying tick, just a bit more present.
    const modalOpen = useCallback(() => {
        playChannelSound('uiFeedback', getUiClickUrl, { intensity: 1.15 });
        triggerHaptic(10);
    }, [playChannelSound]);

    // Real task completion - routes through the separate Task Alerts
    // channel (its own volume/mute, its own distinct two-note chime),
    // exactly matching what this channel was already built for.
    const taskComplete = useCallback(() => {
        playChannelSound('taskAlerts', getTaskAlertUrl, { intensity: 1 });
        triggerHaptic([10, 40, 10]); // short-pause-short: a little more celebratory than a flat buzz
    }, [playChannelSound]);

    return { click, tabSwitch, modalOpen, taskComplete };
};
