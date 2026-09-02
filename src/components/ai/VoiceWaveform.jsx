// src/components/ai/VoiceWaveform.jsx
//
// A real, live, amplitude-reactive waveform for voice input - genuinely
// driven by the microphone's own current frequency data (see
// useSpeechToText.js's getAudioLevels), redrawn every animation frame,
// not a decorative fixed-pattern CSS pulse. Matches a direct, explicit
// comparison against Gemini/ChatGPT's own voice-input waveform.
//
// Bars are mutated directly via refs inside the rAF loop rather than
// React state - a 60fps state update would re-render this whole
// component (and everything under it) every frame for no reason; the
// DOM nodes are the only thing that actually needs to change per frame.
import { useEffect, useRef } from 'react';

const BAR_COUNT = 24;
// A very small ambient level even while genuinely silent - reads as
// "listening and alive", not "frozen/broken", between real spoken
// syllables.
const IDLE_LEVEL = 0.06;

const VoiceWaveform = ({ getAudioLevels }) => {
    const barRefs = useRef([]);
    const rafRef = useRef(null);

    useEffect(() => {
        const draw = () => {
            const levels = getAudioLevels?.();
            for (let i = 0; i < BAR_COUNT; i++) {
                const bar = barRefs.current[i];
                if (!bar) continue;
                let level = IDLE_LEVEL;
                if (levels && levels.length > 0) {
                    // Downsamples the analyser's real frequency bins onto
                    // BAR_COUNT bars regardless of how many bins the
                    // analyser actually reports, and mirrors around the
                    // center so the shape reads as one continuous wave
                    // (louder in the middle, tapering at both ends) the
                    // way a real voice waveform visually does, rather
                    // than a flat left-to-right frequency ramp.
                    const mirroredIndex = i < BAR_COUNT / 2 ? i : BAR_COUNT - 1 - i;
                    const binIndex = Math.floor((mirroredIndex / (BAR_COUNT / 2)) * levels.length);
                    level = Math.max(IDLE_LEVEL, (levels[binIndex] || 0) / 255);
                }
                bar.style.transform = `scaleY(${level})`;
            }
            rafRef.current = requestAnimationFrame(draw);
        };
        rafRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(rafRef.current);
    }, [getAudioLevels]);

    return (
        <div className="ai-voice-waveform" aria-hidden="true">
            {Array.from({ length: BAR_COUNT }, (_, i) => (
                <span key={i} ref={(el) => { barRefs.current[i] = el; }} className="ai-voice-waveform-bar" />
            ))}
        </div>
    );
};

export default VoiceWaveform;
