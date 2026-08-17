// src/components/WeatherAnimatedSky.jsx
//
// A compact, self-contained animated condition visualization scoped to the
// Weather Hub's own hero card (absolutely fills its parent) - deliberately
// separate from DynamicBackground.jsx, which is the full-viewport "Dynamic"
// theme background and was explicitly made weather-independent (time-of-day
// only) in an earlier pass. This component is the opposite: driven by the
// real, live weatherState from WeatherContext (rain drops, thunderstorm
// flashes, drifting clouds) plus real local time for sun/moon/stars, but
// scoped to one card instead of the whole app shell.
import { useMemo } from 'react';

const STAR_COUNT = 26;
const CLOUD_COUNT = 5;
const RAIN_STREAK_COUNT = 28;

const generateStars = () =>
    Array.from({ length: STAR_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 70,
        size: 1 + Math.random() * 1.8,
        delay: Math.random() * 4,
        duration: 1.8 + Math.random() * 2.6,
    }));

const generateClouds = () =>
    Array.from({ length: CLOUD_COUNT }, (_, i) => ({
        id: i,
        top: 8 + Math.random() * 38,
        width: 34 + Math.random() * 22,
        duration: 40 + Math.random() * 30,
        delay: -Math.random() * 60,
    }));

const generateRainStreaks = () =>
    Array.from({ length: RAIN_STREAK_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        duration: 0.5 + Math.random() * 0.4,
        delay: Math.random() * 1,
        height: 14 + Math.random() * 12,
    }));

const WeatherAnimatedSky = ({ weatherState = 'clear', isNight = false }) => {
    const stars = useMemo(generateStars, []);
    const clouds = useMemo(generateClouds, []);
    const rainStreaks = useMemo(generateRainStreaks, []);

    const showRain = weatherState === 'rain' || weatherState === 'drizzle' || weatherState === 'thunderstorm';
    const showClouds = weatherState === 'cloudy' || weatherState === 'rain' || weatherState === 'drizzle' || weatherState === 'thunderstorm';
    const showSun = weatherState === 'clear' && !isNight;
    const showMoon = weatherState === 'clear' && isNight;
    const showThunder = weatherState === 'thunderstorm';

    const skyGradient = isNight || showRain
        ? 'linear-gradient(to top, #0f1428, #1a2140, #232c52)'
        : weatherState === 'cloudy'
            ? 'linear-gradient(to top, #4b5875, #6b7a99, #8b9bb8)'
            : 'linear-gradient(to top, #2e6da4, #4a90c9, #7fb8e8)';

    return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: skyGradient, transition: 'background 1s ease' }}>
            {/* Stars - night only, any condition */}
            {isNight && stars.map((s) => (
                <div key={s.id} style={{
                    position: 'absolute', left: `${s.left}%`, top: `${s.top}%`,
                    width: `${s.size}px`, height: `${s.size}px`, borderRadius: '50%', background: '#fff',
                    animation: `weatherTwinkle ${s.duration}s ease-in-out ${s.delay}s infinite alternate`,
                }} />
            ))}

            {/* Sun / Moon disc */}
            {(showSun || showMoon) && (
                <div style={{
                    position: 'absolute', top: '18%', right: '14%',
                    width: '56px', height: '56px', borderRadius: '50%',
                    background: showSun
                        ? 'radial-gradient(circle, #fffdf5 0%, #fde68a 45%, #f59e0b 100%)'
                        : 'radial-gradient(circle, #f8fafc 0%, #dde3ee 55%, #b6c0d4 100%)',
                    boxShadow: showSun ? '0 0 34px rgba(251, 191, 36, 0.55)' : '0 0 22px rgba(226, 232, 240, 0.4)',
                    animation: 'weatherPulseGlow 4s ease-in-out infinite alternate',
                }} />
            )}

            {/* Clouds - simple drifting soft blobs, lighter-weight than
                DynamicBackground's own (this is a small card, not a full
                sky), but still built from a few overlapping puffs so they
                read as real cloud shapes rather than plain ellipses. */}
            {showClouds && clouds.map((c) => (
                <div key={c.id} style={{
                    position: 'absolute', top: `${c.top}%`, left: '-40%',
                    width: `${c.width}%`, height: `${c.width * 0.34}%`,
                    animation: `weatherCloudDrift ${c.duration}s linear ${c.delay}s infinite`,
                }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: isNight ? 'rgba(148, 163, 184, 0.35)' : 'rgba(255,255,255,0.5)' }} />
                    <div style={{ position: 'absolute', left: '18%', top: '-35%', width: '55%', height: '90%', borderRadius: '50%', background: isNight ? 'rgba(148, 163, 184, 0.3)' : 'rgba(255,255,255,0.42)' }} />
                    <div style={{ position: 'absolute', left: '50%', top: '-15%', width: '45%', height: '85%', borderRadius: '50%', background: isNight ? 'rgba(148, 163, 184, 0.28)' : 'rgba(255,255,255,0.38)' }} />
                </div>
            ))}

            {/* Rain streaks - straight diagonal drops looping downward */}
            {showRain && rainStreaks.map((r) => (
                <div key={r.id} style={{
                    position: 'absolute', left: `${r.left}%`, top: '-10%',
                    width: '2px', height: `${r.height}px`, borderRadius: '2px',
                    background: 'linear-gradient(to bottom, rgba(191, 219, 254, 0), rgba(191, 219, 254, 0.65))',
                    transform: 'rotate(12deg)',
                    animation: `weatherRainFall ${r.duration}s linear ${r.delay}s infinite`,
                }} />
            ))}

            {/* Thunderstorm flash - a randomized brief white flash overlay */}
            {showThunder && (
                <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: 0, animation: 'weatherLightningFlash 6s ease-in-out infinite' }} />
            )}

            <style>
                {`
                @keyframes weatherTwinkle { 0% { opacity: 0.3; } 100% { opacity: 1; } }
                @keyframes weatherPulseGlow { 0% { transform: scale(1); } 100% { transform: scale(1.06); } }
                @keyframes weatherCloudDrift { 0% { left: -40%; } 100% { left: 130%; } }
                @keyframes weatherRainFall { 0% { transform: translateY(0) rotate(12deg); opacity: 0; } 10% { opacity: 1; } 100% { transform: translateY(340%) rotate(12deg); opacity: 0.2; } }
                @keyframes weatherLightningFlash {
                    0%, 91%, 100% { opacity: 0; }
                    92% { opacity: 0.55; }
                    93% { opacity: 0.05; }
                    94% { opacity: 0.4; }
                    95% { opacity: 0; }
                }
                `}
            </style>
        </div>
    );
};

export default WeatherAnimatedSky;
