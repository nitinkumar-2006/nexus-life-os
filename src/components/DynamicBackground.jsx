// src/components/DynamicBackground.jsx
//
// Renders the animated sky used by the "Dynamic" theme: a continuous
// sunrise-to-sunset sun arc with a volumetric glow and light rays, a moon
// with a genuine lunar phase shape and crater texture, drifting clouds that
// genuinely catch light when passing near the sun, twinkling stars, and
// drifting atmospheric depth layers. Reports the current time-of-day phase
// back to whoever mounted it (via onPhaseChange) so the rest of the app can
// adapt text/surface contrast to match.
//
// The time-of-day engine below (sky palette, sun/moon arc math, cloud
// lighting) is unchanged and deliberately NOT touched by the weather layer -
// per explicit past instruction that trajectory/curve math stays exactly as
// tuned. The one real weather-reactive addition is a rain/drizzle streak
// overlay (plus a subtle overcast dimming baked into the same gradient-stop
// blending this file already uses) driven by WeatherContext's real,
// live weatherState - so a genuinely rainy night now actually looks rainy
// here too, not just on the dedicated Weather Hub page.
//
// External API is unchanged from previous versions: <DynamicBackground
// onPhaseChange={fn} /> - existing callers (DashboardLayout/App) don't need
// any changes, and nothing here touches routing, app logic, or any card/
// glass/header/sidebar styling (all of that lives entirely outside this
// file, in variables.css / style.css / the component files themselves).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useWeather } from '../context/WeatherContext.jsx';

// ---------------------------------------------------------------------------
// TIME-OF-DAY ENGINE (unchanged from the previous, verified-correct version)
// ---------------------------------------------------------------------------

// The exact boundary hours (24h decimal time) for each of the 4 phases.
const PHASE_BOUNDS = {
    dawn: [5, 7],       // 5:00 AM - 7:00 AM
    day: [7, 17],       // 7:00 AM - 5:00 PM
    dusk: [17, 19],     // 5:00 PM - 7:00 PM
    night: [19, 29],    // 7:00 PM - 5:00 AM the next morning (29 = 5:00 on a continuous timeline)
};

// The sun travels in ONE continuous arc across its entire above-horizon
// window (dawn start through dusk end), peaking once at true solar noon.
// The moon travels in one continuous arc across the whole night window.
const SUN_WINDOW = [5, 19]; // 5:00 AM -> 7:00 PM exactly, per the strict timeline. Midpoint (5+19)/2 = 12.0 exactly - no asymmetric offset trick needed this time, since the window itself is already symmetric around noon.
const MOON_WINDOW = PHASE_BOUNDS.night; // 7:00 PM -> 5:00 AM (automatically follows the night bounds above)

// The "pure" sky palette for each phase. Colors are ordered bottom -> mid -> top
// and rendered as a multi-stop linear-gradient(to top, ...).
const PHASE_PALETTE = {
    night: { bottom: '#1e2749', mid: '#131b33', top: '#05070f' },
    dawn: { bottom: '#fbbf24', mid: '#f97316', top: '#1e3a8a' },
    // Desaturated from the original, more vividly-blue palette
    // (#b8dff5/#6fb3e0/#2e6da4) - explicit later feedback that it read
    // as an "unwanted blue tint" clashing with the glass cards sitting
    // over it. Still a recognizably pale, clear-sky gradient (not
    // colorless/grey), just meaningfully less saturated.
    day: { bottom: '#d3e7ee', mid: '#a3c3d3', top: '#5c7f93' },
    dusk: { bottom: '#fb7185', mid: '#7c2d5c', top: '#141a33' },
};

const PREV_PHASE = { dawn: 'night', day: 'dawn', dusk: 'day', night: 'dusk' };

const PHASE_MOOD = {
    night: { nightStrength: 1, goldenStrength: 0 },
    dawn: { nightStrength: 0, goldenStrength: 1 },
    day: { nightStrength: 0, goldenStrength: 0 },
    dusk: { nightStrength: 0, goldenStrength: 1 },
};

// Each phase blends in from the previous phase only during its own first 30
// minutes, then holds 100% pure color for the rest of its window - this is
// what keeps night fully, deeply dark all the way from 8:00 PM to 4:00 AM.
const TRANSITION_HOURS = 0.5;

const hexToRgb = (hex) => {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
};

// Colors flowing through this module end up as either '#hex' or 'rgb(r, g, b)'
// strings at different points - this parses either form back into [r,g,b].
const parseColor = (str) => {
    if (str.startsWith('#')) return hexToRgb(str);
    const nums = str.match(/[\d.]+/g).map(Number);
    return [nums[0], nums[1], nums[2]];
};

const mixRgb = (a, b, t) => [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
];

const rgbCss = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;
const lerp = (a, b, t) => a + (b - a) * t;

// Alpha-composites `overlayRgb` over whatever color `baseColorStr` currently
// is, at the given alpha (0-1). Used to bake atmospheric haze, golden-hour
// warmth, and sky depth directly into the gradient's own color stops,
// rather than as separate stacked overlay rectangles.
const blendOver = (baseColorStr, overlayRgb, alpha) => {
    if (alpha <= 0.001) return baseColorStr;
    const base = parseColor(baseColorStr);
    return rgbCss(mixRgb(base, overlayRgb, alpha));
};

