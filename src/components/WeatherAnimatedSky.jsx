// src/components/WeatherAnimatedSky.jsx
//
// A self-contained animated condition visualization - deliberately separate
// from DynamicBackground.jsx, which is the full-viewport "Dynamic" theme
// background and was explicitly made weather-independent (time-of-day only)
// in an earlier pass. This component is the opposite: driven by the real,
// live weatherState from WeatherContext (rain drops, thunderstorm flashes,
// drifting clouds, a real moon phase) plus real local time for sun/moon/
// stars.
//
// `fullPage`: used by WeatherPage.jsx to span the ENTIRE Weather Hub (every
// glass card floats over this one continuous sky, Apple-Weather-style)
// instead of just the hero card - same technique, just denser particles and
// a taller-spanning percentage-based layout so it still looks right however
// tall the actual page content ends up being.
import { useMemo } from 'react';
import { MoonPhaseIcon } from './WeatherGauges.jsx';

const generateStars = (count) =>
    Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 60,
        size: 1 + Math.random() * 1.8,
        delay: Math.random() * 4,
        duration: 1.8 + Math.random() * 2.6,
    }));

const generateClouds = (count) =>
    Array.from({ length: count }, (_, i) => ({
        id: i,
        top: 4 + Math.random() * 46,
        width: 26 + Math.random() * 20,
        duration: 46 + Math.random() * 34,
        delay: -Math.random() * 70,
    }));

const generateRainStreaks = (count) =>
    Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        duration: 0.5 + Math.random() * 0.4,
        delay: Math.random() * 2,
        height: 12 + Math.random() * 14,
    }));

// One distinct gradient per real condition x time-of-day combination -
// richer than a single "night or not" split, so cloudy/rain/thunderstorm
// each read as visually different, matching how Apple Weather's own sky
// noticeably shifts hue per condition, not just brightness.
const skyGradientFor = (weatherState, isNight) => {
    if (weatherState === 'thunderstorm') return 'linear-gradient(to top, #0a0d1a, #141c33, #232c4a)';
    if (weatherState === 'rain') return isNight
        ? 'linear-gradient(to top, #0d1220, #17203a, #232f52)'
        : 'linear-gradient(to top, #2a3a52, #3d5270, #56708f)';
    if (weatherState === 'drizzle') return isNight
        ? 'linear-gradient(to top, #10162a, #1b2440, #29365a)'
        : 'linear-gradient(to top, #3a4a63, #506482, #6c84a3)';
    if (weatherState === 'cloudy') return isNight
        ? 'linear-gradient(to top, #12172a, #232c42, #37415c)'
        : 'linear-gradient(to top, #4b5875, #6b7a99, #8b9bb8)';
    // clear
    return isNight
        ? 'linear-gradient(to top, #0a0e1f, #141b38, #1f2c52)'
        : 'linear-gradient(to top, #2e6da4, #4a90c9, #7fb8e8)';
};

const WeatherAnimatedSky = ({ weatherState = 'clear', isNight = false, fullPage = false, moon = null }) => {
    const starCount = fullPage ? 70 : 26;
    const cloudCount = fullPage ? 9 : 5;
    const rainCount = fullPage ? 90 : 28;

    const stars = useMemo(() => generateStars(starCount), [starCount]);
    const clouds = useMemo(() => generateClouds(cloudCount), [cloudCount]);
    const rainStreaks = useMemo(() => generateRainStreaks(rainCount), [rainCount]);

    const showRain = weatherState === 'rain' || weatherState === 'drizzle' || weatherState === 'thunderstorm';
    const showClouds = weatherState === 'cloudy' || weatherState === 'rain' || weatherState === 'drizzle' || weatherState === 'thunderstorm';
    const showSun = weatherState === 'clear' && !isNight;
    const showMoon = weatherState === 'clear' && isNight;
    const showThunder = weatherState === 'thunderstorm';

    const skyGradient = skyGradientFor(weatherState, isNight);

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

            {/* Sun disc */}
            {showSun && (
                <div style={{
                    position: 'absolute', top: fullPage ? '10%' : '18%', right: '14%',
                    width: fullPage ? '84px' : '56px', height: fullPage ? '84px' : '56px', borderRadius: '50%',
                    background: 'radial-gradient(circle, #fffdf5 0%, #fde68a 45%, #f59e0b 100%)',
                    boxShadow: '0 0 34px rgba(251, 191, 36, 0.55)',
                    animation: 'weatherPulseGlow 4s ease-in-out infinite alternate',
                }} />
            )}

            {/* Moon disc - a real phase silhouette when moon data is passed
                (see MoonPhaseIcon), otherwise a plain full-looking disc. */}
            {showMoon && (
                <div style={{
                    position: 'absolute', top: fullPage ? '10%' : '18%', right: '14%',
                    filter: 'drop-shadow(0 0 22px rgba(226, 232, 240, 0.45))',
                    animation: 'weatherPulseGlow 4s ease-in-out infinite alternate',
                }}>
                    <MoonPhaseIcon size={fullPage ? 84 : 56} illumination={moon ? moon.illumination / 100 : 1} waxing={moon ? moon.ageDays < 14.77 : true} id={fullPage ? 'sky-full' : 'sky-hero'} />
                </div>
            )}

            {/* Clouds - drifting soft blobs built from a few overlapping
                puffs so they read as real cloud shapes rather than plain
                ellipses. */}
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

            {/* Rain streaks - full-page mode seeds each streak at a random
                starting top% (not just -10%) so the whole tall span looks
                populated immediately rather than only near the very top. */}
            {showRain && rainStreaks.map((r) => (
                <div key={r.id} style={{
                    position: 'absolute', left: `${r.left}%`, top: `${fullPage ? r.top : -10}%`,
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
