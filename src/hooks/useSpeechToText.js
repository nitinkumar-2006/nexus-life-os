// src/hooks/useSpeechToText.js
//
// Real, native browser speech-to-text via the Web Speech API - no new
// dependency, no API key, genuinely works today in Chrome/Edge/Safari
// (exposed as webkitSpeechRecognition in most of them). Firefox doesn't
// implement it at all; isSupported below reports that honestly so a
// caller can disable/hide the mic button instead of rendering one that
// silently does nothing when clicked.
//
// Also opens a real, second, independent connection to the microphone
// (getUserMedia + a Web Audio AnalyserNode) alongside SpeechRecognition
// - the recognition API itself only ever exposes transcribed TEXT, never
// raw audio samples, so it has no way to drive a genuine amplitude-
// reactive waveform on its own. getAudioLevels() below is a real, live
// read of the mic's current frequency-bin data (not a decorative CSS
// pulse) for a caller to redraw on every animation frame while
// isListening is true - see VoiceWaveform.jsx.
import { useState, useRef, useCallback, useEffect } from 'react';

const SpeechRecognitionCtor = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

// 32 bins is enough for a real, visually smooth ~24-28 bar waveform
// without over-fetching frequency resolution nothing on screen actually
// uses.
const FFT_SIZE = 64;

// onResult(transcript) fires once per completed utterance (interim
// results are deliberately off - a chat input wants one clean final
// transcript to insert, not a flickering live-partial one).
export const useSpeechToText = ({ onResult } = {}) => {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);
    const onResultRef = useRef(onResult);
    onResultRef.current = onResult;

    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const dataArrayRef = useRef(null);
    // Flips to false the instant a session ends - checked (not
    // recognitionRef.current's mere truthiness, which is never reset to
    // null anywhere) inside the async getUserMedia .then() below. Without
    // a dedicated flag, a session that ends quickly (SpeechRecognition's
    // own onerror/onend firing before the separate getUserMedia promise
    // resolves - a real, plausible race, not just theoretical) would let
    // that late-arriving stream slip through the old truthiness check and
    // open an orphaned AudioContext/mic connection nothing ever tears
    // back down again.
    const isSessionActiveRef = useRef(false);

    const teardownAudioAnalyser = useCallback(() => {
        isSessionActiveRef.current = false;
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        audioContextRef.current?.close().catch(() => {});
        audioContextRef.current = null;
        analyserRef.current = null;
        dataArrayRef.current = null;
    }, []);

    useEffect(() => () => { recognitionRef.current?.stop(); teardownAudioAnalyser(); }, [teardownAudioAnalyser]);

    const start = useCallback(() => {
        if (!SpeechRecognitionCtor || isListening) return;
        const recognition = new SpeechRecognitionCtor();
        recognition.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.onresult = (event) => {
            const transcript = Array.from(event.results).map((r) => r[0].transcript).join(' ').trim();
            if (transcript) onResultRef.current?.(transcript);
        };
        recognition.onerror = () => { setIsListening(false); teardownAudioAnalyser(); };
        recognition.onend = () => { setIsListening(false); teardownAudioAnalyser(); };
        recognitionRef.current = recognition;
        try {
            recognition.start();
            setIsListening(true);
            isSessionActiveRef.current = true;
        } catch (e) {
            // start() throws if called while already running (a real,
            // possible race if the button is double-tapped) - safe to
            // ignore, the existing session just continues.
            return;
        }

        // Genuinely independent of SpeechRecognition's own success/
        // failure - a browser/OS that denies the second getUserMedia
        // request (rare, but real: some browsers separately gate raw
        // mic-stream access even once recognition already got the user's
        // permission) still leaves dictation itself fully working, just
        // without the waveform. AudioContext + AnalyserNode is a real,
        // standard Web Audio API - not a library, not a simulation.
        navigator.mediaDevices?.getUserMedia?.({ audio: true }).then((stream) => {
            if (!isSessionActiveRef.current) { stream.getTracks().forEach((t) => t.stop()); return; } // session already ended before this resolved
            mediaStreamRef.current = stream;
            const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContextCtor();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = FFT_SIZE;
            source.connect(analyser);
            audioContextRef.current = audioContext;
            analyserRef.current = analyser;
            dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
        }).catch(() => { /* mic-stream permission denied - dictation itself still works, just no waveform */ });
    }, [isListening, teardownAudioAnalyser]);

    const stop = useCallback(() => {
        recognitionRef.current?.stop();
        setIsListening(false);
        teardownAudioAnalyser();
    }, [teardownAudioAnalyser]);

    // Live per-frame read, not React state - state updates at 60fps would
    // re-render this hook's whole subtree every frame for no reason;
    // returning the array by reference lets a caller redraw a canvas/DOM
    // bars directly inside its own requestAnimationFrame loop instead.
    const getAudioLevels = useCallback(() => {
        const analyser = analyserRef.current;
        const dataArray = dataArrayRef.current;
        if (!analyser || !dataArray) return null;
        analyser.getByteFrequencyData(dataArray);
        return dataArray;
    }, []);

    return { isSupported: !!SpeechRecognitionCtor, isListening, start, stop, getAudioLevels };
};
