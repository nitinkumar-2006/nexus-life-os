// src/components/ParametricWallpaper.jsx
//
// Generic renderer for the 130+ expansion themes in wallpaperThemeConfigs.js
// (the original 23 hand-written wallpapers in AlternateBackgrounds.jsx stay
// exactly as they are - untouched, unaffected). Rather than hand-writing 130
// more bespoke one-off components, each new theme is a small config object
// (base gradient + 1-2 glow colors/positions + one named effect layer) and
// this single component composes them - the real per-theme distinctiveness
// comes from color/position/effect-choice data, not from unique code per
// theme. Same fixed/full-viewport/pointer-events:none structural pattern as
// every existing background layer.
import { useMemo } from 'react';

const hashId = (id) => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
    return h;
};

// No filter:blur here - a real, reported bug traced back to exactly
// this: DynamicBackground.jsx's own sun/moon glow (the default theme)
// gets its soft falloff purely from a multi-stop radial-gradient with
// zero filter:blur anywhere, and reads perfectly crisp at any Blur
// Intensity/Transparency setting. Every custom wallpaper's own glow
// orb used a real filter:blur(46px) instead, which bakes actual
// blurred pixels into the wallpaper layer itself - completely
// independent of the Glassmorphism Blur Intensity slider, since that
// slider only ever controls each glass CARD's own backdrop-filter, not
// what the wallpaper behind it already rendered. At low Transparency/
// Opacity, cards are see-through enough that this pre-blurred glow
// visibly bled through as "blurry, shimmery text" everywhere on
// screen. Matching DynamicBackground's own proven technique - more
// gradient stops instead of a pixel blur - fixes this at the one
// shared component every parametric wallpaper (130+ themes) renders
// through.
const GlowOrbs = ({ glow }) => (
    <>
        {glow.map(([rgb, top, left, size], i) => (
            <div key={i} style={{
                position: 'absolute', top, left, width: `${size}px`, height: `${size}px`,
                marginTop: `${-size / 2}px`, marginLeft: `${-size / 2}px`, borderRadius: '50%',
                background: `radial-gradient(circle, rgba(${rgb},0.55) 0%, rgba(${rgb},0.38) 22%, rgba(${rgb},0.22) 42%, rgba(${rgb},0.1) 60%, rgba(${rgb},0.03) 78%, transparent 100%)`,
                animation: `nexusParaGlow ${5 + i * 1.4}s ease-in-out infinite`,
                animationDelay: `${i * 0.8}s`,
            }} />
        ))}
    </>
);

const Starfield = ({ seed }) => {
    const stars = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
        left: `${((i * 37.3) + (seed % 50)) % 100}%`,
        top: `${((i * 53.7) + (seed % 37)) % 100}%`,
        size: 1 + (i % 3),
        delay: `${(i % 10) * 0.4}s`,
        duration: `${3 + (i % 4)}s`,
    })), [seed]);
    return stars.map((s, i) => (
        <div key={i} style={{
            position: 'absolute', left: s.left, top: s.top, width: `${s.size}px`, height: `${s.size}px`,
            borderRadius: '50%', background: '#fff',
            animation: `nexusParaTwinkle ${s.duration} ease-in-out infinite`, animationDelay: s.delay,
        }} />
    ));
};

const Particles = ({ seed, glow }) => {
    const color = glow?.[0]?.[0] || '255,255,255';
    const dots = useMemo(() => Array.from({ length: 26 }, (_, i) => ({
        left: `${((i * 41.9) + (seed % 40)) % 100}%`,
        top: `${((i * 29.1) + (seed % 33)) % 100}%`,
        size: 2 + (i % 3),
        duration: `${8 + (i % 6)}s`,
        delay: `${(i % 7) * 0.6}s`,
    })), [seed]);
    return dots.map((d, i) => (
        <div key={i} style={{
            position: 'absolute', left: d.left, top: d.top, width: `${d.size}px`, height: `${d.size}px`,
            borderRadius: '50%', background: `rgba(${color},0.55)`,
            animation: `nexusParaFloat ${d.duration} ease-in-out infinite`, animationDelay: d.delay,
        }} />
    ));
};

const GridLines = ({ glow }) => {
    const color = glow?.[0]?.[0] || '148,163,184';
    return (
        <>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(${color},0.18) 1px, transparent 1px)`, backgroundSize: '100% 46px', animation: 'nexusParaGridDrift 6s linear infinite' }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(90deg, rgba(${color},0.14) 1px, transparent 1px)`, backgroundSize: '46px 100%' }} />
        </>
    );
};

const Streaks = ({ seed, glow }) => {
    const color = glow?.[0]?.[0] || '255,255,255';
    const streaks = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
        left: `${((i * 41.7) + (seed % 43)) % 100}%`,
        top: `${((i * 29.3) + (seed % 31)) % 100}%`,
        rotate: (i * 37 + seed) % 360,
        duration: `${2.5 + (i % 4)}s`,
        delay: `${(i % 6) * 0.5}s`,
    })), [seed]);
    return streaks.map((s, i) => (
        <div key={i} style={{
            position: 'absolute', left: s.left, top: s.top, width: '80px', height: '2px',
            background: `linear-gradient(90deg, transparent, rgba(${color},0.85), transparent)`,
            transform: `rotate(${s.rotate}deg)`,
            animation: `nexusParaStreak ${s.duration} ease-in-out infinite`, animationDelay: s.delay,
        }} />
    ));
};

