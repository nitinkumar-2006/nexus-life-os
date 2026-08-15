// src/utils/noiseSynth.js
//
// Generates real, guaranteed-to-work ambient audio entirely in-browser via
// basic signal processing - no external hotlink URLs involved at all. This
// exists because Pixabay (and most audio hosts) don't expose stable,
// crawlable direct-download links without an authenticated API call, which
// is why hotlinked ambient preset URLs kept failing. A synthesized buffer
// has zero network dependency and can never 404 or go dead.
//
// Each profile shapes plain white noise with a simple one-pole filter
// (low-pass for a soft "murmur"/rain-like texture, high-pass for a hissier
// texture) plus, for some profiles, sparse randomized short bursts layered
// on top for a bit of organic texture (raindrop-like ticks, distant
// chirps/chatter) - not a photorealistic field recording, but a real,
// pleasant, on-theme loop that is 100% reliable.
const SAMPLE_RATE = 22050;
const DURATION_SECONDS = 30;

const randRange = (min, max) => min + Math.random() * (max - min);

// One-pole low-pass: y[n] = y[n-1] + alpha * (x[n] - y[n-1]) - smooths/dulls
// the noise, giving a warmer, murmur-like texture instead of a harsh hiss.
const lowPass = (samples, alpha) => {
    let prev = 0;
    const out = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
        prev = prev + alpha * (samples[i] - prev);
        out[i] = prev;
    }
    return out;
};

// One-pole high-pass (complement of the low-pass above) - brightens/thins
// the noise for a crisper, airier texture.
const highPass = (samples, alpha) => {
    const low = lowPass(samples, alpha);
    const out = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) out[i] = samples[i] - low[i];
    return out;
};

const generateWhiteNoise = (length) => {
    const out = new Float32Array(length);
    for (let i = 0; i < length; i++) out[i] = randRange(-1, 1);
    return out;
};

// Layers sparse short bursts (amplitude envelopes) onto a base signal at
// randomized intervals - used for raindrop ticks, distant bird chirps, or
// soft murmur bursts depending on the profile.
const addBursts = (base, sampleRate, { minGapSec, maxGapSec, burstMs, burstAmp, tone }) => {
    const out = Float32Array.from(base);
    let pos = 0;
    while (pos < out.length) {
        pos += Math.floor(randRange(minGapSec, maxGapSec) * sampleRate);
        const burstLen = Math.floor((burstMs / 1000) * sampleRate);
        for (let i = 0; i < burstLen && pos + i < out.length; i++) {
            const envelope = Math.sin((Math.PI * i) / burstLen); // smooth in/out, no clicks
            const sample = tone
                ? Math.sin((2 * Math.PI * tone * i) / sampleRate) * envelope * burstAmp
                : (Math.random() * 2 - 1) * envelope * burstAmp;
            out[pos + i] += sample;
        }
    }
    return out;
};

const normalize = (samples) => {
    let max = 0;
    for (let i = 0; i < samples.length; i++) max = Math.max(max, Math.abs(samples[i]));
    if (max < 0.0001) return samples;
    const scale = 0.85 / max;
    const out = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) out[i] = samples[i] * scale;
    return out;
};