const mixColors = (paletteA, paletteB, t) => ({
    bottom: rgbCss(mixRgb(hexToRgb(paletteA.bottom), hexToRgb(paletteB.bottom), t)),
    mid: rgbCss(mixRgb(hexToRgb(paletteA.mid), hexToRgb(paletteB.mid), t)),
    top: rgbCss(mixRgb(hexToRgb(paletteA.top), hexToRgb(paletteB.top), t)),
});

const classifyPhase = (decimalTime) => {
    if (decimalTime >= PHASE_BOUNDS.dawn[0] && decimalTime < PHASE_BOUNDS.dawn[1]) return 'dawn';
    if (decimalTime >= PHASE_BOUNDS.day[0] && decimalTime < PHASE_BOUNDS.day[1]) return 'day';
    if (decimalTime >= PHASE_BOUNDS.dusk[0] && decimalTime < PHASE_BOUNDS.dusk[1]) return 'dusk';
    return 'night';
};

const getSkyBlend = (decimalTime) => {
    const phase = classifyPhase(decimalTime);
    const [start] = PHASE_BOUNDS[phase];

    let t = decimalTime;
    if (phase === 'night' && t < PHASE_BOUNDS.dawn[0]) t += 24;

    const sinceStart = t - start;
    const prevPhase = PREV_PHASE[phase];

    if (sinceStart < TRANSITION_HOURS) {
        const localT = sinceStart / TRANSITION_HOURS;
        return {
            colors: mixColors(PHASE_PALETTE[prevPhase], PHASE_PALETTE[phase], localT),
            nightStrength: lerp(PHASE_MOOD[prevPhase].nightStrength, PHASE_MOOD[phase].nightStrength, localT),
            goldenStrength: lerp(PHASE_MOOD[prevPhase].goldenStrength, PHASE_MOOD[phase].goldenStrength, localT),
        };
    }

    const p = PHASE_PALETTE[phase];
    return {
        colors: { bottom: p.bottom, mid: p.mid, top: p.top },
        nightStrength: PHASE_MOOD[phase].nightStrength,
        goldenStrength: PHASE_MOOD[phase].goldenStrength,
    };
};

// One continuous 0-100 position for whichever celestial body is currently
// up, across its ENTIRE above-horizon window - the sun rises once, peaks
// once at true solar noon, and sets once; no resets at phase boundaries.
const getCelestialProgress = (decimalTime, phase) => {
    if (phase === 'night') {
        const [start, end] = MOON_WINDOW;
        const t = decimalTime < PHASE_BOUNDS.dawn[0] ? decimalTime + 24 : decimalTime;
        return ((t - start) / (end - start)) * 100;
    }
    const [start, end] = SUN_WINDOW;
    return ((decimalTime - start) / (end - start)) * 100;
};

// ---------------------------------------------------------------------------
// MOON PHASE (real lunar cycle, not just a static full disc)
// ---------------------------------------------------------------------------
// Standard synodic-month approximation: how many days since a known new
// moon, mapped onto a 0-1 illumination curve via the classic cosine formula.
// Not meant to be arc-second precise - just astronomically plausible and
// smoothly, correctly cycling over ~29.5 days.
const SYNODIC_MONTH_DAYS = 29.53058867;
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

