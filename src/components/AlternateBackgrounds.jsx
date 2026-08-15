// src/components/AlternateBackgrounds.jsx
//
// The 23 non-default wallpaper options for Custom Background / Wallpaper
// Selector (Cyberpunk Neon, Deep Space, Minimalist Aurora, Matrix Grid,
// Quantum Void, Solar Flare, Obsidian Glass, Neon Sunset, Electric Indigo,
// Cyber Matrix, Supernova Red, Eclipse Shadow, Astral Purple, Cyber Grid,
// Neon Genesis, Void Blue, Crimson Flux, Emerald Matrix, Solar Horizon,
// Frost Amber, Stellar Nebula, Abyssal Dark, Prism Glass). "Animated Sky"
// (the default/24th option) is DynamicBackground.jsx itself, unrelated to
// this file - this component only ever renders when the user has
// explicitly picked one of these 23.
//
// Rendered as a fixed, full-viewport, pointer-events:none layer - the
// exact same structural pattern DynamicBackground.jsx uses (a sibling of
// .nexus-app-shell, not a descendant), so the existing motion-off/
// battery-saver CSS scoping around that structural fact stays correct
// without any special-casing for this new component.
import React, { useMemo } from 'react';
import { WALLPAPER_OPTIONS } from '../constants/wallpaperOptions.js';

const STAR_COUNT = 90;
const MATRIX_COLUMN_COUNT = 34;

const CyberpunkNeon = () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <style>{`
            @keyframes nexusNeonPulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.75; } }
            @keyframes nexusNeonDrift { 0% { background-position: 0 0; } 100% { background-position: 60px 60px; } }
        `}</style>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #0D0221 0%, #1A0533 45%, #240046 100%)' }} />
        {/* Perspective neon grid floor */}
        <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(rgba(255, 0, 200, 0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 234, 255, 0.25) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            animation: 'nexusNeonDrift 12s linear infinite',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 100%, black 40%, transparent 90%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 100%, black 40%, transparent 90%)',
        }} />
        {/* Two large, soft neon glows */}
        <div style={{ position: 'absolute', top: '10%', left: '15%', width: '420px', height: '420px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,0,200,0.5) 0%, transparent 70%)', filter: 'blur(40px)', animation: 'nexusNeonPulse 5s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '5%', right: '10%', width: '460px', height: '460px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,234,255,0.45) 0%, transparent 70%)', filter: 'blur(44px)', animation: 'nexusNeonPulse 6.5s ease-in-out infinite 1.2s' }} />
    </div>
);

const DeepSpace = () => {
    // Deterministic star field - stable across re-renders without a
    // random re-roll on every parent update.
    const stars = useMemo(() => Array.from({ length: STAR_COUNT }, (_, i) => ({
        left: `${(i * 37.3) % 100}%`,
        top: `${(i * 53.7) % 100}%`,
        size: 1 + (i % 3),
        delay: `${(i % 10) * 0.4}s`,
        duration: `${3 + (i % 4)}s`,
    })), []);
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <style>{`
                @keyframes nexusStarTwinkle { 0%, 100% { opacity: 0.15; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.15); } }
                @keyframes nexusNebulaDrift { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(30px, -20px) scale(1.08); } }
            `}</style>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, #0B1026 0%, #030308 75%)' }} />
            <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '60%', height: '60%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 70%)', filter: 'blur(60px)', animation: 'nexusNebulaDrift 40s ease-in-out infinite alternate' }} />
            <div style={{ position: 'absolute', bottom: '-15%', right: '-5%', width: '55%', height: '55%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)', filter: 'blur(60px)', animation: 'nexusNebulaDrift 50s ease-in-out infinite alternate-reverse' }} />
            {stars.map((s, i) => (
                <div key={i} style={{
                    position: 'absolute', left: s.left, top: s.top, width: `${s.size}px`, height: `${s.size}px`,
                    borderRadius: '50%', background: '#fff',
                    animation: `nexusStarTwinkle ${s.duration} ease-in-out infinite`, animationDelay: s.delay,
                }} />
            ))}
        </div>
    );
};