const Rings = ({ glow }) => {
    const color = glow?.[0]?.[0] || '167,139,250';
    return (
        <>
            <div style={{ position: 'absolute', top: '50%', left: '50%', width: '480px', height: '480px', marginTop: '-240px', marginLeft: '-240px', borderRadius: '50%', border: `1px solid rgba(${color},0.22)`, animation: 'nexusParaOrbit 46s linear infinite' }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', width: '320px', height: '320px', marginTop: '-160px', marginLeft: '-160px', borderRadius: '50%', border: `1px solid rgba(${color},0.28)`, animation: 'nexusParaOrbit 30s linear infinite reverse' }} />
        </>
    );
};

// Glowing edge/border ring - the "vivid glowing borders instead of dull
// flat fills" premium-glass look. An inset box-shadow hugging the
// viewport edges rather than a corner-positioned orb, so it reads as a
// frame around the whole sky instead of another glow blob.
const VignetteGlow = ({ glow }) => {
    const color = glow?.[0]?.[0] || '167,139,250';
    return (
        <div style={{
            position: 'absolute', inset: 0,
            boxShadow: `inset 0 0 70px 8px rgba(${color},0.4), inset 0 0 180px 50px rgba(${color},0.22)`,
            animation: 'nexusParaVignette 6s ease-in-out infinite',
        }} />
    );
};

const Sheen = () => (
    <div style={{
        position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%',
        background: 'linear-gradient(100deg, transparent 40%, rgba(255,255,255,0.05) 48%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.05) 52%, transparent 60%)',
        animation: 'nexusParaSheen 22s ease-in-out infinite alternate',
    }} />
);

const ScanLine = ({ glow }) => {
    const color = glow?.[0]?.[0] || '56,189,248';
    return (
        <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `linear-gradient(180deg, transparent 0%, rgba(${color},0.16) 50%, transparent 100%)`,
            backgroundSize: '100% 220%',
            animation: 'nexusParaScan 7s linear infinite',
        }} />
    );
};

const MatrixRain = ({ seed, glow }) => {
    const color = glow?.[0]?.[0] || '34,211,94';
    const columns = useMemo(() => Array.from({ length: 30 }, (_, i) => ({
        left: `${(i / 30) * 100}%`,
        duration: `${4 + ((i + seed) % 6)}s`,
        delay: `${((i + seed) % 8) * -0.7}s`,
        opacity: 0.2 + (((i + seed) % 5) * 0.09),
    })), [seed]);
    return columns.map((c, i) => (
        <div key={i} style={{
            position: 'absolute', top: 0, left: c.left, width: '2px', height: '160%',
            background: `linear-gradient(180deg, transparent 0%, rgba(${color},0.85) 45%, transparent 100%)`,
            opacity: c.opacity,
            animation: `nexusParaFall ${c.duration} linear infinite`, animationDelay: c.delay,
        }} />
    ));
};

const EFFECT_COMPONENTS = {
    stars: Starfield,
    particles: Particles,
    grid: GridLines,
    streaks: Streaks,
    rings: Rings,
    sheen: Sheen,
    scan: ScanLine,
    matrix: MatrixRain,
    vignette: VignetteGlow,
};

const ParametricWallpaper = ({ config }) => {
    const seed = useMemo(() => hashId(config.id), [config.id]);
    const { base, glow = [], fx } = config;
    const gradient = `linear-gradient(${base.a}deg, ${base.s.join(', ')})`;
    const EffectComponent = fx && fx !== 'none' ? EFFECT_COMPONENTS[fx] : null;

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <style>{`
                @keyframes nexusParaGlow { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 0.9; transform: scale(1.1); } }
                @keyframes nexusParaTwinkle { 0%, 100% { opacity: 0.15; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.15); } }
                @keyframes nexusParaFloat { 0%, 100% { transform: translate(0, 0); opacity: 0.35; } 50% { transform: translate(6px, -14px); opacity: 0.8; } }
                @keyframes nexusParaGridDrift { 0% { background-position: 0 0; } 100% { background-position: 0 46px; } }
                @keyframes nexusParaStreak { 0%, 100% { opacity: 0; } 45% { opacity: 0; } 50% { opacity: 0.85; } 55% { opacity: 0; } }
                @keyframes nexusParaOrbit { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes nexusParaSheen { 0% { transform: translateX(-30%) translateY(-30%) rotate(20deg); } 100% { transform: translateX(30%) translateY(30%) rotate(20deg); } }
                @keyframes nexusParaScan { 0% { background-position: 0 -120%; } 100% { background-position: 0 120%; } }
                @keyframes nexusParaFall { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
                @keyframes nexusParaVignette { 0%, 100% { opacity: 0.65; } 50% { opacity: 1; } }
                @keyframes nexusParaShift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
            `}</style>
            {/* animated:true bases use a 4-stop gradient at 300% size with a
                shifting background-position - the "shifting colorstops"
                premium look, distinct from every static-gradient theme
                below it. */}
            {/* backgroundImage (longhand), not the background shorthand -
                this div conditionally also sets backgroundSize below, and
                mixing the shorthand with a longhand sub-property in the
                same style object is a real, documented React footgun
                (the shorthand silently resets background-size as part of
                applying itself, racing the explicit value here) - this is
                the fix for exactly that warning, not just a lint nit. */}
            <div style={{
                position: 'absolute', inset: 0, backgroundImage: gradient,
                ...(base.animated ? { backgroundSize: '300% 300%', animation: 'nexusParaShift 16s ease infinite' } : {}),
            }} />
            <GlowOrbs glow={glow} />
            {EffectComponent && <EffectComponent seed={seed} glow={glow} />}
        </div>
    );
};

export default ParametricWallpaper;