const PROFILES = {
    rain: () => {
        const length = SAMPLE_RATE * DURATION_SECONDS;
        let signal = highPass(generateWhiteNoise(length), 0.35);
        signal = addBursts(signal, SAMPLE_RATE, { minGapSec: 0.02, maxGapSec: 0.12, burstMs: 12, burstAmp: 0.5 });
        return normalize(signal);
    },
    forest: () => {
        const length = SAMPLE_RATE * DURATION_SECONDS;
        let signal = lowPass(generateWhiteNoise(length), 0.05); // soft wind bed
        signal = addBursts(signal, SAMPLE_RATE, { minGapSec: 1.5, maxGapSec: 5, burstMs: 90, burstAmp: 0.3, tone: 2200 });
        signal = addBursts(signal, SAMPLE_RATE, { minGapSec: 2, maxGapSec: 6, burstMs: 140, burstAmp: 0.22, tone: 3100 });
        return normalize(signal);
    },
    coffeeShop: () => {
        const length = SAMPLE_RATE * DURATION_SECONDS;
        let signal = lowPass(generateWhiteNoise(length), 0.02); // warm murmur bed
        signal = addBursts(signal, SAMPLE_RATE, { minGapSec: 0.8, maxGapSec: 2.5, burstMs: 220, burstAmp: 0.18 });
        signal = addBursts(signal, SAMPLE_RATE, { minGapSec: 3, maxGapSec: 8, burstMs: 60, burstAmp: 0.28, tone: 1800 });
        return normalize(signal);
    },
    whiteNoise: () => normalize(generateWhiteNoise(SAMPLE_RATE * DURATION_SECONDS)),
};

const encodeWavBlob = (samples, sampleRate) => {
    const numSamples = samples.length;
    const bytesPerSample = 2;
    const blockAlign = bytesPerSample; // mono
    const byteRate = sampleRate * blockAlign;
    const dataSize = numSamples * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset, str) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM fmt chunk size
    view.setUint16(20, 1, true); // audio format = PCM
    view.setUint16(22, 1, true); // channels = mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
        const clamped = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
        offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
};

// Memoized per profile - generating a 30s buffer is cheap but there's no
// reason to redo it every time the same preset is clicked twice in a
// session.
const cache = {};

export const getSynthPresetUrl = (profileKey) => {
    if (cache[profileKey]) return cache[profileKey];
    const generator = PROFILES[profileKey];
    if (!generator) return null;
    const samples = generator();
    const blob = encodeWavBlob(samples, SAMPLE_RATE);
    const url = URL.createObjectURL(blob);
    cache[profileKey] = url;
    return url;
};

// UI feedback and task-alert one-shots - short (well under a second),
// identical-each-time sounds, so unlike thunder these ARE cached/reused,
// the same way the ambient presets above are. A tiny sine "tick" with a
// fast exponential decay for UI feedback (a click/toggle should feel
// instant and unobtrusive); a brighter two-note chime for task alerts
// (something worth actually noticing, but still short and pleasant, not
// jarring).
const UI_SOUND_SAMPLE_RATE = 22050;
const uiSoundCache = {};

const synthTone = (freq, durationSec, decayRate, amp, sampleRate) => {
    const length = Math.floor(sampleRate * durationSec);
    const out = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        out[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * decayRate) * amp;
    }
    return out;
};

const mixInto = (target, source, offsetSamples = 0) => {
    for (let i = 0; i < source.length && offsetSamples + i < target.length; i++) {
        target[offsetSamples + i] += source[i];
    }
};

export const getUiClickUrl = () => {
    if (uiSoundCache.uiClick) return uiSoundCache.uiClick;
    const tone = normalize(synthTone(920, 0.07, 55, 0.9, UI_SOUND_SAMPLE_RATE));
    const blob = encodeWavBlob(tone, UI_SOUND_SAMPLE_RATE);
    uiSoundCache.uiClick = URL.createObjectURL(blob);
    return uiSoundCache.uiClick;
};

export const getTaskAlertUrl = () => {
    if (uiSoundCache.taskAlert) return uiSoundCache.taskAlert;
    const totalLength = Math.floor(UI_SOUND_SAMPLE_RATE * 0.5);
    const out = new Float32Array(totalLength);
    mixInto(out, synthTone(660, 0.22, 9, 0.55, UI_SOUND_SAMPLE_RATE), 0);
    mixInto(out, synthTone(990, 0.3, 7, 0.5, UI_SOUND_SAMPLE_RATE), Math.floor(UI_SOUND_SAMPLE_RATE * 0.09));
    const blob = encodeWavBlob(normalize(out), UI_SOUND_SAMPLE_RATE);
    uiSoundCache.taskAlert = URL.createObjectURL(blob);
    return uiSoundCache.taskAlert;
};