const MinimalistAurora = () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <style>{`
            @keyframes nexusAuroraFlow1 { 0%, 100% { transform: translate(-5%, -5%) rotate(0deg); } 50% { transform: translate(8%, 5%) rotate(8deg); } }
            @keyframes nexusAuroraFlow2 { 0%, 100% { transform: translate(5%, 8%) rotate(0deg); } 50% { transform: translate(-8%, -3%) rotate(-6deg); } }
        `}</style>
        <div style={{ position: 'absolute', inset: 0, background: '#0F1115' }} />
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '80%', height: '70%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(167,139,250,0.20) 0%, transparent 65%)', filter: 'blur(70px)', animation: 'nexusAuroraFlow1 22s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: '75%', height: '65%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(52,211,153,0.16) 0%, transparent 65%)', filter: 'blur(70px)', animation: 'nexusAuroraFlow2 26s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '30%', right: '15%', width: '55%', height: '50%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(56,189,248,0.14) 0%, transparent 65%)', filter: 'blur(70px)', animation: 'nexusAuroraFlow1 30s ease-in-out infinite reverse' }} />
    </div>
);

const MatrixGrid = () => {
    // Deterministic column layout - stable across re-renders.
    const columns = useMemo(() => Array.from({ length: MATRIX_COLUMN_COUNT }, (_, i) => ({
        left: `${(i / MATRIX_COLUMN_COUNT) * 100}%`,
        duration: `${4 + (i % 6)}s`,
        delay: `${(i % 8) * -0.7}s`,
        opacity: 0.25 + ((i % 5) * 0.1),
    })), []);
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <style>{`
                @keyframes nexusMatrixFall { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
            `}</style>
            <div style={{ position: 'absolute', inset: 0, background: '#020402' }} />
            {columns.map((c, i) => (
                <div key={i} style={{
                    position: 'absolute', top: 0, left: c.left, width: '2px', height: '160%',
                    background: 'linear-gradient(180deg, transparent 0%, rgba(34,211,94,0.9) 45%, rgba(163,230,53,0.5) 55%, transparent 100%)',
                    opacity: c.opacity,
                    animation: `nexusMatrixFall ${c.duration} linear infinite`, animationDelay: c.delay,
                }} />
            ))}
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, #020402 95%)' }} />
        </div>
    );
};

const QuantumVoid = () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <style>{`
            @keyframes nexusVoidOrbit { 0% { transform: rotate(0deg) scale(1); } 50% { transform: rotate(180deg) scale(1.06); } 100% { transform: rotate(360deg) scale(1); } }
            @keyframes nexusVoidPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.9; } }
        `}</style>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, #1A0B2E 0%, #06010F 80%)' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '520px', height: '520px', marginTop: '-260px', marginLeft: '-260px', borderRadius: '50%', border: '1px solid rgba(167,139,250,0.25)', animation: 'nexusVoidOrbit 50s linear infinite' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '360px', height: '360px', marginTop: '-180px', marginLeft: '-180px', borderRadius: '50%', border: '1px solid rgba(129,140,248,0.3)', animation: 'nexusVoidOrbit 34s linear infinite reverse' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '180px', height: '180px', marginTop: '-90px', marginLeft: '-90px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.5) 0%, transparent 70%)', filter: 'blur(30px)', animation: 'nexusVoidPulse 6s ease-in-out infinite' }} />
    </div>
);

const SolarFlare = () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <style>{`
            @keyframes nexusFlareRadiate { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.18); opacity: 0.95; } }
            @keyframes nexusFlareShimmer { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.55; } }
        `}</style>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 60%, #2B0A00 0%, #140300 80%)' }} />
        <div style={{ position: 'absolute', top: '55%', left: '50%', width: '420px', height: '420px', marginTop: '-210px', marginLeft: '-210px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,107,0,0.55) 0%, transparent 65%)', filter: 'blur(50px)', animation: 'nexusFlareRadiate 5s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '55%', left: '50%', width: '220px', height: '220px', marginTop: '-110px', marginLeft: '-110px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,213,0,0.6) 0%, transparent 60%)', filter: 'blur(30px)', animation: 'nexusFlareRadiate 5s ease-in-out infinite 0.6s' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 60%, rgba(255,150,0,0.12) 0%, transparent 60%)', animation: 'nexusFlareShimmer 3.5s ease-in-out infinite' }} />
    </div>
);

const ObsidianGlass = () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <style>{`
            @keyframes nexusObsidianSheen { 0% { transform: translateX(-30%) translateY(-30%) rotate(20deg); } 100% { transform: translateX(30%) translateY(30%) rotate(20deg); } }
        `}</style>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0A0A0C 0%, #1C1C22 50%, #2E2E38 100%)' }} />
        <div style={{
            position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%',
            background: 'linear-gradient(100deg, transparent 40%, rgba(255,255,255,0.05) 48%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.05) 52%, transparent 60%)',
            animation: 'nexusObsidianSheen 24s ease-in-out infinite alternate',
        }} />
    </div>
);