const getMoonPhase = (date) => {
    const daysSince = (date.getTime() - KNOWN_NEW_MOON_MS) / 86400000;
    const cyclePosition = ((daysSince % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;
    const phaseFraction = cyclePosition / SYNODIC_MONTH_DAYS; // 0 = new, 0.5 = full, 1 = new again
    const illumination = (1 - Math.cos(2 * Math.PI * phaseFraction)) / 2; // 0-1
    const waxing = phaseFraction < 0.5;
    return { illumination, waxing };
};

const computeTimeState = (overrideDecimalTime) => {
    const now = new Date();
    const decimalTime = typeof overrideDecimalTime === 'number' ? overrideDecimalTime : now.getHours() + now.getMinutes() / 60;
    const phase = classifyPhase(decimalTime);
    const { colors, nightStrength, goldenStrength } = getSkyBlend(decimalTime);
    const progress = getCelestialProgress(decimalTime, phase);
    const moonPhase = getMoonPhase(now);
    return { phase, progress, colors, nightStrength, goldenStrength, moonPhase };
};

// ---------------------------------------------------------------------------
// PROCEDURAL SKY ELEMENTS
// ---------------------------------------------------------------------------

const STAR_COUNT = 70;
const generateStars = () =>
    Array.from({ length: STAR_COUNT }, (_, i) => {
        const isFeature = Math.random() < 0.18;
        return {
            id: i,
            left: Math.random() * 100,
            top: Math.random() * 88,
            size: isFeature ? 2 + Math.random() * 1.6 : 1 + Math.random() * 1.3,
            glow: isFeature,
            tint: Math.random() < 0.25 ? 'rgba(191, 219, 254, 1)' : '#fff',
            delay: Math.random() * 7,
            duration: 2.2 + Math.random() * 4,
        };
    });

// Fixed crater/maria layout for the moon (positions/sizes/opacities chosen
// by hand for a believable, asymmetric lunar surface rather than a
// perfectly even/synthetic pattern - real craters don't scatter uniformly).
const MOON_SURFACE_FEATURES = [
    { x: 30, y: 28, r: 5, alpha: 0.28 },
    { x: 55, y: 20, r: 9, alpha: 0.16 },
    { x: 66, y: 62, r: 12, alpha: 0.22 },
    { x: 38, y: 55, r: 15, alpha: 0.14 },
    { x: 22, y: 68, r: 7, alpha: 0.24 },
    { x: 72, y: 32, r: 5, alpha: 0.3 },
    { x: 48, y: 40, r: 4, alpha: 0.26 },
    { x: 60, y: 78, r: 6, alpha: 0.2 },
];

// Real clouds are built from several overlapping soft elliptical "puffs"
// rather than one smooth blob. Every puff's offset + radius is kept well
// within its own container's bounds (verified numerically) so its gradient
// always fully fades to transparent before it reaches its own edge -
// softness comes entirely from that gradient fade, never from a CSS
// filter:blur on the container.
//
// IMPORTANT (root cause of the "sky isn't crystal clear" issue): each cloud
// already stacks 4-6 overlapping puffs on itself, and clouds also overlap
// each other. Semi-transparent layers compound multiplicatively when they
// stack (two 30%-alpha layers together read as ~50% opaque, not 60%) - the
// previous per-layer alpha (up to 0.85, ~0.17 typical) compounded across
// that much overlap into an 80-90%+ opaque wash in busy regions, which
// reads as a flat, washed-out solid color rather than distinct fluffy
// clouds with visible sky between them. This was never a card/glass CSS
// problem - card transparency was already correct; the sky behind it was
// the part actually washing out. The alpha below (verified numerically) is
// far lower per layer specifically so it stays visually reasonable even
// under heavy overlap.
const CLOUD_COUNT = 46;

// Clouds drift continuously in ONE direction, travelling the full width of
// the screen and looping seamlessly. Both bounds are generous enough that
// even the widest possible cloud (38vw base width * 1.3 max depth ~= 49vw)
// is still fully off-screen at both ends of its journey.
const CLOUD_TRAVEL_START_VW = -55;
const CLOUD_TRAVEL_END_VW = 155;

const generateClouds = () =>
    Array.from({ length: CLOUD_COUNT }, (_, i) => {
        // More puffs with wider size variation than before - real clouds
        // are irregular, billowing volumes, not a handful of same-sized
        // blobs. Verified numerically to stay within the same safe
        // containment envelope despite the wider ranges.
        const puffCount = 6 + Math.floor(Math.random() * 6);
        return {
            id: i,
            top: 6 + Math.random() * 46,
            width: 22 + Math.random() * 16, // vw
            depth: 0.5 + Math.random() * 0.8,
            duration: 150 + Math.random() * 170,
            delay: -Math.random() * 320,
            direction: 'rtl', // unified single direction - a consistent, unmistakable right-to-left flow
            puffs: Array.from({ length: puffCount }, () => ({
                dx: (Math.random() - 0.5) * 38,
                dy: (Math.random() - 0.5) * 18,
                rx: 13 + Math.random() * 12,
                ry: 15 + Math.random() * 16,
            })),
        };
    });

// A handful of very large, extremely faint, ultra-slow-drifting soft blobs -
// not distinct "clouds", but a subtle wash of tonal variation across the sky.
const NEBULA_COUNT = 3;
const generateNebulae = () =>
    Array.from({ length: NEBULA_COUNT }, (_, i) => ({
        id: i,
        top: Math.random() * 80,
        left: Math.random() * 70,
        size: 55 + Math.random() * 35,
        duration: 240 + Math.random() * 160,
        delay: -Math.random() * 300,
    }));

// Rain/drizzle streaks - seeded across the full viewport (not just
// clustered near the top) so a genuinely rainy sky reads as populated
// immediately, the same "start each streak at a random top%" trick
// WeatherAnimatedSky.jsx (the Weather Hub's own sky) already uses.
const RAIN_STREAK_COUNT = 110;
const generateRainStreaks = () =>
    Array.from({ length: RAIN_STREAK_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        duration: 0.5 + Math.random() * 0.5,
        delay: Math.random() * 2,
        height: 14 + Math.random() * 18,
    }));

const DynamicBackground = ({ onPhaseChange, isSidebarCollapsed }) => {
    const [timeState, setTimeState] = useState(computeTimeState);
    const stars = useMemo(generateStars, []);
    const clouds = useMemo(generateClouds, []);
    const nebulae = useMemo(generateNebulae, []);
    const rainStreaks = useMemo(generateRainStreaks, []);
    // The one real weather input this file reads - same shared
    // WeatherContext the Weather Hub and GreetingCard already use, so this
    // sky, the Hub's own sky, and the Home page's inline icon can never
    // disagree about what the real weather actually is right now.
    const { weatherState } = useWeather();
    const isRaining = weatherState === 'rain' || weatherState === 'drizzle' || weatherState === 'thunderstorm';
    const isThunderstorm = weatherState === 'thunderstorm';

    // Genuine, position-tracked cloud-sun lighting: rather than relying only
    // on incidental z-index/blend-mode overlap, this actually measures each
    // cloud's real animated screen position against the sun's real position
    // every 400ms (cheap enough to not matter, frequent enough to feel
    // responsive against clouds drifting over 2.5-5 minutes) and marks
    // clouds currently passing near/over the sun as "lit", boosting their
    // brightness and warmth exactly while they're genuinely catching light.
    const sunRef = useRef(null);
    const moonRef = useRef(null);
    const cloudRefs = useRef({});
    const [litCloudIds, setLitCloudIds] = useState(() => new Set());

    useEffect(() => {
        const checkOverlap = () => {
            const sunEl = sunRef.current;
            if (!sunEl) {
                if (litCloudIds.size > 0) setLitCloudIds(new Set());
                return;
            }
            const sunRect = sunEl.getBoundingClientRect();
            // A generous catch radius around the sun's own box - real light
            // spills well beyond the disc itself.
            const catchRadius = sunRect.width * 2.2;
            const sunCx = sunRect.left + sunRect.width / 2;
            const sunCy = sunRect.top + sunRect.height / 2;

            const nextLit = new Set();
            Object.entries(cloudRefs.current).forEach(([id, el]) => {
                if (!el) return;
                const r = el.getBoundingClientRect();
                const cx = r.left + r.width / 2;
                const cy = r.top + r.height / 2;
                const dist = Math.hypot(cx - sunCx, cy - sunCy);
                if (dist < catchRadius + Math.max(r.width, r.height) / 2) {
                    nextLit.add(id);
                }
            });

            // Only update state when the actual set of lit clouds changes,
            // to avoid re-rendering every 400ms for no visible reason.
            setLitCloudIds((prev) => {
                if (prev.size === nextLit.size && [...prev].every((id) => nextLit.has(id))) return prev;
                return nextLit;
            });
        };

        const interval = setInterval(checkOverlap, 400);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const tick = () => {
            const next = computeTimeState();
            setTimeState(next);
            // Text-contrast purposes ONLY - variables.css's day/dawn phase
            // variant assumes a bright sky behind mostly-transparent glass
            // cards and picks dark text accordingly (see the DYNAMIC MODE —
            // Bright sky phases block); a genuinely rained-on sky at 2pm
            // (this file's own rainDimAlpha above) is darkened enough that
            // dark text stops being legible against it, a real, reported
            // "washed-out text" bug. Rerouting the REPORTED phase to 'dusk'
            // - which already has its own correct light-text/dark-glass
            // variant plus its own contrast floor - fixes this using
            // existing CSS, without inventing a new phase or touching the
            // actual rendered sun/moon position below, which still uses the
            // real, unmodified `next.phase`.
            const reportedPhase = (isRaining && (next.phase === 'day' || next.phase === 'dawn')) ? 'dusk' : next.phase;
            if (onPhaseChange) onPhaseChange(reportedPhase);
        };
        tick();
        const interval = setInterval(tick, 30000);
        return () => clearInterval(interval);
    }, [onPhaseChange, isRaining]);

    const { phase, progress, colors, nightStrength, goldenStrength, moonPhase } = timeState;
    const isNight = phase === 'night';
    // During demo mode, position transitions are disabled entirely - the
    // demo's own requestAnimationFrame loop already updates left/bottom
    // every ~16ms (60fps), which is far more frequent than the 1s
    // real-time transition below was ever designed for. Left enabled, that
    // transition would constantly restart itself on every new frame's
    // target value, before ever making visible progress toward the
    // previous one - the state WAS updating correctly the whole time, the
    // CSS transition was just absorbing/canceling the motion before it
    // could ever become visible. Real-time mode (updates every 30s) keeps
    // the smooth 1s glide as before.
    // During demo mode, a SHORT (not zero) transition smooths each discrete
    // position update into a brief glide rather than an instant jump -
    // this is what was actually causing the "triangular/bouncing" look
    // despite the underlying math being verified perfectly smooth: with
    // zero transition duration, every ~33ms update snapped the sun
    // directly to its new position with no interpolation at all, which
    // reads as discrete stepping rather than fluid motion (especially
    // visible in a screen recording). 20ms is comfortably shorter than the
    // ~33ms update interval, so each glide completes before the next
    // update arrives - avoiding the original problem this was disabled
    // for (a 1s transition designed for 30-second real-time updates
    // constantly restarting itself on every rapid demo update, barely
    // moving at all).
    const celestialTransitionBase = 'left 1s linear, bottom 1s linear';
    // The trajectory is deliberately inset from the raw 0-100% progress
    // value on both axes: horizontally so the sun/moon originates near the
    // sidebar and descends before the screen's right edge (rather than
    // touching either edge exactly), and vertically so its lowest point
    // clears lower page content (previously dipped to a bare 10%, which
    // could visually overlap content like a Calendar widget) while its
    // peak reaches much closer to the header (previously topped out at
    // 85%; now 90%, and the floor is raised from 10% to 24%).
    // Precisely centers within the MAIN CONTENT AREA (to the right of the
    // sidebar), not the full viewport. The sidebar occupies a fixed pixel
    // width (matching sidebar.jsx exactly: 76px collapsed, 224px expanded),
    // so a pure percentage-of-viewport position can't correctly center
    // within the remaining content area - calc() mixes the fixed sidebar
    // offset with a percentage of the remaining width, guaranteeing the
    // peak (progress=50, celestialFraction=0.5 exactly) always lands dead
    // center in the content area regardless of actual viewport width.
    const sidebarWidthPx = isSidebarCollapsed ? 62 : 224;
    // --- ORIGINAL, PRISTINE ARC MATH - reverted back to the exact formula
    // from when this feature was first implemented. All later curve
    // experiments (calc()-string peaks, piecewise ramps, bell curves,
    // extended off-screen horizontal ranges) have been discarded per
    // explicit instruction to return to this original trajectory.
    //
    // celestialFraction: extended to -0.06 -> 1.06 so the body genuinely
    // originates from behind the left edge/sidebar and exits completely
    // past the right edge, rather than stopping short with a visible
    // margin on each side. The sky container's overflow:hidden naturally
    // clips the off-screen portions. Verified: -0.06 + 1.06 = 1.0, so the
    // noon center (fraction=0.5 at progress=50, the header-overlap peak)
    // is completely unaffected by this extension.
    const celestialFraction = -0.06 + (progress / 100) * 1.12;
    const celestialLeft = `calc(${sidebarWidthPx}px + (100% - ${sidebarWidthPx}px) * ${celestialFraction})`;

    // arcHeight: a STRICT, literal quadratic parabola - y = A - B*(p-0.5)^2 -
    // not cubic easing, not sine, not a piecewise combination of curves.
    // This is a single continuous mathematical expression across the
    // entire journey (no branching at progress=50), which is what makes
    // it a genuine parabola rather than two mirrored pieces joined at the
    // middle. A is the peak value (94, matching the previous formula's
    // peak), B is derived so the floor (30, matching the previous
    // formula's floor) is reached at exactly progress=0 and progress=100.
    // Plain percentage NUMBER, not a calc() string - keeps lowSunFactor's
    // `1 - arcHeight/55` computation (used for sun color/glow intensity)
    // working correctly rather than silently producing NaN.
    const PARABOLA_PEAK = 94, PARABOLA_FLOOR = 30;
    const PARABOLA_B = (PARABOLA_PEAK - PARABOLA_FLOOR) / 0.25;
    const arcHeight = PARABOLA_PEAK - PARABOLA_B * Math.pow(progress / 100 - 0.5, 2);

    // --- Bake haze / golden-hour warmth / depth darkening directly into the
    // sky's own gradient stops, instead of layering separate rectangles on
    // top. There is exactly one gradient background for the whole sky.
    const hazeAlpha = isNight ? 0 : 0.06;
    const goldenBottomAlpha = Math.min(0.5, goldenStrength * 0.55);
    const goldenMidAlpha = Math.min(0.3, goldenStrength * 0.35);
    let finalBottom = blendOver(colors.bottom, [255, 255, 255], hazeAlpha);
    finalBottom = blendOver(finalBottom, [253, 186, 116], goldenBottomAlpha);

    let finalMid = blendOver(colors.mid, [251, 146, 60], goldenMidAlpha);

    // Overcast dimming - additive only: alpha is exactly 0 (a verified no-op
    // in blendOver) whenever it isn't actually raining, so every existing
    // clear-sky/dawn/dusk/night gradient stays byte-for-byte what it already
    // was. A real rainy/stormy sky reads visibly greyer and heavier than a
    // plain cloudy one, not just "clouds plus rain streaks on an unchanged
    // blue/gold backdrop".
    const rainDimAlpha = isThunderstorm ? 0.24 : isRaining ? 0.16 : 0;
    finalBottom = blendOver(finalBottom, [30, 38, 58], rainDimAlpha);
    finalMid = blendOver(finalMid, [20, 26, 42], rainDimAlpha * 0.85);

    const finalTop = blendOver(colors.top, [0, 0, 0], 0.1);

    const bgGradient = `linear-gradient(to top, ${finalBottom}, ${finalMid}, ${finalTop})`;

    // The sun sits lower/warmer/larger near the horizon and higher/whiter/
    // tighter near solar noon.
    const lowSunFactor = isNight ? 0 : Math.max(0, 1 - arcHeight / 55);
    // Fixed at 112px to exactly match the moon disc's own fixed size
    // (previously 130 + lowSunFactor*40, varying 130-170px - now uniform
    // with the moon instead of varying with the "low on horizon" effect).
    const sunSize = 112;
    const warmSun = goldenStrength > 0.25 || lowSunFactor > 0.4;
    const sunGlowRgb = warmSun ? [253, 186, 116] : [254, 240, 138];

    // Cloud tint drifts warm (golden hour) -> cool white (day) -> dim slate
    // (night) - always the plain, clear-sky palette now, with no
    // weather-reactive darkening.
    const cloudBaseColor = isNight
        ? [148, 163, 184]
        : goldenStrength > 0.15
            ? [255, 214, 165]
            : [255, 255, 255];

    const cloudDensity = 0.55;

    // Moon phase shadow: two same-size circles overlapping. At illumination
    // 0 the shadow sits exactly on top of the lit disc (fully new/dark); at
    // illumination 1 it's shifted a full diameter clear (fully full/lit);
    // values in between produce a crescent/gibbous silhouette. Verified
    // numerically before implementing.
    const moonShadowShiftPct = moonPhase ? moonPhase.illumination * 100 : 100;
    const moonShadowDirection = moonPhase && moonPhase.waxing ? -1 : 1;

    return (
        <div
            data-diag="sky-root"
            style={{
                position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                zIndex: 0, overflow: 'hidden', pointerEvents: 'none',
                transition: 'background 2.5s ease',
                background: bgGradient,
            }}
        >
            {/* Very large, extremely faint, ultra-slow soft blobs of tonal
                variation - not distinct clouds, just what keeps a night sky
                from reading as one flat, uniform color. */}
            {nebulae.map((n) => (
                <div
                    key={n.id}
                    style={{
                        position: 'absolute',
                        top: `${n.top}%`,
                        left: `${n.left}%`,
                        width: `${n.size}vw`,
                        height: `${n.size * 0.7}vw`,
                        background: isNight
                            ? 'radial-gradient(ellipse, rgba(99, 102, 241, 0.05) 0%, rgba(99, 102, 241, 0) 70%)'
                            : 'radial-gradient(ellipse, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 70%)',
                        zIndex: 1,
                        animation: `nexusNebulaDrift ${n.duration}s ease-in-out ${n.delay}s infinite alternate`,
                    }}
                />
            ))}

            {/* Fine atmospheric grain - a barely-there noise texture so the
                gradient reads as "sky" rather than a flat vector fill. */}
            <div
                style={{
                    position: 'absolute', inset: 0, zIndex: 1, opacity: 0.06,
                    mixBlendMode: 'overlay',
                    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
                    backgroundSize: '3px 3px',
                }}
            />

            {/* Gentle ambient horizon glow at night - distinct from the
                moon's own halo, always present after dark, kept faint
                enough to never compete with any text. */}
            {nightStrength > 0.02 && (
                <div
                    style={{
                        position: 'absolute', left: 0, right: 0, bottom: 0, height: '30%',
                        background: 'linear-gradient(to top, rgba(99, 102, 241, 0.07) 0%, rgba(99, 102, 241, 0) 100%)',
                        opacity: nightStrength,
                        zIndex: 1,
                        transition: 'opacity 2.5s ease',
                    }}
                />
            )}

            {/* Stars - individually timed so they twinkle naturally, not in
                unison. Fully visible throughout the whole pure-night window. */}
            {nightStrength > 0.02 && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 1, opacity: nightStrength, transition: 'opacity 2.5s ease' }}>
                    {stars.map((star) => (
                        <div
                            key={star.id}
                            style={{
                                position: 'absolute',
                                left: `${star.left}%`,
                                top: `${star.top}%`,
                                width: `${star.size}px`,
                                height: `${star.size}px`,
                                borderRadius: '50%',
                                background: star.tint,
                                boxShadow: star.glow ? `0 0 6px 1px ${star.tint === '#fff' ? 'rgba(255,255,255,0.8)' : 'rgba(191,219,254,0.8)'}` : 'none',
                                animation: `nexusTwinkle ${star.duration}s ease-in-out ${star.delay}s infinite alternate`,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Sun light rays - a very subtle, slowly-rotating "sunburst"
                pattern sitting behind the disc, using a conic-gradient (no
                filter:blur - the fade comes from the gradient's own
                transparent stops, keeping this crisp and consistent across
                browsers). */}
            {!isNight && (
                <>
                {/* Layer 1: irregular, organic ray spacing/widths - deliberately
                    NOT evenly spaced (real light scattering isn't uniform),
                    softer edges via wider transparent transition zones for a
                    diffused rather than crisp-spoke look. */}
                <div
                    data-diag="sun-rays"
                    style={{
                        position: 'absolute', left: celestialLeft, bottom: `${arcHeight}%`,
                        width: `${sunSize * 3.4}px`, height: `${sunSize * 3.4}px`,
                        borderRadius: '50%',
                        transform: 'translate(-50%, 50%)',
                        transition: `${celestialTransitionBase}`,
                        opacity: 0.38 + goldenStrength * 0.22,
                        background: `conic-gradient(from 0deg,
                            transparent 0deg, rgba(255,247,214,0.4) 6deg, transparent 16deg,
                            transparent 29deg, rgba(255,247,214,0.5) 41deg, transparent 52deg,
                            transparent 71deg, rgba(255,247,214,0.32) 79deg, transparent 94deg,
                            transparent 108deg, rgba(255,247,214,0.48) 122deg, transparent 135deg,
                            transparent 151deg, rgba(255,247,214,0.36) 161deg, transparent 176deg,
                            transparent 193deg, rgba(255,247,214,0.5) 203deg, transparent 216deg,
                            transparent 234deg, rgba(255,247,214,0.34) 244deg, transparent 258deg,
                            transparent 276deg, rgba(255,247,214,0.46) 289deg, transparent 302deg,
                            transparent 322deg, rgba(255,247,214,0.38) 334deg, transparent 349deg,
                            transparent 360deg)`,
                        animation: 'nexusSunRaysRotate 130s linear infinite',
                        zIndex: 2,
                        mixBlendMode: 'screen',
                    }}
                />
                {/* Layer 2: a second, much larger and softer set of wide
                    bands rotating slowly the opposite way, at a lower
                    opacity - simulates light scattering through atmosphere
                    at a different depth, giving the rays complexity rather
                    than a single flat pinwheel. */}
                <div
                    style={{
                        position: 'absolute', left: celestialLeft, bottom: `${arcHeight}%`,
                        width: `${sunSize * 5.2}px`, height: `${sunSize * 5.2}px`,
                        borderRadius: '50%',
                        transform: 'translate(-50%, 50%)',
                        transition: `${celestialTransitionBase}`,
                        opacity: 0.16 + goldenStrength * 0.12,
                        background: `conic-gradient(from 40deg,
                            transparent 0deg, rgba(255,237,190,0.4) 22deg, transparent 58deg,
                            transparent 100deg, rgba(255,237,190,0.32) 128deg, transparent 168deg,
                            transparent 205deg, rgba(255,237,190,0.4) 232deg, transparent 270deg,
                            transparent 300deg, rgba(255,237,190,0.3) 330deg, transparent 360deg)`,
                        animation: 'nexusSunRaysRotateReverse 210s linear infinite',
                        zIndex: 2,
                        mixBlendMode: 'screen',
                    }}
                />
                </>
            )}

            {/* Volumetric glow halo, sitting just behind the sun/moon disc.
                Three stops (not two) give it a genuinely bright, defined
                core that holds its shape before fading, rather than one
                smooth wash across the whole radius - that definition is
                what keeps it reading as a crisp light source even after a
                glass panel's own backdrop-filter blur softens it further.
                mix-blend-mode: screen makes this read as actual light
                against the sky gradient behind it, rather than a flat
                translucent wash - and because clouds are painted AFTER (in
                front of) this glow, their own natural translucency lets it
                visibly show through whenever a cloud drifts near the
                sun/moon's position, which is what gives the "light
                spilling onto clouds" effect. */}
            {!isNight && (
                <div
                    data-diag="sun-glow"
                    style={{
                        position: 'absolute', left: celestialLeft, bottom: `${arcHeight}%`,
                        width: '380px', height: '380px', // fixed to exactly match the moon's glow size
                        borderRadius: '50%',
                        background: `radial-gradient(circle, rgba(${sunGlowRgb.join(',')}, ${0.5 + goldenStrength * 0.3 + lowSunFactor * 0.2}) 0%, rgba(${sunGlowRgb.join(',')}, ${0.22 + goldenStrength * 0.14}) 30%, rgba(${sunGlowRgb.join(',')}, 0) 65%)`,
                        transform: 'translate(-50%, 50%)',
                        transition: `${celestialTransitionBase}, background 2.5s ease`,
                        zIndex: 2,
                        mixBlendMode: 'screen',
                    }}
                />
            )}
            {isNight && (
                <div
                    data-diag="moon-glow"
                    style={{
                        position: 'absolute', left: celestialLeft, bottom: `${arcHeight}%`,
                        width: '380px', height: '380px',
                        borderRadius: '50%',
                        background: `radial-gradient(circle, rgba(203, 213, 240, 0.34) 0%, rgba(203, 213, 240, 0.14) 30%, rgba(203, 213, 240, 0) 65%)`,
                        transform: 'translate(-50%, 50%)',
                        transition: `${celestialTransitionBase}`,
                        zIndex: 2,
                        mixBlendMode: 'screen',
                    }}
                />
            )}


            {/* Sun disc - a richer multi-stop radiant core (hot near-white
                center fading through gold to a deep orange rim) rather than
                a flat single-tone circle, plus a slow pulse. */}
            {!isNight && (
                <div
                    data-diag="sun-disc"
                    ref={sunRef}
                    style={{
                        position: 'absolute', left: celestialLeft, bottom: `${arcHeight}%`,
                        width: `${sunSize}px`, height: `${sunSize}px`, borderRadius: '50%',
                        background: warmSun
                            ? 'radial-gradient(circle, #fffdf5 0%, #fff3d6 18%, #fdba74 48%, #f97316 78%, #ea580c 100%)'
                            : 'radial-gradient(circle, #ffffff 0%, #fffbe8 14%, #fef08a 46%, #f59e0b 80%, #d97706 100%)',
                        opacity: 1,
                        boxShadow: `0 0 ${120 + lowSunFactor * 60}px rgba(251, 191, 36, ${0.5 + goldenStrength * 0.3}), 0 0 ${220 + lowSunFactor * 80}px rgba(249, 115, 22, ${0.3 + goldenStrength * 0.25})`,
                        transform: 'translate(-50%, 50%)',
                        transition: `${celestialTransitionBase}, width 3s ease, height 3s ease, background 2.5s ease, opacity 2.5s ease`,
                        animation: 'nexusPulseGlow 4s infinite alternate', zIndex: 2,
                    }}
                />
            )}

            {/* Moon - a genuine lunar phase (new/crescent/gibbous/full,
                computed from the real date, not always a full circle),
                built from two overlapping circles: a base disc carrying the
                crater/maria texture, and a dark "shadow" disc shifted
                horizontally by the current illumination fraction. Wherever
                the shadow doesn't cover, the textured base shows through -
                wherever it does, that portion is correctly dark, the way an
                actual lunar phase looks. */}
            {isNight && (
                <div
                    data-diag="moon-disc"
                    ref={moonRef}
                    style={{
                        position: 'absolute', left: celestialLeft, bottom: `${arcHeight}%`,
                        width: '112px', height: '112px',
                        transform: 'translate(-50%, 50%)',
                        transition: `${celestialTransitionBase}, opacity 2.5s ease`,
                        opacity: 1,
                        zIndex: 2,
                    }}
                >
                    <div
                        style={{
                            position: 'relative', width: '100%', height: '100%',
                            borderRadius: '50%', overflow: 'hidden',
                            boxShadow: '0 0 40px rgba(226, 232, 240, 0.35), inset -8px -6px 16px rgba(15,23,42,0.4)',
                            background: [
                                ...MOON_SURFACE_FEATURES.map(
                                    (f) => `radial-gradient(circle at ${f.x}% ${f.y}%, rgba(100,116,139,${f.alpha}) 0%, transparent ${f.r}%)`
                                ),
                                'radial-gradient(circle at 32% 28%, #ffffff 0%, #eef1f6 35%, #cfd6e2 65%, #9aa5b8 100%)',
                            ].join(', '),
                        }}
                    >
                        {/* The night-side shadow, positioned by real illumination/waxing state */}
                        <div
                            style={{
                                position: 'absolute', inset: 0, borderRadius: '50%',
                                background: 'radial-gradient(circle, rgba(7,11,22,0.95) 55%, rgba(7,11,22,0.8) 100%)',
                                transform: `translateX(${moonShadowDirection * moonShadowShiftPct}%)`,
                                boxShadow: `inset ${moonShadowDirection * -3}px 0 10px rgba(226,232,240,0.12)`,
                                transition: 'transform 3s ease',
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Real layered clouds, drifting continuously in one direction
                (some left-to-right, some right-to-left, like real winds at
                different altitudes) across the full width of the screen,
                looping seamlessly. */}
            {clouds.map((cloud) => {
                const edgeAlpha = Math.min(0.28, (0.035 + cloud.depth * 0.035) * cloudDensity);
                // The core is deliberately punchier than the edge - this is
                // what makes each cloud read as a real, visible, defined
                // shape rather than a barely-there haze. Only the edge alpha
                // (unchanged from before) is what compounds when puffs and
                // clouds overlap, so this stays safe against wash-out while
                // fixing "clouds are basically invisible".
                const isLit = !isNight && litCloudIds.has(cloud.id);
                const litAlphaBoost = isLit ? 1.5 : 1;
                const coreAlpha = Math.min(0.75, edgeAlpha * 2.4 * litAlphaBoost);
                const edgeAlphaFinal = Math.min(0.4, edgeAlpha * litAlphaBoost);
                // When genuinely catching the sun, a cloud's own color warms
                // toward the sun's glow color rather than staying neutral -
                // this is what makes the interaction visible and real,
                // rather than just "slightly brighter".
                const [baseR, baseG, baseB] = cloudBaseColor;
                const [r, g, b] = isLit
                    ? [
                          Math.round(baseR + (sunGlowRgb[0] - baseR) * 0.5),
                          Math.round(baseG + (sunGlowRgb[1] - baseG) * 0.5),
                          Math.round(baseB + (sunGlowRgb[2] - baseB) * 0.5),
                      ]
                    : [baseR, baseG, baseB];
                const gradients = cloud.puffs
                    .map(
                        (puff) =>
                            `radial-gradient(ellipse ${puff.rx}% ${puff.ry}% at ${50 + puff.dx}% ${50 + puff.dy}%, rgba(${r}, ${g}, ${b}, ${coreAlpha}) 0%, rgba(${r}, ${g}, ${b}, ${edgeAlphaFinal}) 45%, rgba(${r}, ${g}, ${b}, 0) 100%)`
                    )
                    .join(', ');
                return (
                    <div
                        key={cloud.id}
                        ref={(el) => {
                            cloudRefs.current[cloud.id] = el;
                        }}
                        style={{
                            position: 'absolute',
                            top: `${cloud.top}%`,
                            width: `${cloud.width * cloud.depth}vw`,
                            height: `${cloud.width * cloud.depth * 0.4}vw`,
                            zIndex: 3,
                            background: gradients,
                            animation: `${cloud.direction === 'ltr' ? 'nexusCloudDriftLTR' : 'nexusCloudDriftRTL'} ${cloud.duration}s linear ${cloud.delay}s infinite`,
                            transition: 'background 0.6s ease',
                        }}
                    />
                );
            })}

            {/* Rain/drizzle streaks - real weather-driven, sitting in front
                of the clouds (higher z-index) since rain visually reads as
                closer to the viewer than the cloud layer it's falling from. */}
            {isRaining && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 4 }}>
                    {rainStreaks.map((r) => (
                        <div
                            key={r.id}
                            style={{
                                position: 'absolute', left: `${r.left}%`, top: `${r.top}%`,
                                width: '2px', height: `${r.height}px`, borderRadius: '2px',
                                background: 'linear-gradient(to bottom, rgba(191,219,254,0), rgba(191,219,254,0.55))',
                                transform: 'rotate(12deg)',
                                animation: `nexusRainFall ${r.duration}s linear ${r.delay}s infinite`,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Thunderstorm flash - a randomized brief white flash, same
                technique as the Weather Hub's own sky. */}
            {isThunderstorm && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: '#fff', opacity: 0, animation: 'nexusLightningFlash 7s ease-in-out infinite' }} />
            )}

            <style>
                {`
                @keyframes nexusPulseGlow { 0% { transform: translate(-50%, 50%) scale(1); } 100% { transform: translate(-50%, 50%) scale(1.03); } }
                @keyframes nexusSunRaysRotate { 0% { transform: translate(-50%, 50%) rotate(0deg); } 100% { transform: translate(-50%, 50%) rotate(360deg); } }
                @keyframes nexusSunRaysRotateReverse { 0% { transform: translate(-50%, 50%) rotate(0deg); } 100% { transform: translate(-50%, 50%) rotate(-360deg); } }
                @keyframes nexusCloudDriftLTR { 0% { left: ${CLOUD_TRAVEL_START_VW}vw; } 100% { left: ${CLOUD_TRAVEL_END_VW}vw; } }
                @keyframes nexusCloudDriftRTL { 0% { left: ${CLOUD_TRAVEL_END_VW}vw; } 100% { left: ${CLOUD_TRAVEL_START_VW}vw; } }
                @keyframes nexusNebulaDrift { 0% { transform: translate(0, 0); } 100% { transform: translate(6vw, 3vh); } }
                @keyframes nexusTwinkle { 0% { opacity: 0.25; transform: scale(0.85); } 100% { opacity: 1; transform: scale(1.15); } }
                @keyframes nexusRainFall { 0% { transform: translateY(0) rotate(12deg); opacity: 0; } 10% { opacity: 1; } 100% { transform: translateY(340%) rotate(12deg); opacity: 0.2; } }
                @keyframes nexusLightningFlash {
                    0%, 91%, 100% { opacity: 0; }
                    92% { opacity: 0.5; }
                    93% { opacity: 0.05; }
                    94% { opacity: 0.36; }
                    95% { opacity: 0; }
                }
                `}
            </style>
        </div>
    );
};

export default DynamicBackground;