const NeonSunset = () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <style>{`
            @keyframes nexusSunsetShift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
            @keyframes nexusSunsetGlow { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        `}</style>
        <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(120deg, #1A0429, #FF2E92, #FF7A00, #1A0429)',
            backgroundSize: '300% 300%',
            animation: 'nexusSunsetShift 18s ease-in-out infinite',
        }} />
        <div style={{ position: 'absolute', bottom: '-10%', left: '50%', width: '70%', height: '50%', marginLeft: '-35%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(255,122,0,0.5) 0%, transparent 70%)', filter: 'blur(50px)', animation: 'nexusSunsetGlow 5s ease-in-out infinite' }} />
    </div>
);

const ElectricIndigo = () => {
    const STREAK_COUNT = 16;
    const streaks = useMemo(() => Array.from({ length: STREAK_COUNT }, (_, i) => ({
        left: `${(i * 41.7) % 100}%`,
        top: `${(i * 29.3) % 100}%`,
        rotate: (i * 37) % 360,
        duration: `${2.5 + (i % 4)}s`,
        delay: `${(i % 6) * 0.5}s`,
    })), []);
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <style>{`
                @keyframes nexusIndigoStreak { 0%, 100% { opacity: 0; } 45% { opacity: 0; } 50% { opacity: 0.85; } 55% { opacity: 0; } }
            `}</style>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, #4C1D95 0%, #05010F 75%)' }} />
            {streaks.map((s, i) => (
                <div key={i} style={{
                    position: 'absolute', left: s.left, top: s.top, width: '90px', height: '2px',
                    background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.9), transparent)',
                    transform: `rotate(${s.rotate}deg)`,
                    animation: `nexusIndigoStreak ${s.duration} ease-in-out infinite`, animationDelay: s.delay,
                }} />
            ))}
        </div>
    );
};

const CyberMatrix = () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <style>{`@keyframes nexusCyberPulse { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.55; } }`}</style>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #001414 0%, #0D3B3B 60%, #001414 100%)' }} />
        <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'repeating-linear-gradient(60deg, rgba(20,184,166,0.18) 0px, rgba(20,184,166,0.18) 1px, transparent 1px, transparent 42px), repeating-linear-gradient(-60deg, rgba(20,184,166,0.12) 0px, rgba(20,184,166,0.12) 1px, transparent 1px, transparent 42px)',
            animation: 'nexusCyberPulse 4s ease-in-out infinite',
        }} />
    </div>
);

const SupernovaRed = () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <style>{`@keyframes nexusSupernovaPulse { 0%, 100% { transform: scale(1); opacity: 0.55; } 50% { transform: scale(1.25); opacity: 0.85; } }`}</style>
        <div style={{ position: 'absolute', inset: 0, background: '#180000' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '520px', height: '520px', marginLeft: '-260px', marginTop: '-260px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(252,165,165,0.9) 0%, rgba(185,28,28,0.55) 35%, transparent 70%)', filter: 'blur(30px)', animation: 'nexusSupernovaPulse 6s ease-in-out infinite' }} />
    </div>
);

const EclipseShadow = () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <style>{`@keyframes nexusEclipseRotate { 0% { transform: translate(-50%, -50%) rotate(0deg); } 100% { transform: translate(-50%, -50%) rotate(360deg); } }`}</style>
        <div style={{ position: 'absolute', inset: 0, background: '#050403' }} />
        <div style={{ position: 'absolute', top: '45%', left: '50%', width: '340px', height: '340px', borderRadius: '50%', background: 'radial-gradient(circle, #000 0%, #000 55%, rgba(245,158,11,0.7) 58%, transparent 62%)', boxShadow: '0 0 90px 20px rgba(245,158,11,0.25)', transform: 'translate(-50%, -50%)', animation: 'nexusEclipseRotate 60s linear infinite' }} />
    </div>
);

const AstralPurple = () => {
    const stars = useMemo(() => Array.from({ length: 70 }, (_, i) => ({ left: `${(i * 41.1) % 100}%`, top: `${(i * 59.3) % 100}%`, size: 1 + (i % 3), delay: `${(i % 8) * 0.5}s` })), []);
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <style>{`@keyframes nexusAstralTwinkle { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }`}</style>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, #2E1065 0%, #0B0118 75%)' }} />
            {stars.map((s, i) => (
                <div key={i} style={{ position: 'absolute', left: s.left, top: s.top, width: `${s.size}px`, height: `${s.size}px`, borderRadius: '50%', background: '#C4B5FD', animation: `nexusAstralTwinkle ${2 + (i % 3)}s ease-in-out infinite`, animationDelay: s.delay }} />
            ))}
        </div>
    );
};

const CyberGrid = () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <style>{`@keyframes nexusCyberGridDrift { 0% { background-position: 0 0; } 100% { background-position: 0 48px; } }`}</style>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #001220 0%, #01080F 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(14,165,233,0.22) 1px, transparent 1px)', backgroundSize: '100% 48px', animation: 'nexusCyberGridDrift 5s linear infinite' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(90deg, rgba(14,165,233,0.16) 1px, transparent 1px)', backgroundSize: '48px 100%' }} />
    </div>
);

const NeonGenesis = () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <style>{`@keyframes nexusGenesisFlow { 0%, 100% { transform: translateX(-6%) rotate(0deg); } 50% { transform: translateX(6%) rotate(6deg); } }`}</style>
        <div style={{ position: 'absolute', inset: 0, background: '#052E16' }} />
        <div style={{ position: 'absolute', top: '-15%', left: '-10%', width: '70%', height: '70%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(126,34,206,0.4) 0%, transparent 65%)', filter: 'blur(60px)', animation: 'nexusGenesisFlow 18s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: '70%', height: '70%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(236,72,153,0.4) 0%, transparent 65%)', filter: 'blur(60px)', animation: 'nexusGenesisFlow 22s ease-in-out infinite reverse' }} />
    </div>
);

const VoidBlue = () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <style>{`@keyframes nexusVoidPulse { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.55; transform: scale(1.1); } }`}</style>
        <div style={{ position: 'absolute', inset: 0, background: '#020617' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '380px', height: '380px', marginLeft: '-190px', marginTop: '-190px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.35) 0%, transparent 70%)', filter: 'blur(50px)', animation: 'nexusVoidPulse 8s ease-in-out infinite' }} />
    </div>
);

const CrimsonFlux = () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <style>{`@keyframes nexusFluxWave { 0%, 100% { transform: translate(-4%, -4%); } 50% { transform: translate(4%, 4%); } }`}</style>
        <div style={{ position: 'absolute', inset: 0, background: '#1A0000' }} />
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '90%', height: '80%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(220,38,38,0.35) 0%, transparent 65%)', filter: 'blur(70px)', animation: 'nexusFluxWave 14s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '80%', height: '70%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(127,29,29,0.4) 0%, transparent 65%)', filter: 'blur(70px)', animation: 'nexusFluxWave 18s ease-in-out infinite reverse' }} />
    </div>
);

const EmeraldMatrix = () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <style>{`@keyframes nexusEmeraldPulse { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.5; } }`}</style>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #001A12 0%, #065F46 100%)' }} />
        <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(rgba(16,185,129,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.2) 1px, transparent 1px)',
            backgroundSize: '54px 54px', animation: 'nexusEmeraldPulse 5s ease-in-out infinite',
        }} />
    </div>
);

const SolarHorizon = () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <style>{`@keyframes nexusHorizonGlow { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.85; } }`}</style>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, #7C2D12 0%, #C2410C 35%, #1C1917 100%)' }} />
        <div style={{ position: 'absolute', bottom: '0', left: '50%', width: '600px', height: '300px', marginLeft: '-300px', borderRadius: '50% 50% 0 0', background: 'radial-gradient(ellipse at 50% 100%, rgba(251,146,60,0.6) 0%, transparent 70%)', filter: 'blur(30px)', animation: 'nexusHorizonGlow 7s ease-in-out infinite' }} />
    </div>
);

const FrostAmber = () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <style>{`@keyframes nexusFrostShift { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(3%, -3%); } }`}</style>
        <div style={{ position: 'absolute', inset: 0, background: '#0C1E2E' }} />
        <div style={{ position: 'absolute', top: '-10%', left: '10%', width: '60%', height: '60%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(56,189,248,0.3) 0%, transparent 70%)', filter: 'blur(55px)', animation: 'nexusFrostShift 16s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '5%', width: '45%', height: '45%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,191,36,0.22) 0%, transparent 70%)', filter: 'blur(55px)', animation: 'nexusFrostShift 20s ease-in-out infinite reverse' }} />
    </div>
);

const StellarNebula = () => {
    const stars = useMemo(() => Array.from({ length: 60 }, (_, i) => ({ left: `${(i * 47.7) % 100}%`, top: `${(i * 31.3) % 100}%`, delay: `${(i % 9) * 0.4}s` })), []);
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <style>{`@keyframes nexusNebulaSwirl { 0%, 100% { transform: rotate(0deg) scale(1); } 50% { transform: rotate(8deg) scale(1.08); } } @keyframes nexusNebulaTwinkle { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.9; } }`}</style>
            <div style={{ position: 'absolute', inset: 0, background: '#0B0A1F' }} />
            <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '70%', height: '70%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(190,24,93,0.4) 0%, transparent 65%)', filter: 'blur(65px)', animation: 'nexusNebulaSwirl 25s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '65%', height: '65%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(30,27,75,0.6) 0%, transparent 65%)', filter: 'blur(65px)', animation: 'nexusNebulaSwirl 30s ease-in-out infinite reverse' }} />
            {stars.map((s, i) => (
                <div key={i} style={{ position: 'absolute', left: s.left, top: s.top, width: '2px', height: '2px', borderRadius: '50%', background: '#F9A8D4', animation: `nexusNebulaTwinkle ${2 + (i % 3)}s ease-in-out infinite`, animationDelay: s.delay }} />
            ))}
        </div>
    );
};

const AbyssalDark = () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <style>{`@keyframes nexusAbyssalDrift { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.3; } }`}</style>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #000205 0%, #061018 100%)' }} />
        <div style={{ position: 'absolute', top: '60%', left: '50%', width: '500px', height: '500px', marginLeft: '-250px', marginTop: '-250px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(8,47,73,0.5) 0%, transparent 70%)', filter: 'blur(70px)', animation: 'nexusAbyssalDrift 10s ease-in-out infinite' }} />
    </div>
);

const PrismGlass = () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <style>{`@keyframes nexusPrismShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }`}</style>
        <div style={{ position: 'absolute', inset: 0, background: '#0A0A0F' }} />
        <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(115deg, rgba(244,114,182,0.28), rgba(56,189,248,0.28), rgba(163,230,53,0.22), rgba(251,191,36,0.24))',
            backgroundSize: '300% 300%', animation: 'nexusPrismShift 14s ease infinite',
        }} />
    </div>
);


// Real, validated lookup - cross-references the shared WALLPAPER_OPTIONS
// module (the single source of truth the picker UI also reads from)
// before ever looking up a component, so a wallpaper id that doesn't
// genuinely, currently exist in that shared list is caught here rather
// than silently falling through to a blank background. The component
// map's own keys must still be spelled out by hand (React components
// can't live inside the UI-agnostic, plain-data shared module), but this
// guard is what actually, concretely ties the two together at runtime.
const WALLPAPER_COMPONENTS = {
    cyberpunk: CyberpunkNeon,
    deepspace: DeepSpace,
    aurora: MinimalistAurora,
    matrix: MatrixGrid,
    quantumvoid: QuantumVoid,
    solarflare: SolarFlare,
    obsidianglass: ObsidianGlass,
    neonsunset: NeonSunset,
    electricindigo: ElectricIndigo,
    cybermatrix: CyberMatrix,
    supernovared: SupernovaRed,
    eclipseshadow: EclipseShadow,
    astralpurple: AstralPurple,
    cybergrid: CyberGrid,
    neongenesis: NeonGenesis,
    voidblue: VoidBlue,
    crimsonflux: CrimsonFlux,
    emeraldmatrix: EmeraldMatrix,
    solarhorizon: SolarHorizon,
    frostamber: FrostAmber,
    stellarnebula: StellarNebula,
    abyssaldark: AbyssalDark,
    prismglass: PrismGlass,
};

const KNOWN_WALLPAPER_IDS = new Set(WALLPAPER_OPTIONS.map((wp) => wp.id));

const AlternateBackgrounds = ({ wallpaper }) => {
    // Guards against a wallpaper id that isn't genuinely, currently
    // listed in the shared source of truth (e.g. a stale value left over
    // from a since-removed theme) - falls through to null rather than
    // ever rendering a mismatched or undefined component.
    if (!KNOWN_WALLPAPER_IDS.has(wallpaper)) return null;
    const Component = WALLPAPER_COMPONENTS[wallpaper];
    return Component ? <Component /> : null;
};

export default AlternateBackgrounds;
